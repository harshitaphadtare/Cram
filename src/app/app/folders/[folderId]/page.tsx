import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { FileText, ListTodo, Medal } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getFolderForUser, getFolderLeaderboard, getFolderMastery } from "@/lib/data/pages";
import { folderDotClass } from "@/lib/folder-colors";
import { roleAtLeast } from "@/lib/permissions";
import { FolderRole } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NewPageButton } from "@/components/new-page-button";
import { DeletePageButton } from "@/components/delete-page-button";
import { QuizMeDialog } from "@/components/quiz-me-dialog";
import { ShareFolderDialog } from "@/components/share-folder-dialog";
import { FolderSettingsMenu } from "@/components/folder-settings-menu";
import { ReviewButton } from "@/components/gamification/review-button";
import { RoadmapBox } from "@/components/roadmap-box";
import { NewTaskForm } from "@/components/new-task-form";
import { TaskItem } from "@/components/task-item";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

function MasteryPill({ value, due }: { value: number; due: boolean }) {
  return (
    <span className="flex items-center gap-2" title={due ? "Due for review" : "Mastery"}>
      <span className="h-1 w-14 overflow-hidden rounded-full bg-muted-foreground/15">
        <span
          className={cn(
            "cram-grow-x block h-full rounded-full",
            value >= 80 ? "bg-chart-3" : value >= 50 ? "bg-gold" : "bg-streak",
          )}
          style={{ width: `${Math.max(4, value)}%` }}
        />
      </span>
      <span className={cn("w-8 text-right text-xs tabular-nums", due ? "text-streak" : "text-muted-foreground")}>
        {value}%
      </span>
    </span>
  );
}

const MEDALS = ["text-gold", "text-muted-foreground", "text-streak/80"];

