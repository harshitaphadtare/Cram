"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { Coffee, Flame, Pause, Play, RotateCcw, Settings, Target, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GoalRing } from "@/components/gamification/goal-ring";
import { cn } from "@/lib/utils";
import { formatGoal } from "@/lib/goals";
import { formatClock, MODE_LABEL, usePomodoro, type Mode } from "@/components/pomodoro/pomodoro-provider";

const VIEW = 300;
const STROKE = 7;
const R = (VIEW - STROKE * 2) / 2;
const C = 2 * Math.PI * R;
const MODES: Mode[] = ["WORK", "SHORT_BREAK", "LONG_BREAK"];

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">{children}</kbd>;
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
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["workMin", "Focus", 90],
                ["shortBreakMin", "Short", 30],
                ["longBreakMin", "Long", 60],
              ] as const
            ).map(([key, label, max]) => (
              <div key={key} className="flex flex-col gap-1">
                <Label className="text-xs">{label}</Label>
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

function TaskPicker({ tasks, className }: { tasks: { id: string; title: string }[]; className?: string }) {
  const { taskId, setTaskId } = usePomodoro();
  if (tasks.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Add tasks in the planner to focus on one.</p>;
  }
  return (
    <Select value={taskId ?? null} onValueChange={(v) => setTaskId(v ?? undefined)}>
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder="Pick a task (optional)" />
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
}

/**
 * The Pomodoro page's view of the app-wide timer (state lives in PomodoroProvider). Sized to the
 * window so nothing scrolls: the ring scales with viewport height, side panels appear on wide
 * screens. Space starts/pauses, R resets.
 */
export function PomodoroTimer({
  tasks,
  todayMinutes,
  goalMinutes,
  streak,
}: {
  tasks: { id: string; title: string }[];
  todayMinutes: number;
  goalMinutes: number;
  streak: number;
}) {
  const { settings, mode, secondsLeft, totalSeconds, isRunning, sessionsToday, startPause, reset, switchMode } =
    usePomodoro();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        startPause();
      } else if (e.key.toLowerCase() === "r") {
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startPause, reset]);

  const remaining = totalSeconds > 0 ? secondsLeft / totalSeconds : 1;
  const isBreak = mode !== "WORK";
  const cyclePosition = sessionsToday % settings.longBreakInterval;
  // Position of the glowing dot at the head of the arc.
  const angle = remaining * 2 * Math.PI - Math.PI / 2;
  const headX = VIEW / 2 + R * Math.cos(angle);
  const headY = VIEW / 2 + R * Math.sin(angle);
  const accent = isBreak ? "var(--chart-3)" : "var(--primary)";

  return (
    <div className="mx-auto grid h-[calc(100svh-11rem)] max-h-[860px] min-h-[500px] w-full max-w-5xl grid-rows-[auto_1fr_auto] md:h-[calc(100svh-12rem)]">
      {/* Mode switcher with a sliding pill */}
      <div className="flex justify-center">
        <div className="flex gap-1 rounded-full border bg-muted/60 p-1">
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
                  className="absolute inset-0 rounded-full bg-background shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">{MODE_LABEL[m]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
        {/* Today */}
        <aside className="hidden flex-col gap-5 justify-self-start rounded-2xl border bg-card p-5 lg:flex">
          <p className="text-sm font-medium text-muted-foreground">Today</p>
          <div className="flex items-center gap-4">
            <GoalRing minutes={todayMinutes} goal={goalMinutes} size={76} stroke={7} />
            <div className="flex flex-col gap-1 text-sm">
              <span className="flex items-center gap-1.5">
                <Target className="size-3.5 text-muted-foreground" />
                {todayMinutes >= goalMinutes ? "Goal complete" : `${formatGoal(goalMinutes - todayMinutes)} to go`}
              </span>
              <span className="flex items-center gap-1.5">
                <Flame className="size-3.5 text-streak" />
                {streak} day streak
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sessions</span>
              <span className="font-medium tabular-nums">{sessionsToday}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Until long break</span>
              <span className="flex gap-1">
                {Array.from({ length: settings.longBreakInterval }, (_, i) => (
                  <span key={i} className={cn("size-2 rounded-full", i < cyclePosition ? "bg-primary" : "bg-muted-foreground/20")} />
                ))}
              </span>
            </div>
          </div>
        </aside>

        {/* Timer */}
        <div className="flex min-h-0 flex-col items-center gap-[clamp(1rem,3svh,2rem)]">
          <div
            data-tour="pomodoro-timer"
            className="relative aspect-square"
            style={{ width: "min(20rem, 42svh, 80vw)" }}
          >
            {/* Ambient glow that breathes while the timer runs */}
            <div
              aria-hidden
              className={cn(
                "absolute inset-[12%] rounded-full blur-3xl transition-opacity duration-700",
                isRunning ? "animate-pulse opacity-30" : "opacity-10",
              )}
              style={{ background: accent }}
            />
            <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="relative size-full">
              <circle cx={VIEW / 2} cy={VIEW / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-muted-foreground/12" />
              {/* Remaining time drains clockwise */}
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
                <circle cx={headX} cy={headY} r={STROKE * 0.95} style={{ fill: accent }} className="drop-shadow-[0_0_6px_currentColor]" />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {isBreak ? <Coffee className="size-3.5" /> : null}
                {isBreak ? MODE_LABEL[mode] : `Session ${sessionsToday + 1}`}
              </span>
              <span className="text-[clamp(2.75rem,9svh,4.75rem)] leading-none font-light tabular-nums tracking-tight">
                {formatClock(secondsLeft)}
              </span>
              <span className="text-sm text-muted-foreground">
                {isRunning ? (isBreak ? "Rest your eyes" : "Stay with it") : isBreak ? "Take a breather" : "Ready to focus"}
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
                className="h-12 w-40 gap-2 rounded-full text-[15px] shadow-lg shadow-primary/20"
                onClick={startPause}
                style={isBreak ? { background: "var(--chart-3)" } : undefined}
              >
                {isRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
                {isRunning ? "Pause" : secondsLeft < totalSeconds ? "Resume" : "Start"}
              </Button>
            </motion.div>
            <TimerSettings />
          </div>
        </div>

        {/* Working on */}
        <aside className="hidden flex-col gap-4 justify-self-end rounded-2xl border bg-card p-5 lg:flex lg:w-64">
          <p className="text-sm font-medium text-muted-foreground">Working on</p>
          <TaskPicker tasks={tasks} />
          <div className="flex flex-col gap-2 border-t pt-4 text-sm text-muted-foreground">
            <span className="flex items-center justify-between">
              Start / pause <Kbd>Space</Kbd>
            </span>
            <span className="flex items-center justify-between">
              Reset <Kbd>R</Kbd>
            </span>
          </div>
        </aside>
      </div>

      {/* Small screens: task picker under the timer */}
      <div className="mx-auto w-full max-w-sm lg:hidden">
        <TaskPicker tasks={tasks} />
      </div>
      <p className="hidden text-center text-xs text-muted-foreground lg:block">
        The timer keeps running while you browse your notes — watch it in the top bar.
      </p>
    </div>
  );
}
