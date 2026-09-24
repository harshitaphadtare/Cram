"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Pause, Play, RotateCcw, Settings, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GoalRing } from "@/components/gamification/goal-ring";
import { cn } from "@/lib/utils";
import { formatGoal } from "@/lib/goals";
import { formatClock, MODE_LABEL, usePomodoro, type Mode } from "@/components/pomodoro/pomodoro-provider";

const VIEW = 300;
const STROKE = 6;
const R = (VIEW - STROKE * 2) / 2 - 6;
const C = 2 * Math.PI * R;
const MODES: Mode[] = ["WORK", "SHORT_BREAK", "LONG_BREAK"];

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

function TimerSettings() {
  const { settings, updateSettings } = usePomodoro();
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-lg" aria-label="Timer settings" className="rounded-full text-muted-foreground">
            <Settings />
          </Button>
        }
      />
      <PopoverContent className="w-72">
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
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal">Auto-start breaks</Label>
            <Switch checked={settings.autoStartBreaks} onCheckedChange={(v) => updateSettings({ autoStartBreaks: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal">Auto-start focus</Label>
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

/** One card with everything about today's session: goal, cycle, and the task being worked on. */
function TodayCard({
  tasks,
  todayMinutes,
  goalMinutes,
  className,
  compact = false,
}: {
  tasks: { id: string; title: string }[];
  todayMinutes: number;
  goalMinutes: number;
  className?: string;
  /** Single-row version for narrower screens, where there's no room beside the timer. */
  compact?: boolean;
}) {
  const { settings, sessionsToday, taskId, setTaskId } = usePomodoro();
  const cyclePosition = sessionsToday % settings.longBreakInterval;
  const untilLongBreak = settings.longBreakInterval - cyclePosition;
  const left = Math.max(0, goalMinutes - todayMinutes);

  const taskPicker =
    tasks.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        No open tasks.{" "}
        <Link href="/app/planner" className="text-foreground underline-offset-4 hover:underline">
          Add one
        </Link>
      </p>
    ) : (
      <Select value={taskId ?? null} onValueChange={(v) => setTaskId(v ?? undefined)}>
        <SelectTrigger className={compact ? "w-48" : "w-full"}>
          <SelectValue placeholder="Choose a task" />
        </SelectTrigger>
        <SelectContent>
          {tasks.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );

  if (compact) {
    return (
      <section className={cn("flex items-center gap-4 rounded-xl border bg-card py-2 pr-2 pl-3 text-sm", className)}>
        <GoalRing minutes={todayMinutes} goal={goalMinutes} size={40} stroke={4} />
        <div className="leading-tight">
          <p className="font-medium">{left === 0 ? "Goal complete" : `${formatGoal(left)} to go`}</p>
          <p className="text-muted-foreground">Long break in {untilLongBreak}</p>
        </div>
        <span className="h-8 w-px bg-border" />
        {taskPicker}
      </section>
    );
  }

  return (
    <section className={cn("w-72 rounded-xl border bg-card", className)}>
      <div className="flex items-center gap-4 p-4">
        <GoalRing minutes={todayMinutes} goal={goalMinutes} size={64} stroke={6} />
        <div className="min-w-0">
          <p className="text-sm font-medium">Today&apos;s goal</p>
          <p className="text-sm text-muted-foreground">{left === 0 ? "Complete" : `${formatGoal(left)} to go`}</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
        <div>
          <p className="font-medium tabular-nums">
            {sessionsToday} {sessionsToday === 1 ? "session" : "sessions"}
          </p>
          <p className="text-muted-foreground">Long break in {untilLongBreak}</p>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: settings.longBreakInterval }, (_, i) => (
            <span
              key={i}
              className={cn("h-1.5 w-4 rounded-full transition-colors", i < cyclePosition ? "bg-primary" : "bg-muted-foreground/20")}
            />
          ))}
        </div>
      </div>

      <div className="border-t p-4">
        <p className="mb-2 text-sm font-medium">Working on</p>
        {taskPicker}
      </div>
    </section>
  );
}

/**
 * The Pomodoro page's view of the app-wide timer (state lives in PomodoroProvider). Pinned to the
 * exact height left under the top bar, so it never scrolls. Space starts/pauses and R resets.
 */