export default async function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  const user = await requireUser();
  const result = await getFolderForUser(folderId, user.id);
  if (!result) notFound();

  const { folder, role } = result;
  const canEdit = roleAtLeast(role, FolderRole.EDITOR);
  const canManageMembers = roleAtLeast(role, FolderRole.ADMIN);
  const isShared = folder.members.length > 0;

  const [mastery, leaderboard, roadmap, todos] = await Promise.all([
    getFolderMastery(folder.id, user.id),
    isShared
      ? getFolderLeaderboard([folder.owner, ...folder.members.map((m) => m.user)], user.id)
      : Promise.resolve([]),
    prisma.roadmapItem.findMany({
      where: { userId: user.id, folderId: folder.id },
      select: { id: true, folderId: true, title: true, done: true },
      orderBy: { order: "asc" },
    }),
    prisma.task.findMany({
      where: { userId: user.id, folderId: folder.id, completed: false },
      orderBy: [{ dueDate: "asc" }, { order: "asc" }],
    }),
  ]);

  const duePageIds = folder.pages.filter((p) => mastery.get(p.id)?.due).map((p) => p.id);
  const reviewed = [...mastery.values()];
  const averageMastery = reviewed.length
    ? Math.round(reviewed.reduce((sum, m) => sum + m.mastery, 0) / reviewed.length)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className={cn("size-3 shrink-0 rounded-[4px]", folderDotClass(folder.color))} />
            <h1 className="text-3xl font-semibold">{folder.name}</h1>
            {role !== "OWNER" && <Badge variant="secondary">{role.toLowerCase()}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {folder.pages.length} {folder.pages.length === 1 ? "page" : "pages"}
            {averageMastery !== null && ` · ${averageMastery}% average mastery`}
            {duePageIds.length > 0 && ` · ${duePageIds.length} due for review`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ShareFolderDialog
            folderId={folder.id}
            folderName={folder.name}
            owner={{
              name: folder.owner.name,
              email: folder.owner.email,
              avatarUrl: folder.owner.avatarUrl,
            }}
            members={folder.members.map((m) => ({
              userId: m.userId,
              name: m.user.name,
              email: m.user.email,
              avatarUrl: m.user.avatarUrl,
              role: m.role,
            }))}
            canManage={canManageMembers}
          />
          {duePageIds.length > 0 ? (
            <ReviewButton folderId={folder.id} pageIds={duePageIds.slice(0, 5)} label="Review due" />
          ) : null}
          <QuizMeDialog
            folderId={folder.id}
            pages={folder.pages.map((p) => ({ id: p.id, title: p.title }))}
          />
          {canEdit && <NewPageButton folderId={folder.id} />}
          {role === "OWNER" && (
            <FolderSettingsMenu folderId={folder.id} name={folder.name} isOwner />
          )}
        </div>
      </div>

      {/* items-start: the page list shouldn't stretch to the height of the sidebar boxes. */}
      <div className="cram-stagger grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        {folder.pages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center text-muted-foreground">
            <FileText className="size-8" />
            <p className="font-medium text-foreground">No pages yet</p>
            {canEdit && <p className="text-sm">Create your first page to start taking notes.</p>}
          </div>
        ) : (
          <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
            {folder.pages.map((page, i) => {
              const m = mastery.get(page.id);
              return (
                // DeletePageButton is a sibling of the Link, not nested inside it — a <button>
                // inside an <a> is invalid HTML and browsers bubble clicks through inconsistently.
                <div
                  key={page.id}
                  className={cn("group flex items-center gap-3 pr-2 transition-colors hover:bg-accent", i > 0 && "border-t")}
                >
                  <Link
                    href={`/app/folders/${folder.id}/pages/${page.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{page.title || "Untitled"}</span>
                    {m && <MasteryPill value={m.mastery} due={m.due} />}
                    <span className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground sm:block">
                      {formatDistanceToNowStrict(page.updatedAt, { addSuffix: true })}
                    </span>
                  </Link>
                  {canEdit && (
                    <div className="opacity-0 transition group-hover:opacity-100">
                      <DeletePageButton pageId={page.id} title={page.title} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <aside className="cram-stagger flex flex-col gap-6">
          <section className="flex flex-col overflow-hidden rounded-xl border bg-card">
            <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <ListTodo className="size-4 text-muted-foreground" />
                To-do
                {todos.length > 0 && (
                  <span className="text-xs font-normal tabular-nums text-muted-foreground">{todos.length}</span>
                )}
              </h2>
              <Link href="/app/planner" className="text-xs text-muted-foreground hover:text-foreground">
                Planner
              </Link>
            </header>
            <div className="border-b px-3 py-2.5">
              <NewTaskForm compact lockSubject defaultFolderId={folder.id} />
            </div>
            {todos.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">Nothing to do for {folder.name} yet.</p>
            ) : (
              <div className="flex max-h-80 flex-col gap-px overflow-y-auto p-1.5">
                {todos.map((task) => (
                  <TaskItem key={task.id} task={task} plain hideSubject />
                ))}
              </div>
            )}
          </section>

          <RoadmapBox items={roadmap} initialFolderId={folder.id} locked />
          {leaderboard.length > 1 && (
            <div className="flex flex-col gap-3">
              <h2 className="flex h-8 items-center gap-2 text-sm font-medium text-muted-foreground">
                <Medal className="size-4" />
                This week
              </h2>
              <ol className="flex flex-col overflow-hidden rounded-xl border bg-card">
                {leaderboard.map((entry, i) => (
                  <li
                    key={entry.userId}
                    className={cn("flex items-center gap-3 px-4 py-2.5", i > 0 && "border-t", entry.isYou && "bg-primary/[0.05]")}
                  >
                    <span className={cn("w-4 text-center text-sm font-semibold tabular-nums", MEDALS[i] ?? "text-muted-foreground")}>
                      {i + 1}
                    </span>
                    <Avatar className="size-6">
                      {entry.avatarUrl && <AvatarImage src={entry.avatarUrl} alt={entry.name} />}
                      <AvatarFallback className="text-[10px]">{entry.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {entry.name}
                      {entry.isYou && <span className="text-muted-foreground"> (you)</span>}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">{entry.weeklyXp} XP</span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">
                XP earned in the last 7 days. You can hide yourself in Settings.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
