import "server-only";
import { prisma } from "@/lib/prisma";
import { PomodoroType } from "@/generated/prisma/enums";
import type { User } from "@/generated/prisma/client";
import { listVisibleFolders } from "@/lib/data/folders";
import { addDays, userToday } from "@/lib/gamification";

/**
 * Progress → "Where your time went": study time per folder (focus sessions on the folder's tasks +
 * writing its notes), per task that has no folder (focus sessions), and "Unsorted" (focus with no
 * task, and note-writing from before it was tracked per folder), over a week, month or year.
 */

export type TimeRange = "week" | "month" | "year";
export const TIME_RANGES: TimeRange[] = ["week", "month", "year"];

/** Chart colour slots (see .cram-viz in globals.css). Past these, entities fold into "Other". */
const SERIES_SLOTS = 8;

export interface TimeEntity {
  key: string;
  label: string;
  kind: "folder" | "task" | "unassigned" | "other";
  /** 1-based colour slot for folders/tasks; null for the grey Unsorted/Other. */
  slot: number | null;
  seconds: number;
  /** What the time was spent on: each task (focus sessions) and "Writing notes", largest first. */
  parts: { label: string; seconds: number }[];
}

export interface TimeColumn {
  /** Short axis label ("Mon", "12", "Jan"). */
  label: string;
  /** Tooltip heading ("Mon, Oct 5", "October"). */
  fullLabel: string;
  /** After today: drawn empty. */
  future: boolean;
  isToday: boolean;
  /** Seconds per entity key. */
  seconds: Record<string, number>;
  total: number;
}

export interface TimeBreakdown {
  range: TimeRange;
  offset: number;
  periodLabel: string;
  total: number;
  /** Days in the period with any study time. */
  activeDays: number;
  entities: TimeEntity[];
  columns: TimeColumn[];
}