export function PomodoroTimer({
  tasks,
  todayMinutes,
  goalMinutes,
}: {
  tasks: { id: string; title: string }[];
  todayMinutes: number;
  goalMinutes: number;
}) {
  const { mode, secondsLeft, totalSeconds, isRunning, sessionsToday, startPause, reset, switchMode } = usePomodoro();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        startPause();
      } else if (e.key.toLowerCase() === "r") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startPause, reset]);

  const isBreak = mode !== "WORK";
  const remaining = totalSeconds > 0 ? secondsLeft / totalSeconds : 1;
  const started = secondsLeft < totalSeconds;
  const accent = isBreak ? "var(--chart-3)" : "var(--primary)";
  const angle = remaining * 2 * Math.PI - Math.PI / 2;

  return (
    // Exactly the height left under the 84px top bar and the layout padding, so nothing scrolls.
    <div className="relative -mb-10 flex h-[calc(100svh-8.25rem)] w-full flex-col md:h-[calc(100svh-9.25rem)]">
      <TodayCard
        tasks={tasks}
        todayMinutes={todayMinutes}
        goalMinutes={goalMinutes}
        className="absolute top-0 left-0 z-10 hidden xl:block"
      />

      <div className="flex justify-center">
        <div className="flex gap-1 rounded-full border bg-muted/50 p-1">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={cn(
                "relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                mode === m ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {mode === m && (
                <motion.span
                  layoutId="pomodoro-mode"
                  className="absolute inset-0 rounded-full bg-background shadow-sm ring-1 ring-border"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{MODE_LABEL[m]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(1.25rem,4svh,2.5rem)]">
        <div data-tour="pomodoro-timer" className="relative aspect-square" style={{ width: "min(21rem, 50svh, 84vw)" }}>
          <div
            aria-hidden
            className={cn("absolute inset-[15%] rounded-full blur-3xl transition-opacity duration-700", isRunning ? "opacity-25" : "opacity-10")}
            style={{ background: accent }}
          />
          <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="relative size-full">
            <circle cx={VIEW / 2} cy={VIEW / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-muted-foreground/12" />
            <circle
              cx={VIEW / 2}
              cy={VIEW / 2}
              r={R}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - remaining)}
              transform={`rotate(-90 ${VIEW / 2} ${VIEW / 2})`}
              style={{ stroke: accent }}
              className="transition-[stroke-dashoffset] duration-300 ease-linear"
            />
            {remaining > 0.002 && (
              <circle
                cx={VIEW / 2 + R * Math.cos(angle)}
                cy={VIEW / 2 + R * Math.sin(angle)}
                r={STROKE}
                style={{ fill: accent }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm text-muted-foreground">
              {isBreak ? MODE_LABEL[mode] : `Session ${sessionsToday + 1}`}
            </span>
            <span className="mt-2 text-[clamp(3rem,10svh,4.5rem)] leading-none font-semibold tracking-[-0.03em] tabular-nums">
              {formatClock(secondsLeft)}
            </span>
            <span className="mt-3 text-sm text-muted-foreground">
              {isRunning ? (isBreak ? "Rest your eyes" : "Stay with it") : started ? "Paused" : isBreak ? "Take a breather" : "Ready to focus"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-lg" onClick={reset} aria-label="Reset timer" className="rounded-full text-muted-foreground">
            <RotateCcw />
          </Button>
          <motion.div whileTap={{ scale: 0.96 }}>
            <Button
              size="lg"
              className="h-12 w-40 gap-2 rounded-full text-[15px]"
              onClick={startPause}
              style={isBreak ? { background: "var(--chart-3)" } : undefined}
            >
              {isRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
              {isRunning ? "Pause" : started ? "Resume" : "Start"}
            </Button>
          </motion.div>
          <TimerSettings />
        </div>

        {/* Below xl there's no room beside the timer; a one-row version sits underneath instead. */}
        <TodayCard tasks={tasks} todayMinutes={todayMinutes} goalMinutes={goalMinutes} compact className="xl:hidden" />
      </div>
    </div>
  );
}
