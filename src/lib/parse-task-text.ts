import * as chrono from "chrono-node";
import { dateOnlyFromLocalDate } from "@/lib/date-only";

const RECURRING_PATTERN = /\b(every ?day|everyday|daily)\b/gi;

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

  // Use the first date-like phrase that wasn't dismissed and strip just that substring.
  const match = chrono
    .parse(raw, new Date(), { forwardDate: true })
    .find((r) => !ignored.has(r.text.toLowerCase()));
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
