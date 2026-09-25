/**
 * Helpers for "date-only" values (task due dates) stored as UTC midnight representing a
 * calendar day. Storing them this way — rather than round-tripping through `toISOString()`,
 * which shifts across midnight for any non-UTC timezone — keeps "today" consistent between the
 * browser and the server regardless of which side of UTC the user's timezone falls on.
 */

export function dateOnlyFromLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dateOnlyStringToUTCDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Converts a stored UTC-anchored date-only value into a local Date carrying the same calendar
 * numbers — safe to hand to date-fns `format()` or a date picker's `selected` prop. */
export function toLocalCalendarDate(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Today's calendar date (per the local clock of whoever/whatever calls this), UTC-anchored to
 * match stored due dates. */
export function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** "Today" / "Tomorrow" / "Yesterday", otherwise a short weekday + date, for a local calendar date. */
export function relativeDayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return day.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(day.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
}
