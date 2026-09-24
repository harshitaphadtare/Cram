"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Plus, Repeat } from "lucide-react";
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
import { dateOnlyFromLocalDate, dateOnlyStringToUTCDate, toLocalCalendarDate } from "@/lib/date-only";
import { parseTaskText } from "@/lib/parse-task-text";
import { SubjectSelect } from "@/components/subjects";

export function NewTaskForm({
  defaultDueDate,
  defaultFolderId = null,
  compact = false,
}: {
  defaultDueDate?: Date;
  defaultFolderId?: string | null;
  /** Dashboard variant: title + subject only, no date/priority controls. */
  compact?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);
  const [dueDate, setDueDate] = useState<Date | undefined>(defaultDueDate);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.P4);
  const [pending, startTransition] = useTransition();

  // Live preview only — the title text itself is left untouched while typing so the cursor
  // doesn't jump; the detected phrase is only actually stripped out at submit time.
  const detected = useMemo(() => parseTaskText(title), [title]);

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
            ? null
            : (detected.dueDate ?? (dueDate ? dateOnlyFromLocalDate(dueDate) : null)),
        });
        setTitle("");
        setPriority(TaskPriority.P4);
        setDueDate(defaultDueDate);
      } catch {
        toast.error("Couldn't add the task.");
      }
    });
  }

  const previewDate = detected.dueDate ? toLocalCalendarDate(dateOnlyStringToUTCDate(detected.dueDate)) : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className={cn("flex items-center gap-2", compact && "flex-wrap")}>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={compact ? "Add a to-do…" : "Add a task… try “review notes tomorrow” or “stretch everyday”"}
          className={compact ? "basis-full" : "flex-1"}
        />
        <SubjectSelect
          value={folderId}
          onChange={setFolderId}
          className={compact ? "min-w-0 flex-1" : "hidden w-44 sm:flex"}
        />
        {!compact && (
          <>
            <Popover>
              <PopoverTrigger
                render={
                  <Button type="button" variant="outline" size="icon" aria-label="Set due date">
                    <CalendarIcon className="size-4" />
                  </Button>
                }
              />
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={dueDate} onSelect={setDueDate} />
              </PopoverContent>
            </Popover>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger className="w-32">
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
                    {PRIORITY_META[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        <Button type="submit" disabled={pending || !title.trim()} size="icon" aria-label="Add task">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>
        {!detected.recurring && !previewDate && dueDate && (
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {format(dueDate, "MMM d")}
          </span>
        )}
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
