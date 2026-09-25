"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Plus, Repeat, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIORITY_META, PRIORITY_ORDER } from "@/lib/task-priority";
import { cn } from "@/lib/utils";
import { TaskPriority } from "@/generated/prisma/enums";
import { createTask } from "@/app/actions/tasks";
import { dateOnlyFromLocalDate, dateOnlyStringToUTCDate, relativeDayLabel, toLocalCalendarDate } from "@/lib/date-only";
import { parseTaskText } from "@/lib/parse-task-text";
import { SubjectSelect } from "@/components/subjects";

export function NewTaskForm({
  defaultDueDate,
  defaultFolderId = null,
  compact = false,
  lockSubject = false,
}: {
  defaultDueDate?: Date;
  defaultFolderId?: string | null;
  /** Box variant: title + subject only, no date/priority controls. */
  compact?: boolean;
  /** Subject is fixed to `defaultFolderId` (e.g. inside that folder) — hides the picker. */
  lockSubject?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);
  const [dueDate, setDueDate] = useState<Date | undefined>(defaultDueDate);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.P3);
  // Date phrases the user chose to keep as plain text ("tomorrow" in "prep for tomorrow's quiz").
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const mirrorRef = useRef<HTMLDivElement>(null);

  // Live preview only — the title text itself is left untouched while typing so the cursor
  // doesn't jump; the detected phrase is only actually stripped out at submit time.
  const detected = useMemo(() => parseTaskText(title, dismissed), [title, dismissed]);

  function handleTitleChange(value: string) {
    setTitle(value);
    // Forget dismissals for phrases that were deleted, so retyping one highlights it again.
    const lower = value.toLowerCase();
    setDismissed((d) => (d.some((p) => !lower.includes(p)) ? d.filter((p) => lower.includes(p)) : d));
  }

  function keepAsText() {
    if (detected.match) setDismissed((d) => [...d, detected.match!.text.toLowerCase()]);
  }

  function pickDate(date: Date | undefined) {
    // Choosing a date by hand overrides whatever was typed — the phrase stays in the title.
    keepAsText();
    setDueDate(date);
  }

  // Todoist-style: Backspace right after a highlighted phrase first un-highlights it (keeping the
  // text) instead of deleting a character. The next Backspace deletes as normal.
  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Backspace" || !detected.match) return;
    const { selectionStart, selectionEnd } = e.currentTarget;
    const end = detected.match.index + detected.match.text.length;
    if (selectionStart === selectionEnd && selectionStart === end) {
      e.preventDefault();
      keepAsText();
    }
  }

  function syncMirrorScroll(e: React.SyntheticEvent<HTMLInputElement>) {
    if (mirrorRef.current) mirrorRef.current.scrollLeft = e.currentTarget.scrollLeft;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      try {
        const usesDetection = detected.recurring || detected.dueDate !== null;
        await createTask({
          title: usesDetection ? detected.title : title,
          priority,
          folderId,
          recurring: detected.recurring,
          dueDate: detected.recurring
            ? dateOnlyFromLocalDate(new Date())
            : (detected.dueDate ?? (dueDate ? dateOnlyFromLocalDate(dueDate) : null)),
        });
        setTitle("");
        setDismissed([]);
        setPriority(TaskPriority.P3);
        setDueDate(defaultDueDate);
      } catch {
        toast.error("Couldn't add the task.");
      }
    });
  }

  const previewDate = detected.dueDate ? toLocalCalendarDate(dateOnlyStringToUTCDate(detected.dueDate)) : null;

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Add a to-do…"
            className={!lockSubject ? "basis-full" : "flex-1"}
          />
          {!lockSubject && (
            <SubjectSelect value={folderId} onChange={setFolderId} className="min-w-0 flex-1" />
          )}
          <Button type="submit" disabled={pending || !title.trim()} size="icon" aria-label="Add task">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>
        </div>
        {(detected.recurring || previewDate) && (
          <div className="flex items-center gap-1.5 pl-0.5 text-xs text-primary">
            {detected.recurring ? (
              <>
                <Repeat className="size-3.5" />
                Repeats every day
              </>
            ) : (
              <>
                <CalendarIcon className="size-3.5" />
                Due {format(previewDate!, "MMM d, yyyy")}
              </>
            )}
          </div>
        )}
      </form>
    );
  }

  const detectedActive = detected.recurring || previewDate !== null;
  const dateLabel = detected.recurring
    ? "Every day"
    : previewDate
      ? relativeDayLabel(previewDate)
      : dueDate
        ? relativeDayLabel(dueDate)
        : "No date";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border bg-card shadow-xs transition-colors focus-within:border-ring/60 focus-within:ring-3 focus-within:ring-ring/15"
    >
      <div className="relative">
        {/* The input's own text is transparent; this mirror draws it so the detected date phrase
            can be highlighted in place, Todoist-style. Both must share padding, font and line height. */}
        <div
          ref={mirrorRef}
          aria-hidden
          className={cn(TITLE_TEXT, "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre")}
        >
          {detected.match ? (
            <>
              {title.slice(0, detected.match.index)}
              {/* Horizontal padding would push the text out of line with the input, so the tint is
                  widened with side shadows instead; vertical padding doesn't affect layout inline. */}
              <mark className="rounded-[4px] bg-primary/15 py-0.5 text-primary shadow-[-4px_0_0_var(--hl),4px_0_0_var(--hl)] [--hl:color-mix(in_oklab,var(--primary)_15%,transparent)]">
                {detected.match.text}
              </mark>
              {title.slice(detected.match.index + detected.match.text.length)}
            </>
          ) : (
            title
          )}
        </div>
        <input
          value={title}
          onChange={(e) => {
            handleTitleChange(e.target.value);
            syncMirrorScroll(e);
          }}
          onKeyDown={handleTitleKeyDown}
          onScroll={syncMirrorScroll}
          onSelect={syncMirrorScroll}
          placeholder="What do you need to do?"
          aria-label="Task title"
          className={cn(
            TITLE_TEXT,
            "relative w-full bg-transparent text-transparent caret-foreground outline-none placeholder:text-muted-foreground/70",
          )}
        />
      </div>
      <p className="px-4 text-xs text-muted-foreground/70">
        {detected.match
          ? "Date picked up from your text. Press Backspace to keep it as plain text."
          : "Tip: type “tomorrow”, “friday” or “every day” and the date is set for you."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t px-2.5 py-2">
        {!lockSubject && (
          <SubjectSelect value={folderId} onChange={setFolderId} className={cn(CHIP, "max-w-44")} />
        )}

        <div
          className={cn(
            "inline-flex h-7 items-center rounded-md bg-muted/60 text-xs text-foreground/90",
            detectedActive && "bg-primary/15 text-primary",
          )}
        >
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label="Set due date"
                  className={cn(
                    "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 hover:bg-muted",
                    detectedActive && "pr-1.5 hover:bg-primary/10",
                  )}
                >
                  {detected.recurring ? <Repeat className="size-3.5" /> : <CalendarIcon className="size-3.5" />}
                  {dateLabel}
                </button>
              }
            />
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dueDate} onSelect={pickDate} />
            </PopoverContent>
          </Popover>
          {detectedActive && (
            <button
              type="button"
              onClick={keepAsText}
              aria-label={`Keep “${detected.match?.text}” as plain text`}
              title="Keep as plain text"
              className="mr-1 inline-flex size-5 items-center justify-center rounded hover:bg-primary/20"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
          <SelectTrigger size="sm" className={CHIP} aria-label="Priority">
            <SelectValue>
              {(v: TaskPriority) => (
                <span className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", PRIORITY_META[v].dot)} />
                  {PRIORITY_META[v].label}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_ORDER.map((p) => (
              <SelectItem key={p} value={p}>
                <span className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", PRIORITY_META[p].dot)} />
                  {PRIORITY_META[p].label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="submit" size="sm" disabled={pending || !title.trim()} className="ml-auto px-3">
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          Add task
        </Button>
      </div>
    </form>
  );
}

/** Shared by the title input and its highlight mirror so their text lines up exactly. */
const TITLE_TEXT = "px-4 pt-3.5 pb-2 text-base leading-6";

/** Soft pill style shared by the composer's toolbar controls. */
const CHIP =
  "h-7 rounded-md border-transparent bg-muted/60 text-xs text-foreground/90 shadow-none hover:bg-muted dark:bg-muted/60 dark:hover:bg-muted";
