import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { appUrl } from "@/lib/email/send";

/** The preference each kind of email is controlled by (columns on User). */
export const EMAIL_PREFS = {
  emailReminders: { label: "Streak and comeback reminders" },
  emailPlan: { label: "Morning review plan" },
  emailWeekly: { label: "Weekly recap" },
} as const;

export type EmailPref = keyof typeof EMAIL_PREFS;

export function isEmailPref(value: unknown): value is EmailPref {
  return typeof value === "string" && value in EMAIL_PREFS;
}

/**
 * Unsubscribe links work without signing in, so they carry a signature: HMAC(user + preference)
 * keyed by CRON_SECRET. Nobody can turn off someone else's emails by guessing a user id.
 */
function sign(userId: string, pref: EmailPref): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is not set");
  return createHmac("sha256", `unsubscribe:${secret}`).update(`${userId}|${pref}`).digest("base64url");
}

export function verifyUnsubscribe(userId: string, pref: EmailPref, token: string): boolean {
  try {
    const expected = Buffer.from(sign(userId, pref));
    const given = Buffer.from(token);
    return expected.length === given.length && timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}

function query(userId: string, pref: EmailPref) {
  return new URLSearchParams({ u: userId, p: pref, t: sign(userId, pref) }).toString();
}

/** The page a person lands on from the email's "Unsubscribe" link. */
export function unsubscribePageUrl(userId: string, pref: EmailPref) {
  return appUrl(`/email/unsubscribe?${query(userId, pref)}`);
}

/** RFC 8058 one-click endpoint, used by mail apps' own "Unsubscribe" button. */
export function unsubscribeOneClickUrl(userId: string, pref: EmailPref) {
  return appUrl(`/api/email/unsubscribe?${query(userId, pref)}`);
}