/** The calendar date `instant` falls on in `timezone`, as UTC midnight (how dates are stored). */
function localDate(instant: Date, timezone: string): Date {
  const fmt = (tz?: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
  let ymd: string;
  try {
    ymd = fmt(timezone);
  } catch {
    ymd = fmt("UTC");
  }
  return new Date(`${ymd}T00:00:00.000Z`);
}

function period(range: TimeRange, offset: number, today: Date) {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  if (range === "week") {
    const monday = addDays(today, -((today.getUTCDay() + 6) % 7) + offset * 7);
    return { start: monday, end: addDays(monday, 7) };
  }
  if (range === "month") {
    return { start: new Date(Date.UTC(y, m + offset, 1)), end: new Date(Date.UTC(y, m + offset + 1, 1)) };
  }
  return { start: new Date(Date.UTC(y + offset, 0, 1)), end: new Date(Date.UTC(y + offset + 1, 0, 1)) };
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" });
const fmtWeekday = fmt({ weekday: "short" });
const fmtDayFull = fmt({ weekday: "short", month: "short", day: "numeric" });
const fmtMonthDay = fmt({ month: "short", day: "numeric" });
const fmtMonthShort = fmt({ month: "short" });
const fmtMonthLong = fmt({ month: "long" });
const fmtMonthYear = fmt({ month: "long", year: "numeric" });

function periodLabel(range: TimeRange, start: Date, end: Date, today: Date) {
  if (range === "year") return String(start.getUTCFullYear());
  if (range === "month") return fmtMonthYear.format(start);
  const last = addDays(end, -1);
  const sameYear = start.getUTCFullYear() === today.getUTCFullYear() && last.getUTCFullYear() === today.getUTCFullYear();
  const withYear = fmt({ month: "short", day: "numeric", year: "numeric" });
  return sameYear
    ? `${fmtMonthDay.format(start)} – ${fmtMonthDay.format(last)}`
    : `${withYear.format(start)} – ${withYear.format(last)}`;
}

export async function getTimeBreakdown(user: User, range: TimeRange, offset: number): Promise<TimeBreakdown> {
  const today = userToday(user.timezone);
  const { start, end } = period(range, offset, today);
  // Sessions are stored as instants; widen by a day each side, then bucket by the local date.
  const since = user.progressResetAt && user.progressResetAt > addDays(start, -1) ? user.progressResetAt : addDays(start, -1);

  const [folders, sessions, noteTime, logs, taskOrder] = await Promise.all([
    listVisibleFolders(user.id),
    prisma.pomodoroSession.findMany({
      where: {
        userId: user.id,
        type: PomodoroType.WORK,
        completed: true,
        startedAt: { gte: since, lt: addDays(end, 1) },
      },
      select: { startedAt: true, durationMin: true, task: { select: { id: true, title: true, folderId: true } } },
    }),
    prisma.folderStudyTime.findMany({
      where: { userId: user.id, date: { gte: start, lt: end } },
      select: { folderId: true, date: true, seconds: true },
    }),
    prisma.streakLog.findMany({
      where: { userId: user.id, date: { gte: start, lt: end } },
      select: { date: true, seconds: true },
    }),
    // Every folderless task ever focused on, oldest first: gives each a stable colour slot.
    prisma.pomodoroSession.groupBy({
      by: ["taskId"],
      where: { userId: user.id, type: PomodoroType.WORK, task: { folderId: null } },
      _min: { startedAt: true },
    }),
  ]);

  // Colour slots follow the entity, not its rank: folders in sidebar order, then folderless tasks
  // in the order they were first focused on. The same folder keeps its colour in every range.
  const folderById = new Map(folders.map((f) => [f.id, f]));
  const globalOrder = [
    ...folders.map((f) => `f:${f.id}`),
    ...taskOrder
      .filter((t) => t.taskId)
      .sort((a, b) => (a._min.startedAt?.getTime() ?? 0) - (b._min.startedAt?.getTime() ?? 0))
      .map((t) => `t:${t.taskId}`),
  ];
  const slotOf = new Map(globalOrder.slice(0, SERIES_SLOTS).map((key, i) => [key, i + 1]));

  // Per day (or month, for a year) → entity → seconds.
  const bucketOf = (date: Date) =>
    range === "year" ? `${date.getUTCFullYear()}-${date.getUTCMonth()}` : date.toISOString().slice(0, 10);
  const perBucket = new Map<string, Map<string, number>>();
  const perDayTracked = new Map<string, number>();
  const labels = new Map<string, string>();
  // Entity → what it was spent on (task title, "Writing notes"…) → seconds.
  const parts = new Map<string, Map<string, number>>();
  const add = (date: Date, key: string, seconds: number, part: string) => {
    if (seconds <= 0 || date < start || date >= end) return;
    const b = bucketOf(date);
    const m = perBucket.get(b) ?? new Map<string, number>();
    m.set(key, (m.get(key) ?? 0) + seconds);
    perBucket.set(b, m);
    const p = parts.get(key) ?? new Map<string, number>();
    p.set(part, (p.get(part) ?? 0) + seconds);
    parts.set(key, p);
  };
  const track = (date: Date, seconds: number) => {
    const d = date.toISOString().slice(0, 10);
    perDayTracked.set(d, (perDayTracked.get(d) ?? 0) + seconds);
  };

  for (const s of sessions) {
    if (user.progressResetAt && s.startedAt < user.progressResetAt) continue;
    const date = localDate(s.startedAt, user.timezone);
    const seconds = s.durationMin * 60;
    let key = "u";
    let part = "Focus with no task";
    if (s.task?.folderId && folderById.has(s.task.folderId)) {
      key = `f:${s.task.folderId}`;
      part = s.task.title;
    } else if (s.task && !s.task.folderId) {
      key = `t:${s.task.id}`;
      part = "Focus sessions";
      labels.set(key, s.task.title);
    } else if (s.task) {
      part = s.task.title; // its folder is no longer shared with you
    }
    add(date, key, seconds, part);
    if (date >= start && date < end) track(date, seconds);
  }
  for (const n of noteTime) {
    add(n.date, folderById.has(n.folderId) ? `f:${n.folderId}` : "u", n.seconds, "Writing notes");
    track(n.date, n.seconds);
  }
  // Whatever the day's total holds beyond what's attributed (note-writing from before it was
  // tracked per folder) is Unsorted, so this always adds up to the rest of Progress.
  for (const l of logs) {
    const d = l.date.toISOString().slice(0, 10);
    add(l.date, "u", l.seconds - (perDayTracked.get(d) ?? 0), "Notes from before folders were tracked");
  }

  // Entities with any time in the period; ones without a colour slot fold into "Other".
  const totals = new Map<string, number>();
  for (const m of perBucket.values()) for (const [k, s] of m) totals.set(k, (totals.get(k) ?? 0) + s);
  const fold = (key: string) => (key === "u" || slotOf.has(key) ? key : "o");
  const folded = new Map<string, number>();
  for (const [k, s] of totals) folded.set(fold(k), (folded.get(fold(k)) ?? 0) + s);

  const labelOf = (key: string) =>
    key.startsWith("f:") ? (folderById.get(key.slice(2))?.name ?? "Folder") : (labels.get(key) ?? "Task");
  const partsOf = (key: string) =>
    key === "o"
      ? // Other lists the folders/tasks folded into it.
        [...totals].filter(([k]) => fold(k) === "o").map(([k, s]) => ({ label: labelOf(k), seconds: s }))
      : [...(parts.get(key) ?? [])].map(([label, s]) => ({ label, seconds: s }));

  const entities: TimeEntity[] = [...folded]
    .map(([key, seconds]): TimeEntity => {
      const p = partsOf(key).sort((a, b) => b.seconds - a.seconds);
      if (key === "u") return { key, label: "Unsorted", kind: "unassigned", slot: null, seconds, parts: p };
      if (key === "o") return { key, label: "Other", kind: "other", slot: null, seconds, parts: p };
      // A folderless task is its own entity; "Focus sessions" under it would only repeat it.
      const kind = key.startsWith("f:") ? "folder" : "task";
      return { key, label: labelOf(key), kind, slot: slotOf.get(key) ?? null, seconds, parts: kind === "task" ? [] : p };
    })
    .sort((a, b) => {
      // Named entities by time; Unsorted and Other always last.
      const rank = (e: TimeEntity) => (e.kind === "unassigned" || e.kind === "other" ? 1 : 0);
      return rank(a) - rank(b) || b.seconds - a.seconds;
    });

  // Columns: days for a week or month, months for a year.
  const columns: TimeColumn[] = [];
  const pushColumn = (date: Date, label: string, fullLabel: string, isToday: boolean) => {
    const raw = perBucket.get(bucketOf(date)) ?? new Map<string, number>();
    const seconds: Record<string, number> = {};
    for (const [k, s] of raw) seconds[fold(k)] = (seconds[fold(k)] ?? 0) + s;
    const total = Object.values(seconds).reduce((a, b) => a + b, 0);
    columns.push({ label, fullLabel, future: date > today, isToday, seconds, total });
  };
  if (range === "year") {
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(start.getUTCFullYear(), i, 1));
      const isThisMonth = d.getUTCFullYear() === today.getUTCFullYear() && i === today.getUTCMonth();
      pushColumn(d, fmtMonthShort.format(d), fmtMonthLong.format(d), isThisMonth);
    }
  } else {
    for (let d = start; d < end; d = addDays(d, 1)) {
      pushColumn(d, range === "week" ? fmtWeekday.format(d) : String(d.getUTCDate()), fmtDayFull.format(d), d.getTime() === today.getTime());
    }
  }

  const activeDays = new Set(
    [...perDayTracked.keys(), ...logs.filter((l) => l.seconds > 0).map((l) => l.date.toISOString().slice(0, 10))].filter((d) => {
      const date = new Date(`${d}T00:00:00.000Z`);
      return date >= start && date < end;
    }),
  ).size;

  return {
    range,
    offset,
    periodLabel: periodLabel(range, start, end, today),
    total: entities.reduce((a, e) => a + e.seconds, 0),
    activeDays,
    entities,
    columns,
  };
}

export const MAX_TIME_OFFSET = { week: 520, month: 120, year: 10 } as const;
