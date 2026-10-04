"use server";

import { requireUser } from "@/lib/auth";
import { getTimeBreakdown, MAX_TIME_OFFSET, TIME_RANGES, type TimeRange } from "@/lib/data/time-breakdown";

/** Progress → "Where your time went", for another range or period (offset 0 = current, -1 = previous). */
export async function loadTimeBreakdown(range: TimeRange, offset: number) {
  if (!TIME_RANGES.includes(range)) throw new Error("Unknown range.");
  if (!Number.isInteger(offset) || offset > 0 || offset < -MAX_TIME_OFFSET[range]) throw new Error("Out of range.");
  const user = await requireUser();
  return getTimeBreakdown(user, range, offset);
}
