import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { EMAIL_KINDS, runReminders, sendTestReminder, type EmailKind } from "@/lib/email/reminders";

// Sending to a lot of students one by one takes a while.
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Hourly reminder run, called by Supabase pg_cron (or any scheduler) with
 * `Authorization: Bearer $CRON_SECRET`. See docs/EMAILS.md.
 *
 *   GET /api/cron/emails                      send whatever is due this hour
 *   GET /api/cron/emails?dryRun=1             list what would be sent, send nothing
 *   GET /api/cron/emails?dryRun=1&at=ISO      …as if it were that time
 *   GET /api/cron/emails?test=plan&to=EMAIL   send one email of that kind to that account now
 */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;

  const test = params.get("test");
  if (test) {
    const to = params.get("to");
    if (!to || !(EMAIL_KINDS as readonly string[]).includes(test)) {
      return NextResponse.json({ error: `Use ?test=${EMAIL_KINDS.join("|")}&to=EMAIL` }, { status: 400 });
    }
    return NextResponse.json(await sendTestReminder(to, test as EmailKind));
  }

  const dryRun = params.get("dryRun") === "1";
  // Dry runs can pretend it's another time (?at=2026-10-04T09:00:00Z) to check who'd get what.
  const at = dryRun && params.get("at") ? new Date(params.get("at")!) : new Date();
  if (Number.isNaN(at.getTime())) return NextResponse.json({ error: "Bad ?at= time" }, { status: 400 });
  const result = await runReminders({ dryRun, now: at });
  return NextResponse.json(result);
}
