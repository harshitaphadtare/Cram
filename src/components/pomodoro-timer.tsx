"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { Flame, Pause, Play, RotateCcw, Settings, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubjectDot } from "@/components/subjects";
import { cn } from "@/lib/utils";
import { formatGoal } from "@/lib/goals";
import { formatClock, MODE_LABEL, usePomodoro, type Mode } from "@/components/pomodoro/pomodoro-provider";

const MODES: Mode[] = ["WORK", "SHORT_BREAK", "LONG_BREAK"];

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border px-1 py-px font-sans text-[0.625rem] leading-none text-muted-foreground">{children}</kbd>;
}

function TimerSettings() {
  const { settings, updateSettings } = usePomodoro();
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Timer settings" className="text-muted-foreground">
            <Settings />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-72">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium">Timer settings</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["workMin", "Focus", 90],
                ["shortBreakMin", "Short", 30],
                ["longBreakMin", "Long", 60],
              ] as const
            ).map(([key, label, max]) => (
              <div key={key} className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">{label} (min)</Label>
                <Input
                  type="number"
                  min={1}
                  max={max}
                  value={settings[key]}
                  onChange={(e) => updateSettings({ [key]: Number(e.target.value) })}
                />
              </div>
            ))}
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <Label className="text-sm font-normal">Start breaks automatically</Label>
              <p className="text-xs text-muted-foreground">When focus time is up, the break timer starts on its own.</p>
            </div>
            <Switch checked={settings.autoStartBreaks} onCheckedChange={(v) => updateSettings({ autoStartBreaks: v })} />
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <Label className="text-sm font-normal">Start focus automatically</Label>
              <p className="text-xs text-muted-foreground">When a break ends, the next focus session starts on its own.</p>
            </div>
            <Switch checked={settings.autoStartWork} onCheckedChange={(v) => updateSettings({ autoStartWork: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-sm font-normal">
              {settings.soundEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
              Sound
            </Label>
            <Switch checked={settings.soundEnabled} onCheckedChange={(v) => updateSettings({ soundEnabled: v })} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface LinkableTask {
  id: string;
  title: string;
  folder: { id: string; name: string; color: string } | null;
}

/** Tasks grouped under their subject (A–Z), with subject-less tasks last. */
function groupBySubject(tasks: LinkableTask[]) {
  const groups = new Map<string, { folder: LinkableTask["folder"]; tasks: LinkableTask[] }>();
  for (const task of tasks) {
    const key = task.folder?.id ?? "";
    if (!groups.has(key)) groups.set(key, { folder: task.folder, tasks: [] });
    groups.get(key)!.tasks.push(task);
  }
  return [...groups.values()].sort((a, b) =>
    !a.folder ? 1 : !b.folder ? -1 : a.folder.name.localeCompare(b.folder.name),
  );
}

function TaskSelect({ tasks }: { tasks: LinkableTask[] }) {
  const { taskId, setTaskId } = usePomodoro();
  if (tasks.length === 0) return null;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const groups = groupBySubject(tasks);

  return (
    <Select value={taskId ?? null} onValueChange={(v) => setTaskId(v ?? undefined)}>
      <SelectTrigger size="sm" className="max-w-64 border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground">
        <SelectValue placeholder="Link a task">
          {(v: string | null) => {
            const task = v ? byId.get(v) : undefined;
            if (!task) return "Link a task";
            return (
              <span className="flex min-w-0 items-center gap-2">
                {task.folder && <SubjectDot color={task.folder.color} />}
                <span className="truncate">{task.title}</span>
              </span>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end" className="max-h-80">
        {groups.map((group, i) => (
          <SelectGroup key={group.folder?.id ?? "none"}>
            {i > 0 && <SelectSeparator />}
            <SelectLabel className="flex items-center gap-2">
              {group.folder && <SubjectDot color={group.folder.color} />}
              {group.folder?.name ?? "No subject"}
            </SelectLabel>
            {group.tasks.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.title}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * The Pomodoro page's view of the app-wide timer (state lives in PomodoroProvider).
 *
 * Deliberately quiet: large light numerals, a segmented progress bar (one segment per session in
 * the cycle, the current one filling), and a single round play button. The page is pinned to the
 * exact space left under the top bar, so it never scrolls. Space starts/pauses, R resets, S skips.
 */
export function PomodoroTimer({
  tasks,
  todayMinutes,
  goalMinutes,
  streak,
}: {
  tasks: LinkableTask[];
  todayMinutes: number;
  goalMinutes: number;
  streak: number;
}) {
  const { settings, mode, secondsLeft, totalSeconds, isRunning, sessionsToday, startPause, reset, switchMode, taskId } =
    usePomodoro();

  const isBreak = mode !== "WORK";
  const skip = () =>
    switchMode(
      isBreak ? "WORK" : (sessionsToday + 1) % settings.longBreakInterval === 0 ? "LONG_BREAK" : "SHORT_BREAK",
    );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (e.code === "Space") {
        e.preventDefault();
        startPause();
      } else if (k === "r") reset();
      else if (k === "s") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const elapsed = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0;
  const cyclePosition = sessionsToday % settings.longBreakInterval;
  const started = secondsLeft < totalSeconds;
  const taskTitle = tasks.find((t) => t.id === taskId)?.title;

  const status = isRunning
    ? isBreak
      ? "Step away from the screen"
      : taskTitle
        ? `Focusing on ${taskTitle}`
        : "Focusing"
    : started
      ? "Paused"
      : isBreak
        ? "Time for a break"
        : "Ready to focus";

  return (
    // Exactly the height left under the 84px top bar and the layout padding, so nothing scrolls.
    <div className="-mb-10 flex h-[calc(100svh-8.25rem)] w-full flex-col md:h-[calc(100svh-9.25rem)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={cn(
                "relative rounded-md px-3 py-1 text-sm transition-colors",
                mode === m ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {mode === m && (
                <motion.span
                  layoutId="pomodoro-mode"
                  className="absolute inset-0 rounded-md bg-background shadow-sm"
                  transition={{ type: "spring", stiffness: 480, damping: 38 }}
                />
              )}
              <span className="relative">{MODE_LABEL[m]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <TaskSelect tasks={tasks} />
          <TimerSettings />
        </div>
      </div>

      {/* Stage */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(1.25rem,4svh,2.75rem)]">
        <div data-tour="pomodoro-timer" className="flex flex-col items-center">
          <p className="text-sm text-muted-foreground">{status}</p>
          <motion.p
            key={mode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-1 text-[clamp(4rem,15svh,8.5rem)] leading-none font-extralight tracking-[-0.04em] tabular-nums"
          >
            {formatClock(secondsLeft)}
          </motion.p>
        </div>

        {/* Segmented progress: one segment per session in the cycle; breaks get a single bar. */}
        <div className="flex w-[min(28rem,80vw)] flex-col items-center gap-2.5">
          <div className="flex w-full gap-1.5">
            {(isBreak ? [0] : Array.from({ length: settings.longBreakInterval }, (_, i) => i)).map((i) => {
              const fill = isBreak ? elapsed : i < cyclePosition ? 1 : i === cyclePosition ? elapsed : 0;
              return (
                <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-muted-foreground/15">
                  <span
                    className={cn("block h-full rounded-full transition-[width] duration-500 ease-linear", isBreak ? "bg-chart-3" : "bg-foreground")}
                    style={{ width: `${fill * 100}%` }}
                  />
                </span>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {isBreak ? MODE_LABEL[mode] : `Session ${cyclePosition + 1} of ${settings.longBreakInterval}`}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="icon-lg" onClick={reset} aria-label="Reset (R)" title="Reset (R)" className="rounded-full text-muted-foreground">
            <RotateCcw />
          </Button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={startPause}
            aria-label={isRunning ? "Pause (Space)" : "Start (Space)"}
            className="flex size-16 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-opacity hover:opacity-90"
          >
            {isRunning ? <Pause className="size-6" fill="currentColor" /> : <Play className="ml-0.5 size-6" fill="currentColor" />}
          </motion.button>
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={skip}
            aria-label={isBreak ? "Skip break (S)" : "Skip to break (S)"}
            title={isBreak ? "Skip break (S)" : "Skip to break (S)"}
            className="rounded-full text-muted-foreground"
          >
            <SkipForward />
          </Button>
        </div>
      </div>

      {/* Quiet footer */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 pb-1 text-xs text-muted-foreground sm:justify-between">
        <div className="flex items-center gap-4">
          <span>
            <span className="font-medium text-foreground tabular-nums">{formatGoal(todayMinutes)}</span> of{" "}
            {formatGoal(goalMinutes)} today
          </span>
          <span>
            <span className="font-medium text-foreground tabular-nums">{sessionsToday}</span>{" "}
            {sessionsToday === 1 ? "session" : "sessions"}
          </span>
          <span className="flex items-center gap-1">
            <Flame className={cn("size-3.5", streak > 0 ? "fill-streak/25 text-streak" : "")} />
            <span className="font-medium text-foreground tabular-nums">{streak}</span> day streak
          </span>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          <Kbd>Space</Kbd> start <Kbd>R</Kbd> reset <Kbd>S</Kbd> skip
        </div>
      </div>
    </div>
  );
}
