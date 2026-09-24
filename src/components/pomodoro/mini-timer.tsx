"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { formatClock, MODE_LABEL, usePomodoro } from "@/components/pomodoro/pomodoro-provider";
import { cn } from "@/lib/utils";

/** Compact timer for the top bar while a session is running elsewhere in the app. */
export function MiniTimer() {
  const { isActive, isRunning, secondsLeft, mode, startPause } = usePomodoro();
  const pathname = usePathname();
  if (!isActive || pathname === "/app/pomodoro") return null;

  const isBreak = mode !== "WORK";
  return (
    <div className="flex h-7 items-center rounded-full border bg-card pr-1 pl-2.5 text-sm">
      <Link href="/app/pomodoro" className="flex items-center gap-2" title="Open Pomodoro">
        <span
          className={cn(
            "size-1.5 rounded-full",
            isBreak ? "bg-chart-3" : "bg-primary",
            isRunning && "animate-pulse",
          )}
        />
        <span className="font-medium tabular-nums">{formatClock(secondsLeft)}</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">{MODE_LABEL[mode]}</span>
      </Link>
      <button
        type="button"
        onClick={startPause}
        aria-label={isRunning ? "Pause timer" : "Resume timer"}
        className="ml-1.5 flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        {isRunning ? <Pause className="size-3" /> : <Play className="size-3" />}
      </button>
    </div>
  );
}
