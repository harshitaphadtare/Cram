"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { PomodoroType } from "@/generated/prisma/enums";
import { logPomodoroSession } from "@/app/actions/pomodoro";
import { playPauseSound, playStartSound, playTimerDoneSound } from "@/lib/sounds";

export type Mode = "WORK" | "SHORT_BREAK" | "LONG_BREAK";

export interface PomodoroSettings {
  workMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  longBreakInterval: number;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
  soundEnabled: boolean;
}

export const DEFAULT_SETTINGS: PomodoroSettings = {
  workMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakInterval: 4,
  autoStartBreaks: true,
  autoStartWork: false,
  soundEnabled: true,
};

export const MODE_LABEL: Record<Mode, string> = {
  WORK: "Focus",
  SHORT_BREAK: "Short break",
  LONG_BREAK: "Long break",
};

const STORAGE_KEY = "cram-pomodoro-settings";
const TIMER_KEY = "cram-pomodoro-timer";
/** A session that ended longer ago than this while the app was closed is dropped, not logged. */
const STALE_AFTER_MS = 60 * 60 * 1000;

/** What survives a reload. A running timer is stored as its end time, so the countdown picks up
 * exactly where the clock says it should be, however long the page was gone. */
interface SavedTimer {
  mode: Mode;
  isRunning: boolean;
  isActive: boolean;
  /** Epoch ms the running session ends at. */
  endTime: number | null;
  /** Remaining seconds while paused. */
  secondsLeft: number;
  taskId?: string;
}

