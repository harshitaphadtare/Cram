import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import {
  ArrowRight,
  CalendarCheck2,
  ChevronRight,
  Clock,
  FileText,
  Flame,
  Folder,
  PartyPopper,
  Plus,
  Snowflake,
  Sparkles,
  Timer,
  Trophy,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listVisibleFolders } from "@/lib/data/folders";
import { listTasksForUser } from "@/lib/data/tasks";
import { getDashboardData } from "@/lib/data/dashboard";
import { folderDotClass } from "@/lib/folder-colors";
import { NewFolderDialog } from "@/components/new-folder-dialog";
import { TaskItem } from "@/components/task-item";
import { Button } from "@/components/ui/button";
import { GoalRing } from "@/components/gamification/goal-ring";
import { LevelProgress } from "@/components/gamification/level-progress";
import { WeekStrip } from "@/components/gamification/week-strip";
import { AchievementBadge } from "@/components/gamification/achievement-badge";
import { ReviewButton } from "@/components/gamification/review-button";
import { cn } from "@/lib/utils";
import { todayDateOnly } from "@/lib/date-only";
import { formatGoal } from "@/lib/goals";

function greetingFor(hour: number) {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function SectionHeader({
  icon: Icon,
  title,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-8 items-center justify-between">
      <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="size-4" />
        {title}
      </h2>
      {action}
    </div>
  );
}

function MasteryBar({ value }: { value: number }) {
  return (
    <div className="h-1 w-16 overflow-hidden rounded-full bg-muted-foreground/15">
      <div
        className={cn(
          "h-full rounded-full",
          value >= 80 ? "bg-chart-3" : value >= 50 ? "bg-gold" : "bg-streak",
        )}
        style={{ width: `${Math.max(4, value)}%` }}
      />
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const folders = await listVisibleFolders(user.id);
  const [tasks, data] = await Promise.all([
    listTasksForUser(user.id),
    getDashboardData(
      user,
      folders.map((f) => f.id),
    ),
  ]);

  const today = todayDateOnly();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const todaysTasks = tasks
    .filter((t) => !t.completed && t.dueDate && t.dueDate < tomorrow)
    .slice(0, 6);

  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: user.timezone }).format(now),
  );
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: user.timezone,
  }).format(now);
  const firstName = user.name?.split(" ")[0];

  const todayMinutes = Math.floor(data.todaySeconds / 60);
  const goalMet = todayMinutes >= user.dailyGoalMin;
  const streakAtRisk = user.streakCount > 0 && !data.studiedToday;

  // Reviews are grouped by folder so one click quizzes a coherent set of pages.
  const reviewFolder = data.dueReviews[0]?.folder;
  const reviewPageIds = data.dueReviews
    .filter((r) => r.folder.id === reviewFolder?.id)
    .slice(0, 5)
    .map((r) => r.pageId);

  // The single most useful thing to do right now.
  let nextStep: { title: string; body: string; action: React.ReactNode; icon: React.ReactNode };
  if (reviewFolder) {
    nextStep = {
      icon: <Sparkles className="size-5" />,
      title: `Review ${reviewFolder.name}`,
      body: `${reviewPageIds.length} ${reviewPageIds.length === 1 ? "page is" : "pages are"} starting to fade from memory. A quick quiz locks ${reviewPageIds.length === 1 ? "it" : "them"} back in${streakAtRisk ? " — and keeps your streak alive" : ""}.`,
      action: <ReviewButton folderId={reviewFolder.id} pageIds={reviewPageIds} label="Start review" size="default" variant="default" />,
    };
  } else if (streakAtRisk) {
    nextStep = {
      icon: <Flame className="size-5" />,
      title: `Keep your ${user.streakCount}-day streak alive`,
      body: "Finish a focus session, take a quiz, or write notes for 5 minutes today.",
      action: (
        <Button nativeButton={false} render={<Link href="/app/pomodoro"><Timer />Start focusing</Link>} />
      ),
    };
  } else if (todaysTasks.length > 0) {
    nextStep = {
      icon: <CalendarCheck2 className="size-5" />,
      title: todaysTasks[0].title,
      body: `Your top task for today${todaysTasks.length > 1 ? ` — ${todaysTasks.length - 1} more after this` : ""}. Pair it with a focus session.`,
      action: (
        <Button nativeButton={false} render={<Link href="/app/pomodoro"><Timer />Focus on it</Link>} />
      ),
    };
  } else if (!goalMet) {
    const left = user.dailyGoalMin - todayMinutes;
    nextStep = {
      icon: <Timer className="size-5" />,
      title: `${formatGoal(left)} to your daily goal`,
      body: "A single focus session will get you there. Notes you write count too.",
      action: (
        <Button nativeButton={false} render={<Link href="/app/pomodoro"><Timer />Start focusing</Link>} />
      ),
    };
  } else {
    nextStep = {
      icon: <PartyPopper className="size-5" />,
      title: "Daily goal complete",
      body: "Anything more today is a bonus. Test yourself on a folder to build mastery.",
      action: (
        <Button variant="outline" nativeButton={false} render={<Link href="/app/progress"><Trophy />See your progress</Link>} />
      ),
    };
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
          <h1 className="text-3xl font-semibold">
            {greetingFor(hour)}
            {firstName ? `, ${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}` : ""}
          </h1>
        </div>
        <Link href="/app/progress" className="w-full rounded-lg px-1 py-1 transition-opacity hover:opacity-80 sm:w-64">
          <LevelProgress xp={user.xp} />
        </Link>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-8">
          {/* Today: goal ring + streak */}
          <section className="flex flex-col gap-6 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:gap-8">
            <div className="flex items-center gap-4">
              <GoalRing minutes={todayMinutes} goal={user.dailyGoalMin} />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Today&apos;s goal</span>
                <span className="font-medium">
                  {goalMet ? "Goal complete" : `${formatGoal(user.dailyGoalMin - todayMinutes)} to go`}
                </span>
                <Link href="/app/settings" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                  Change goal
                </Link>
              </div>
            </div>

            <div className="hidden h-16 w-px bg-border sm:block" />

            <div className="flex flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex items-center gap-1.5">
                  <Flame className={cn("size-5", user.streakCount > 0 ? "fill-streak/25 text-streak" : "text-muted-foreground")} />
                  <span className="text-lg font-semibold tabular-nums">{user.streakCount}</span>
                  <span className="text-sm text-muted-foreground">day streak</span>
                </span>
                <span
                  className="flex items-center gap-1 text-sm text-muted-foreground"
                  title="Streak freezes protect your streak on a day you miss. You earn one every week (max 2)."
                >
                  <Snowflake className="size-4 text-frost" />
                  {user.streakFreezes} {user.streakFreezes === 1 ? "freeze" : "freezes"}
                </span>
              </div>
              <WeekStrip days={data.week} />
              {data.freezeUsedYesterday && (
                <p className="text-xs text-frost">A streak freeze covered yesterday — your streak is safe.</p>
              )}
            </div>
          </section>

          {/* Next step */}
          <section className="flex flex-col gap-4 rounded-xl border border-primary/25 bg-primary/[0.04] p-5 sm:flex-row sm:items-center">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {nextStep.icon}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-xs font-medium tracking-wide text-primary uppercase">Next step</span>
              <p className="truncate font-medium">{nextStep.title}</p>
              <p className="text-sm text-muted-foreground">{nextStep.body}</p>
            </div>
            <div className="shrink-0">{nextStep.action}</div>
          </section>

          {data.dueReviews.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeader icon={Sparkles} title="Due for review" />
              <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
                {data.dueReviews.slice(0, 5).map((r, i) => (
                  <Link
                    key={r.pageId}
                    href={`/app/folders/${r.folder.id}/pages/${r.pageId}`}
                    className={cn("flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent", i > 0 && "border-t")}
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{r.title || "Untitled"}</span>
                    <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                      <span className={cn("size-1.5 rounded-full", folderDotClass(r.folder.color))} />
                      {r.folder.name}
                    </span>
                    <MasteryBar value={r.mastery} />
                    <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{r.mastery}%</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <SectionHeader
              icon={CalendarCheck2}
              title="Due today"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  nativeButton={false}
                  render={
                    <Link href="/app/planner">
                      Open planner
                      <ArrowRight />
                    </Link>
                  }
                />
              }
            />
            {todaysTasks.length === 0 ? (
              <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed px-6 py-8 text-center">
                <p className="text-sm font-medium">You&apos;re all caught up</p>
                <p className="text-sm text-muted-foreground">
                  Nothing is due today. Plan ahead in the{" "}
                  <Link href="/app/planner" className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
                    planner
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {todaysTasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            )}
          </section>

          {data.recentPages.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeader icon={Clock} title="Recently edited" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.recentPages.map((page) => (
                  <Link
                    key={page.id}
                    href={`/app/folders/${page.folder.id}/pages/${page.id}`}
                    className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-accent"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{page.title || "Untitled"}</p>
                      <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <span className={cn("size-1.5 shrink-0 rounded-full", folderDotClass(page.folder.color))} />
                        {page.folder.name} · {formatDistanceToNowStrict(page.updatedAt, { addSuffix: true })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <SectionHeader
              icon={Trophy}
              title={`Achievements · ${data.unlockedCount}/${data.totalAchievements}`}
              action={
                <Button variant="ghost" size="sm" className="text-muted-foreground" nativeButton={false} render={<Link href="/app/progress">View all</Link>} />
              }
            />
            <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              {data.recentAchievements.length > 0 && (
                <div className="flex items-center gap-2">
                  {data.recentAchievements.map((a) => (
                    <span key={a.key} title={`${a.title} — ${a.description}`}>
                      <AchievementBadge icon={a.icon} unlocked size="sm" />
                    </span>
                  ))}
                  <span className="ml-1 text-xs text-muted-foreground">Recently unlocked</span>
                </div>
              )}
              {data.nextAchievements.map(({ def, current, target, ratio }) => (
                <div key={def.key} className="flex items-center gap-3">
                  <AchievementBadge icon={def.icon} unlocked={false} size="sm" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm">{def.title}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {current}/{target}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted-foreground/15">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(3, ratio * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader
              icon={Folder}
              title="Folders"
              action={
                <NewFolderDialog>
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="New folder">
                    <Plus />
                  </Button>
                </NewFolderDialog>
              }
            />
            {folders.length === 0 ? (
              <div className="flex flex-col gap-3 rounded-xl border border-dashed p-5">
                <p className="text-sm text-muted-foreground">Create a folder for each subject you&apos;re studying.</p>
                <NewFolderDialog />
              </div>
            ) : (
              <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
                {folders.map((folder, i) => {
                  const mastery = data.folderMastery[folder.id];
                  return (
                    <Link
                      key={folder.id}
                      href={`/app/folders/${folder.id}`}
                      className={cn("group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent", i > 0 && "border-t")}
                    >
                      <span className={cn("size-2 shrink-0 rounded-[3px]", folderDotClass(folder.color))} />
                      <span className="min-w-0 flex-1 truncate text-sm">{folder.name}</span>
                      {mastery !== undefined ? (
                        <span className="text-xs tabular-nums text-muted-foreground" title="Average mastery">
                          {mastery}%
                        </span>
                      ) : (
                        <span className="text-xs tabular-nums text-muted-foreground">{folder.pageCount}</span>
                      )}
                      <ChevronRight className="size-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
