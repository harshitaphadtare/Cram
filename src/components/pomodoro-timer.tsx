"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { ChevronDown, Flame, Pause, Play, RotateCcw, Settings, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatGoal } from "@/lib/goals";
import { formatClock, MODE_LABEL, usePomodoro, type Mode } from "@/components/pomodoro/pomodoro-provider";

const VIEW = 320;
const CENTER = VIEW / 2;
const R = 146; // progress ring
const TICK_OUTER = 132;
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
          <Button variant="ghost" size="icon" aria-label="Timer settings" className="rounded-full text-muted-foreground">
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

/** A quiet pill under the mode switcher for picking the task this session is for. */
function TaskPill({ tasks }: { tasks: { id: string; title: string }[] }) {
  const { taskId, setTaskId, mode } = usePomodoro();
  if (mode !== "WORK") return <p className="h-8 text-sm text-muted-foreground">Step away from the screen for a bit.</p>;
  if (tasks.length === 0) {
    return <p className="h-8 text-sm text-muted-foreground">Add tasks in the planner to focus on one.</p>;
  }
  return (
    <Select value={taskId ?? null} onValueChange={(v) => setTaskId(v ?? undefined)}>
      <SelectTrigger className="h-8 max-w-80 gap-1.5 rounded-full border-transparent bg-transparent px-3 text-sm text-muted-foreground shadow-none hover:bg-accent hover:text-foreground [&>svg:last-child]:hidden">
        <SelectValue placeholder="What are you working on?" />
        <ChevronDown className="size-3.5 opacity-60" />
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

/** Watch-face ring: minute ticks, a thin progress arc that drains clockwise, and a glowing head. */
function Dial({ remaining, accent, running }: { remaining: number; accent: string; running: boolean }) {
  const angle = remaining * 2 * Math.PI - Math.PI / 2;
  const headX = CENTER + R * Math.cos(angle);
  const headY = CENTER + R * Math.sin(angle);
  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="relative size-full overflow-visible">
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * 2 * Math.PI - Math.PI / 2;
        const major = i % 5 === 0;
        const len = major ? 9 : 4;
        const lit = i / 60 < remaining;
        return (
          <line
            key={i}
            x1={CENTER + TICK_OUTER * Math.cos(a)}
            y1={CENTER + TICK_OUTER * Math.sin(a)}
            x2={CENTER + (TICK_OUTER - len) * Math.cos(a)}
            y2={CENTER + (TICK_OUTER - len) * Math.sin(a)}
            strokeWidth={major ? 1.6 : 1}
            strokeLinecap="round"
            className={cn("transition-colors duration-500", lit ? "stroke-muted-foreground/45" : "stroke-muted-foreground/12")}
          />
        );
      })}
      <circle cx={CENTER} cy={CENTER} r={R} fill="none" strokeWidth={3} className="stroke-muted-foreground/12" />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={R}
        fill="none"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - remaining)}
        transform={`rotate(-90 ${CENTER} ${CENTER})`}
        style={{ stroke: accent }}
        className="transition-[stroke-dashoffset] duration-300 ease-linear"
      />
      {remaining > 0.002 && (
        <>
          <circle cx={headX} cy={headY} r={11} style={{ fill: accent }} className={cn("opacity-20", running && "animate-pulse")} />
          <circle cx={headX} cy={headY} r={5.5} style={{ fill: accent }} />
        </>
      )}
    </svg>
  );
}

