import * as chrono from "chrono-node";
import { dateOnlyFromLocalDate } from "@/lib/date-only";

const RECURRING_PATTERN = /\b(every ?day|everyday|daily)\b/gi;

/** "for 30 mins", "in 2 hours", "45m" — a length of time, not a due date. */
const SUB_DAY_DURATION =
  /^(?:for|in|within|after)?\s*(?:an?|\d+(?:\.\d+)?)\s*(?:s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?)$/i;

export interface ParsedTaskText {
  /** Title with any recognized date/recurrence phrase stripped out. */
  title: string;
  /** "YYYY-MM-DD", set only when a date phrase was found and it isn't a recurring task. */
  dueDate: string | null;
  recurring: boolean;
  /** Where the recognized phrase sits in the raw text, so the input can highlight it. */
  match: { index: number; text: string } | null;
}

/** Reads natural language out of a quick-add task title — "today", "tomorrow", "next friday",
 * "sep 25", "everyday" — and turns it into a due date / recurring flag, leaving a clean title.
 * Phrases listed in `ignore` (case-insensitive) were dismissed by the user and stay plain text. */
export function parseTaskText(raw: string, ignore: string[] = []): ParsedTaskText {
  const ignored = new Set(ignore.map((s) => s.toLowerCase()));
  const strip = (index: number, text: string) =>
    (raw.slice(0, index) + raw.slice(index + text.length)).replace(/\s+/g, " ").trim();

  for (const m of raw.matchAll(RECURRING_PATTERN)) {
    if (ignored.has(m[0].toLowerCase())) continue;
    return {
      title: strip(m.index, m[0]),
      dueDate: null,
      recurring: true,
      match: { index: m.index, text: m[0] },
    };
  }

  // Use the first phrase that names a day and wasn't dismissed, and strip just that substring.
  // Durations and bare times ("for 30 mins", "at 5pm") parse as "some time today" in chrono,
  // but they describe the task, not when it's due — so only phrases that pin a day count.
  const match = chrono
    .parse(raw, new Date(), { forwardDate: true })
    .find(
      (r) =>
        !ignored.has(r.text.toLowerCase()) &&
        !SUB_DAY_DURATION.test(r.text.trim()) &&
        (r.start.isCertain("day") || r.start.isCertain("weekday")),
    );
  if (!match) {
    return { title: raw.trim(), dueDate: null, recurring: false, match: null };
  }

  return {
    title: strip(match.index, match.text),
    dueDate: dateOnlyFromLocalDate(match.start.date()),
    recurring: false,
    match: { index: match.index, text: match.text },
  };
}
