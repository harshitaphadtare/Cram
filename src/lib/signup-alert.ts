import "server-only";

/**
 * Emails the site owner when someone new signs up, via Resend's HTTP API (no SDK needed).
 *
 * Configure in the environment (Vercel → Settings → Environment Variables):
 * - RESEND_API_KEY   — from resend.com → API Keys
 * - SIGNUP_ALERT_TO  — where alerts go
 * - SIGNUP_ALERT_FROM — optional; defaults to Resend's shared test sender, which can only deliver
 *   to the email address the Resend account was created with. Use an address on a domain
 *   verified in Resend to send anywhere.
 *
 * Does nothing when the key or recipient isn't set, and never throws — an alert failing must
 * never break signing in.
 */
export async function sendSignupAlert(user: {
  name: string | null;
  email: string;
  countryCode: string | null;
  city: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.SIGNUP_ALERT_TO;
  if (!apiKey || !to) return;

  const country = countryName(user.countryCode);
  const place = [user.city, country].filter(Boolean).join(", ") || "Unknown";
  const name = user.name?.trim() || "(no name given)";
  const when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

  const text = [
    "Someone just signed up for Cram.",
    "",
    `Name:    ${name}`,
    `Email:   ${user.email}`,
    `Country: ${place}`,
    `When:    ${when} UTC`,
  ].join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.SIGNUP_ALERT_FROM || "Cram <onboarding@resend.dev>",
        to,
        subject: `New Cram signup: ${name}${country ? ` from ${country}` : ""}`,
        text,
      }),
    });
    if (!res.ok) console.error("Signup alert failed", res.status, await res.text());
  } catch (err) {
    console.error("Signup alert failed", err);
  }
}

/** "DE" → "Germany". Vercel sends ISO 3166 alpha-2 codes. */
function countryName(code: string | null): string | null {
  if (!code || !/^[A-Z]{2}$/i.test(code)) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