/**
 * The Pomodoro page's view of the app-wide timer (state lives in PomodoroProvider): one calm
 * focus stage that always fits the window. Space starts/pauses, R resets, S skips.
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

  const isBreak = mode !== "WORK";
  const skip = () =>
    switchMode(
      isBreak
        ? "WORK"
        : (sessionsToday + 1) % settings.longBreakInterval === 0
          ? "LONG_BREAK"
          : "SHORT_BREAK",
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

  const remaining = totalSeconds > 0 ? secondsLeft / totalSeconds : 1;
  const cyclePosition = sessionsToday % settings.longBreakInterval;
  const accent = isBreak ? "var(--chart-3)" : "var(--primary)";
  const goalProgress = Math.min(1, goalMinutes > 0 ? todayMinutes / goalMinutes : 0);
  const started = secondsLeft < totalSeconds;

  return (
    <div className="mx-auto flex h-[calc(100svh-11rem)] max-h-[900px] min-h-[540px] w-full max-w-3xl flex-col items-center justify-between md:h-[calc(100svh-12rem)]">
      {/* Mode + task */}
      <div className="flex w-full flex-col items-center gap-2">
        <div className="relative flex w-full items-center justify-center">
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
          <div className="absolute right-0">
            <TimerSettings />
          </div>
        </div>
        <TaskPill tasks={tasks} />
      </div>

      {/* Dial */}
      <div data-tour="pomodoro-timer" className="relative aspect-square" style={{ width: "min(23rem, 46svh, 86vw)" }}>
        <div
          aria-hidden
          className={cn(
            "absolute inset-[18%] rounded-full blur-3xl transition-opacity duration-1000",
            isRunning ? "opacity-25" : "opacity-[0.08]",
          )}
          style={{ background: accent }}
        />
        <Dial remaining={remaining} accent={accent} running={isRunning} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            {isBreak ? MODE_LABEL[mode] : `Session ${sessionsToday + 1}`}
          </span>
          <span className="mt-1 text-[clamp(3rem,10svh,5.5rem)] leading-none font-extralight tabular-nums tracking-tight">
            {formatClock(secondsLeft)}
          </span>
          <span className="mt-3 text-sm text-muted-foreground">
            {isRunning ? (isBreak ? "Breathe. Stretch. Hydrate." : "Deep work in progress") : started ? "Paused" : isBreak ? "Break time" : "Ready when you are"}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-5">
        <Button variant="ghost" size="icon-lg" onClick={reset} aria-label="Reset timer" className="rounded-full text-muted-foreground">
          <RotateCcw />
        </Button>
        <motion.div whileTap={{ scale: 0.96 }}>
          <Button
            size="lg"
            className="h-12 w-44 gap-2 rounded-full text-[15px] shadow-lg shadow-primary/20 transition-colors"
            onClick={startPause}
            style={isBreak ? { background: "var(--chart-3)" } : undefined}
          >
            {isRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
            {isRunning ? "Pause" : started ? "Resume" : isBreak ? "Start break" : "Start focus"}
          </Button>
        </motion.div>
        <Button
          variant="ghost"
          size="icon-lg"
          onClick={skip}
          aria-label={isBreak ? "Skip break" : "Skip to break"}
          title={isBreak ? "Skip break" : "Skip to break"}
          className="rounded-full text-muted-foreground"
        >
          <SkipForward />
        </Button>
      </div>

      {/* Status strip */}
      <div className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-2xl border bg-card/60 px-5 py-3 text-sm">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">Today</span>
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted-foreground/15">
            <span
              className={cn("block h-full rounded-full transition-[width] duration-700", goalProgress >= 1 ? "bg-chart-3" : "bg-primary")}
              style={{ width: `${Math.max(3, goalProgress * 100)}%` }}
            />
          </span>
          <span className="tabular-nums">
            {formatGoal(todayMinutes)} <span className="text-muted-foreground">/ {formatGoal(goalMinutes)}</span>
          </span>
        </div>
        <span className="hidden h-4 w-px bg-border sm:block" />
        <div className="flex items-center gap-2.5">
          <span className="text-muted-foreground">Sessions</span>
          <span className="font-medium tabular-nums">{sessionsToday}</span>
          <span className="flex gap-1" title={`${settings.longBreakInterval - cyclePosition} until a long break`}>
            {Array.from({ length: settings.longBreakInterval }, (_, i) => (
              <span key={i} className={cn("size-1.5 rounded-full", i < cyclePosition ? "bg-primary" : "bg-muted-foreground/25")} />
            ))}
          </span>
        </div>
        <span className="hidden h-4 w-px bg-border sm:block" />
        <div className="flex items-center gap-1.5">
          <Flame className={cn("size-4", streak > 0 ? "fill-streak/25 text-streak" : "text-muted-foreground")} />
          <span className="tabular-nums">{streak}</span>
          <span className="text-muted-foreground">day streak</span>
        </div>
        <span className="hidden h-4 w-px bg-border lg:block" />
        <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
          <Kbd>Space</Kbd> start/pause <Kbd>R</Kbd> reset <Kbd>S</Kbd> skip
        </div>
      </div>
    </div>
  );
}
