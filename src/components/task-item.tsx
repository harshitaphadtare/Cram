"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Repeat, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
import { dateOnlyFromLocalDate, toLocalCalendarDate, todayDateOnly } from "@/lib/date-only";
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
          dueDate: recurring ? null : dueDate ? dateOnlyFromLocalDate(dueDate) : null,
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
              "group flex items-center gap-3 rounded-lg transition-all duration-300 ease-in-out",
              plain ? "px-2 py-1.5 hover:bg-accent" : "border bg-card px-3 py-2.5",
              vanishing && "scale-95 opacity-0",
            )}
          >
            <Checkbox checked={task.completed} onCheckedChange={handleToggle} disabled={pending} />
            <span className={cn("size-1.5 shrink-0 rounded-full", meta.dot)} />
            {task.recurring && (
              <Repeat className="size-3.5 shrink-0 text-primary" aria-label="Repeats every day" />
            )}
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className={cn(
                "flex-1 truncate text-left text-sm transition-all duration-300",
                (task.completed || vanishing) && "text-muted-foreground line-through",
              )}
            >
              {task.title}
            </button>
            {task.folder && !hideSubject && (
              <span className="hidden max-w-32 shrink-0 items-center gap-1.5 truncate text-xs text-muted-foreground sm:flex">
                <SubjectDot color={task.folder.color} />
                <span className="truncate">{task.folder.name}</span>
              </span>
            )}
            {displayDueDate && (
              <span
                className={cn(
                  "shrink-0 text-xs",
                  overdue ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {format(displayDueDate, "MMM d")}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={pending}
              aria-label="Delete task"
            >
              <Trash2 className="size-3.5" />
            </Button>
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
                  <SelectTrigger>
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
                  <p className="text-xs text-muted-foreground">Shown with a repeat icon, no fixed due date.</p>
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
