"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Map as MapIcon, Plus, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SubjectDot, useSubjects } from "@/components/subjects";
import { addRoadmapItem, deleteRoadmapItem, toggleRoadmapItem } from "@/app/actions/roadmap";
import { playTaskCompleteSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";

export interface RoadmapTopic {
  id: string;
  folderId: string;
  title: string;
  done: boolean;
}

type Change =
  | { type: "add"; item: RoadmapTopic }
  | { type: "toggle"; id: string; done: boolean }
  | { type: "delete"; id: string };

/**
 * Per-subject syllabus checklist: every topic you need to cover, with a progress bar. Pick the
 * subject from the header; ticking a topic off earns a little XP.
 */
export function RoadmapBox({
  items,
  initialFolderId,
  locked = false,
}: {
  items: RoadmapTopic[];
  initialFolderId: string | null;
  /** Fixed to one subject (e.g. on its folder page) — hides the subject switcher. */
  locked?: boolean;
}) {
  const subjects = useSubjects();
  const [folderId, setFolderId] = useState<string | null>(initialFolderId ?? subjects[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();
  const [optimistic, apply] = useOptimistic(items, (state: RoadmapTopic[], change: Change) => {
    switch (change.type) {
      case "add":
        return [...state, change.item];
      case "toggle":
        return state.map((i) => (i.id === change.id ? { ...i, done: change.done } : i));
      case "delete":
        return state.filter((i) => i.id !== change.id);
    }
  });

  const subject = subjects.find((s) => s.id === folderId);
  const topics = optimistic.filter((i) => i.folderId === folderId);
  const done = topics.filter((t) => t.done).length;
  const percent = topics.length ? Math.round((done / topics.length) * 100) : 0;
  const countBySubject = new Map<string, { done: number; total: number }>();
  for (const i of optimistic) {
    const c = countBySubject.get(i.folderId) ?? { done: 0, total: 0 };
    c.total++;
    if (i.done) c.done++;
    countBySubject.set(i.folderId, c);
  }

  function run(change: Change, action: () => Promise<unknown>, failure: string) {
    startTransition(async () => {
      apply(change);
      try {
        await action();
      } catch {
        toast.error(failure);
      }
    });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title || !folderId) return;
    setDraft("");
    run(
      { type: "add", item: { id: `temp-${Date.now()}`, folderId, title, done: false } },
      () => addRoadmapItem(folderId, title),
      "Couldn't add that topic.",
    );
  }

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <MapIcon className="size-4 text-muted-foreground" />
          Roadmap
        </h2>
        {subjects.length > 0 && !locked && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex max-w-44 items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
              {subject && <SubjectDot color={subject.color} />}
              <span className="truncate">{subject?.name ?? "Pick a subject"}</span>
              <ChevronDown className="size-3.5 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {subjects.map((s) => {
                const c = countBySubject.get(s.id);
                return (
                  <DropdownMenuItem key={s.id} onClick={() => setFolderId(s.id)}>
                    <SubjectDot color={s.color} />
                    <span className="flex-1 truncate">{s.name}</span>
                    {c && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {c.done}/{c.total}
                      </span>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {!subject ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Create a folder for a subject to start its roadmap.</p>
      ) : (
        <>
          {topics.length > 0 && (
            <div className="flex flex-col gap-1.5 px-4 pt-3">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">
                  {done} of {topics.length} topics covered
                </span>
                <span className="font-medium tabular-nums">{percent}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted-foreground/15">
                <div
                  className={cn("cram-grow-x h-full rounded-full transition-[width] duration-500", percent === 100 ? "bg-chart-3" : "bg-primary")}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}

          <ul className="flex max-h-72 flex-col overflow-y-auto px-2 py-2">
            {topics.length === 0 && (
              <li className="px-2 py-3 text-sm text-muted-foreground">
                List every topic you need to cover for {subject.name}, then tick them off as you go.
              </li>
            )}
            {topics.map((t) => (
              <li key={t.id} className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent">
                <Checkbox
                  checked={t.done}
                  disabled={t.id.startsWith("temp-")}
                  onCheckedChange={(checked) => {
                    if (checked) playTaskCompleteSound();
                    run({ type: "toggle", id: t.id, done: !!checked }, () => toggleRoadmapItem(t.id, !!checked), "Couldn't update that topic.");
                  }}
                  aria-label={`Mark ${t.title} as ${t.done ? "not covered" : "covered"}`}
                />
                <span className={cn("min-w-0 flex-1 text-sm", t.done && "text-muted-foreground line-through")}>{t.title}</span>
                {!t.id.startsWith("temp-") && (
                  <button
                    type="button"
                    onClick={() => run({ type: "delete", id: t.id }, () => deleteRoadmapItem(t.id), "Couldn't remove that topic.")}
                    className="flex size-5 items-center justify-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                    aria-label={`Remove ${t.title}`}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          <form onSubmit={add} className="flex items-center gap-2 border-t px-4 py-2">
            <Plus className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a topic…"
              className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </form>
        </>
      )}
    </section>
  );
}
