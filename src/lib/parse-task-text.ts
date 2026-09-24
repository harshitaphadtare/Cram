import * as chrono from "chrono-node";
import { dateOnlyFromLocalDate } from "@/lib/date-only";

const RECURRING_PATTERN = /\b(every ?day|everyday|daily)\b/i;

export interface ParsedTaskText {
  /** Title with any recognized date/recurrence phrase stripped out. */
  title: string;
  /** "YYYY-MM-DD", set only when a date phrase was found and it isn't a recurring task. */
  dueDate: string | null;
  recurring: boolean;
}

/** Reads natural language out of a quick-add task title — "today", "tomorrow", "next friday",
 * "sep 25", "everyday" — and turns it into a due date / recurring flag, leaving a clean title. */
export function parseTaskText(raw: string): ParsedTaskText {
  const recurringMatch = raw.match(RECURRING_PATTERN);
  if (recurringMatch) {
    return {
      title: raw.replace(RECURRING_PATTERN, "").replace(/\s+/g, " ").trim(),
      dueDate: null,
      recurring: true,
    };
  }

  const results = chrono.parse(raw, new Date(), { forwardDate: true });
  if (results.length === 0) {
    return { title: raw.trim(), dueDate: null, recurring: false };
  }

  // Use the first date-like phrase found and strip just that substring from the title.
  const match = results[0];
  const title = (raw.slice(0, match.index) + raw.slice(match.index + match.text.length))
    .replace(/\s+/g, " ")
    .trim();

  return {
    title,
    dueDate: dateOnlyFromLocalDate(match.start.date()),
    recurring: false,
  };
}