function loadTimer(): SavedTimer | null {
  try {
    const raw = window.localStorage.getItem(TIMER_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as SavedTimer;
    if (!["WORK", "SHORT_BREAK", "LONG_BREAK"].includes(t.mode)) return null;
    return t;
  } catch {
    return null;
  }
}

function loadSettings(): PomodoroSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function durationFor(mode: Mode, s: PomodoroSettings) {
  return (mode === "WORK" ? s.workMin : mode === "SHORT_BREAK" ? s.shortBreakMin : s.longBreakMin) * 60;
}

interface PomodoroContextValue {
  settings: PomodoroSettings;
  mode: Mode;
  secondsLeft: number;
  totalSeconds: number;
  isRunning: boolean;
  /** True once a session has been started and not reset — drives the top-bar mini timer. */
  isActive: boolean;
  sessionsToday: number;
  taskId: string | undefined;
  setTaskId: (id: string | undefined) => void;
  startPause: () => void;
  reset: () => void;
  switchMode: (mode: Mode) => void;
  updateSettings: (patch: Partial<PomodoroSettings>) => void;
}

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

export function usePomodoro() {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error("usePomodoro must be used inside <PomodoroProvider>");
  return ctx;
}

/**
 * Owns the Pomodoro timer for the whole app (mounted in the /app layout), so a session keeps
 * running while you move between pages — the Pomodoro page and the top-bar mini timer are just
 * views onto this state.
 */
export function PomodoroProvider({
  initialSessionsToday,
  children,
}: {
  initialSessionsToday: number;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<Mode>("WORK");
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SETTINGS.workMin * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [sessionsToday, setSessionsToday] = useState(initialSessionsToday);
  const [taskId, setTaskId] = useState<string | undefined>(undefined);
  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    const loaded = loadSettings();
    // One-time sync from localStorage on mount — the server has no access to it,
    // so this can't be a lazy initializer without causing a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loaded);

    const saved = loadTimer();
    const now = Date.now();
    if (saved?.isRunning && saved.endTime && now - saved.endTime < STALE_AFTER_MS) {
      // Still running (or finished moments ago — the tick below completes and logs it).
      endTimeRef.current = saved.endTime;
      setMode(saved.mode);
      setSecondsLeft(Math.max(0, Math.round((saved.endTime - now) / 1000)));
      setIsRunning(true);
      setIsActive(true);
      setTaskId(saved.taskId);
    } else if (saved && !saved.isRunning && saved.isActive) {
      // Paused mid-session.
      setMode(saved.mode);
      setSecondsLeft(Math.min(saved.secondsLeft, durationFor(saved.mode, loaded)));
      setIsActive(true);
      setTaskId(saved.taskId);
    } else {
      setMode(saved?.mode ?? "WORK");
      setSecondsLeft(durationFor(saved?.mode ?? "WORK", loaded));
      setTaskId(saved?.taskId);
    }
    restoredRef.current = true;
  }, []);

  // Persist on every state change (not every tick: a running timer is saved as its end time).
  useEffect(() => {
    if (!restoredRef.current) return;
    const saved: SavedTimer = {
      mode,
      isRunning,
      isActive,
      endTime: isRunning ? endTimeRef.current : null,
      secondsLeft: isRunning ? 0 : secondsLeft,
      taskId,
    };
    try {
      window.localStorage.setItem(TIMER_KEY, JSON.stringify(saved));
    } catch {
      // Storage unavailable — the timer just won't survive a reload.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isRunning, isActive, taskId, isRunning ? null : secondsLeft]);

  const goToMode = useCallback(
    (m: Mode, autoStart: boolean) => {
      setMode(m);
      setSecondsLeft(durationFor(m, settings));
      setIsRunning(autoStart);
      setIsActive(autoStart);
      endTimeRef.current = autoStart ? Date.now() + durationFor(m, settings) * 1000 : null;
    },
    [settings],
  );

  const handleComplete = useCallback(async () => {
    setIsRunning(false);
    if (settings.soundEnabled) playTimerDoneSound();
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(mode === "WORK" ? "Focus session done!" : "Break's over", {
        body: mode === "WORK" ? "Nice work. Time for a break." : "Back to it when you're ready.",
      });
    }

    try {
      const { xpGained } = await logPomodoroSession({
        type: mode as PomodoroType,
        durationMin: durationFor(mode, settings) / 60,
        taskId: mode === "WORK" ? (taskId ?? null) : null,
      });
      if (mode === "WORK") {
        setSessionsToday((n) => n + 1);
        toast.success("Focus session complete", {
          description: xpGained > 0 ? `+${xpGained} XP earned. Take a breather.` : "Take a breather.",
        });
      }
    } catch {
      toast.error("Couldn't save that session, but your timer still ran.");
    }

    if (mode === "WORK") {
      const next: Mode = (sessionsToday + 1) % settings.longBreakInterval === 0 ? "LONG_BREAK" : "SHORT_BREAK";
      goToMode(next, settings.autoStartBreaks);
    } else {
      goToMode("WORK", settings.autoStartWork);
    }
  }, [mode, settings, sessionsToday, taskId, goToMode]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    if (endTimeRef.current === null) endTimeRef.current = Date.now() + secondsLeft * 1000;

    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.round(((endTimeRef.current ?? 0) - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        void handleComplete();
      }
    }, 250);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  // Show the countdown in the browser tab while a session is running.
  useEffect(() => {
    if (!isActive) return;
    const original = document.title;
    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const ss = String(secondsLeft % 60).padStart(2, "0");
    document.title = `${mm}:${ss} · ${MODE_LABEL[mode]}`;
    return () => {
      document.title = original;
    };
  }, [isActive, secondsLeft, mode]);

  const startPause = useCallback(() => {
    if (!isRunning) {
      if (settings.soundEnabled) playStartSound();
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        void Notification.requestPermission();
      }
      endTimeRef.current = Date.now() + secondsLeft * 1000;
      setIsRunning(true);
      setIsActive(true);
    } else {
      if (settings.soundEnabled) playPauseSound();
      setIsRunning(false);
      endTimeRef.current = null;
    }
  }, [isRunning, secondsLeft, settings.soundEnabled]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setIsActive(false);
    endTimeRef.current = null;
    setSecondsLeft(durationFor(mode, settings));
  }, [mode, settings]);

  const updateSettings = useCallback(
    (patch: Partial<PomodoroSettings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable — settings just won't persist.
      }
      if (!isRunning) setSecondsLeft(durationFor(mode, next));
    },
    [settings, isRunning, mode],
  );

  const value = useMemo<PomodoroContextValue>(
    () => ({
      settings,
      mode,
      secondsLeft,
      totalSeconds: durationFor(mode, settings),
      isRunning,
      isActive,
      sessionsToday,
      taskId,
      setTaskId,
      startPause,
      reset,
      switchMode: (m: Mode) => goToMode(m, false),
      updateSettings,
    }),
    [settings, mode, secondsLeft, isRunning, isActive, sessionsToday, taskId, startPause, reset, goToMode, updateSettings],
  );

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
}

export function formatClock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
