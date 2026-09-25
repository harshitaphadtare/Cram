"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlignLeft, CalendarIcon, Check, Loader2, Pencil, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PRIORITY_META, PRIORITY_ORDER } from "@/lib/task-priority";
import { TaskPriority } from "@/generated/prisma/enums";
import { deleteTask, toggleTask, updateTask } from "@/app/actions/tasks";
import { dateOnlyFromLocalDate, relativeDayLabel, toLocalCalendarDate, todayDateOnly } from "@/lib/date-only";
import { playTaskCompleteSound } from "@/lib/sounds";
import { SubjectDot, SubjectSelect } from "@/components/subjects";

const COMPLETE_ANIMATION_MS = 450;

export interface TaskView {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  priority: TaskPriority;
  completed: boolean;
  recurring: boolean;
  folderId?: string | null;
  folder?: { id: string; name: string; color: string } | null;
}

/** Card that holds a list of task rows, separated by hairlines. */
export function TaskList({ children }: { children: React.ReactNode }) {
  return <div className="divide-y overflow-hidden rounded-xl border bg-card">{children}</div>;
}

export function TaskItem({
  task,
  hideSubject = false,
  plain = false,
}: {
  task: TaskView;
  hideSubject?: boolean;
  /** Borderless row, for lists that already sit inside a card. */
  plain?: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.dueDate ? toLocalCalendarDate(task.dueDate) : undefined,
  );
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [recurring, setRecurring] = useState(task.recurring);
  const [folderId, setFolderId] = useState<string | null>(task.folderId ?? null);
  const [vanishing, setVanishing] = useState(false);
  const [pending, startTransition] = useTransition();

  function commitToggle(checked: boolean) {
    startTransition(async () => {
      try {
        await toggleTask(task.id, checked);
        if (checked && task.recurring) {
          // The task comes back with tomorrow's date rather than disappearing — show it again.
          setVanishing(false);
          toast.success("Done for today — it's back tomorrow.");
        }
      } catch {
        toast.error("Couldn't update the task.");
        setVanishing(false);
      }
    });
  }

  function handleToggle(checked: boolean) {
    if (checked) {
      playTaskCompleteSound();
      setVanishing(true);
      setTimeout(() => commitToggle(true), COMPLETE_ANIMATION_MS);
    } else {
      commitToggle(false);
    }
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateTask(task.id, {
          title,
          priority,
          recurring,
          folderId,
          dueDate: dueDate
            ? dateOnlyFromLocalDate(dueDate)
            : recurring
              ? dateOnlyFromLocalDate(new Date())
              : null,
        });
        setEditOpen(false);
      } catch {
        toast.error("Couldn't save changes.");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteTask(task.id);
      } catch {
        toast.error("Couldn't delete the task.");
      }
    });
  }

  const meta = PRIORITY_META[task.priority];
  const overdue = task.dueDate && !task.completed && task.dueDate < todayDateOnly();
  const displayDueDate = task.dueDate ? toLocalCalendarDate(task.dueDate) : null;
  const dueLabel = displayDueDate ? relativeDayLabel(displayDueDate) : null;
  const done = task.completed || vanishing;
  const hasMeta = Boolean(dueLabel || task.recurring || task.description);

  return (
    <>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-in-out",
          vanishing ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
        )}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "group flex items-center gap-3 transition-all duration-300 ease-in-out",
              plain ? "rounded-lg px-2 py-2 hover:bg-accent" : "px-4 py-3 hover:bg-muted/40",
              vanishing && "scale-[0.98] opacity-0",
            )}
          >
            {/* Round, priority-coloured checkbox (Todoist-style): the ring says how urgent it is. */}
            <button
              type="button"
              role="checkbox"
              aria-checked={done}
              aria-label={done ? "Mark as not done" : "Mark as done"}
              disabled={pending}
              onClick={() => handleToggle(!task.completed)}
              className={cn(
                "group/check flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors disabled:opacity-60",
                meta.check,
                done && cn(meta.dot, "border-transparent text-background"),
              )}
            >
              <Check
                strokeWidth={3}
                className={cn(
                  "size-2.5 transition-opacity",
                  done ? "opacity-100" : "opacity-0 group-hover/check:opacity-100",
                )}
              />
            </button>

            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex min-w-0 flex-1 flex-col gap-1 text-left"
            >
              <span
                className={cn(
                  "truncate text-sm leading-[18px] transition-colors duration-300",
                  done && "text-muted-foreground line-through",
                )}
              >
                {task.title}
              </span>
              {hasMeta && (
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  {dueLabel && (
                    <span
                      className={cn(
                        "flex items-center gap-1",
                        overdue && "text-destructive",
                        !overdue && dueLabel === "Today" && "text-[oklch(0.7_0.14_155)]",
                      )}
                    >
                      <CalendarIcon className="size-3" />
                      {dueLabel}
                    </span>
                  )}
                  {task.recurring && (
                    <span className="flex items-center gap-1">
                      <Repeat className="size-3" />
                      Daily
                    </span>
                  )}
                  {task.description && <AlignLeft className="size-3" aria-label="Has notes" />}
                </span>
              )}
            </button>

            <div className="flex shrink-0 items-center gap-1">
              <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground"
                  onClick={() => setEditOpen(true)}
                  aria-label="Edit task"
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={handleDelete}
                  disabled={pending}
                  aria-label="Delete task"
                >
                  <Trash2 />
                </Button>
              </div>
              {task.folder && !hideSubject && (
                <span className="hidden max-w-40 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                  <span className="truncate">{task.folder.name}</span>
                  <SubjectDot color={task.folder.color} />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger className="w-full">
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
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Label>Due date</Label>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button variant="outline" className="justify-start font-normal">
                        <CalendarIcon className="size-4" />
                        {dueDate ? format(dueDate, "MMM d, yyyy") : "No date"}
                      </Button>
                    }
                  />
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dueDate} onSelect={setDueDate} />
                    {dueDate && (
                      <div className="border-t p-2">
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setDueDate(undefined)}>
                          Clear date
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Subject</Label>
              <SubjectSelect value={folderId} onChange={setFolderId} className="w-full" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Repeat className="size-4 text-muted-foreground" />
                <div>
                  <Label className="font-normal">Repeats every day</Label>
                  <p className="text-xs text-muted-foreground">Moves to the next day each time you tick it off.</p>
                </div>
              </div>
              <Switch checked={recurring} onCheckedChange={setRecurring} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={pending || !title.trim()}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
