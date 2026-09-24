"use client";

import { Pause, Play, RotateCcw, Settings, Volume2, VolumeX } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { formatClock, MODE_LABEL, usePomodoro, type Mode } from "@/components/pomodoro/pomodoro-provider";

const RING_SIZE = 288;
const RING_STROKE = 6;

/** The Pomodoro page's view of the app-wide timer (state lives in PomodoroProvider). */
export function PomodoroTimer({ tasks }: { tasks: { id: string; title: string }[] }) {
  const {
    settings,
    mode,
    secondsLeft,
    totalSeconds,
    isRunning,
    sessionsToday,
    taskId,
    setTaskId,
    startPause,
    reset,
    switchMode,
    updateSettings,
  } = usePomodoro();

  const r = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const elapsed = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0;
  const isBreak = mode !== "WORK";
  const cyclePosition = sessionsToday % settings.longBreakInterval;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-10">
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(["WORK", "SHORT_BREAK", "LONG_BREAK"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-sm font-medium transition",
              mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>

      <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={r}
            fill="none"
            strokeWidth={RING_STROKE}
            className="stroke-muted-foreground/12"
          />
          {/* Remaining time: the arc drains clockwise as the session runs. */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={r}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * elapsed}
            className={cn("transition-[stroke-dashoffset] duration-300 ease-linear", isBreak ? "stroke-chart-3" : "stroke-primary")}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span className="text-[4.25rem] leading-none font-light tabular-nums tracking-tight">
            {formatClock(secondsLeft)}
          </span>
          <span className="text-sm text-muted-foreground">
            {isBreak ? (isRunning ? "Rest your eyes" : MODE_LABEL[mode]) : isRunning ? "Stay with it" : "Ready to focus"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2" aria-label={`${cyclePosition} of ${settings.longBreakInterval} sessions until a long break`}>
        {Array.from({ length: settings.longBreakInterval }, (_, i) => (
          <span
            key={i}
            className={cn("size-2 rounded-full", i < cyclePosition ? "bg-primary" : "bg-muted-foreground/20")}
          />
        ))}
        <span className="ml-1 text-xs text-muted-foreground">
          {sessionsToday} {sessionsToday === 1 ? "session" : "sessions"} today
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-lg" onClick={reset} aria-label="Reset timer" className="text-muted-foreground">
          <RotateCcw />
        </Button>
        <Button size="lg" className="h-11 w-36 gap-2 rounded-full text-[15px]" onClick={startPause}>
          {isRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
          {isRunning ? "Pause" : "Start"}
        </Button>
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="ghost" size="icon-lg" aria-label="Timer settings" className="text-muted-foreground">
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
      </div>

      {tasks.length > 0 && mode === "WORK" && (
        <div className="flex w-full flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Working on (optional)</Label>
          <Select value={taskId ?? null} onValueChange={(v) => setTaskId(v ?? undefined)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="No task selected" />
            </SelectTrigger>
            <SelectContent>
              {tasks.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        The timer keeps running while you browse your notes — watch it in the top bar.
      </p>
    </div>
  );
}
