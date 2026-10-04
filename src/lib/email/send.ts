import "server-only";

/**
 * Sends one email through Resend's HTTP API (no SDK needed).
 *
 * Environment (Vercel → Settings → Environment Variables):
 * - RESEND_API_KEY — from resend.com → API Keys
 * - EMAIL_FROM     — e.g. "Cram <reminders@yourdomain.com>", on a domain verified in Resend.
 *   Without it, Resend's shared test sender is used, which only delivers to the address the
 *   Resend account was created with — fine for trying reminders on yourself, not for students.
 * - EMAIL_DELIVER_TO — optional; delivers every email to this one address instead (e.g. the
 *   Resend account's address, when it differs from your Cram account's email).
 */
export async function sendEmail(email: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** One-click unsubscribe URL, shown by Gmail/Apple Mail as an "Unsubscribe" button. */
  unsubscribeUrl?: string;
  /** Resend drops a repeat of the same key for 24 hours — a guard against double sends. */
  idempotencyKey?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY is not set" };

  const headers: Record<string, string> = {};
  if (email.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${email.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(email.idempotencyKey ? { "Idempotency-Key": email.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Cram <onboarding@resend.dev>",
        to: process.env.EMAIL_DELIVER_TO || email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers,
      }),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text()}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * EMAIL_REMINDERS_FOR — optional comma-separated list of account emails. When set, only those
 * accounts get reminder emails (and see the email settings). Made for running Cram without a
 * verified domain: Resend's test sender can only reach the Resend account owner anyway.
 */
function reminderAllowlist(): string[] | null {
  const list = (process.env.EMAIL_REMINDERS_FOR ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.length ? list : null;
}

export function remindersAllowedFor(email: string): boolean {
  const list = reminderAllowlist();
  return !list || list.includes(email.toLowerCase());
}

/** The same list, as a Prisma filter for the hourly run. */
export function reminderRecipientsFilter(): { email?: { in: string[]; mode: "insensitive" } } {
  const list = reminderAllowlist();
  return list ? { email: { in: list, mode: "insensitive" } } : {};
}

/** The site's public address, for links in emails. */
export function appUrl(path = ""): string {
  const base = (process.env.APP_URL || "https://cram-eta.vercel.app").replace(/\/$/, "");
  return `${base}${path}`;
}
