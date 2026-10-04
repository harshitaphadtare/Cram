import "server-only";
import { prisma } from "@/lib/prisma";
import { EMAIL_PREFS, isEmailPref, verifyUnsubscribe, type EmailPref } from "@/lib/email/unsubscribe";

/** Turns off one kind of email (or all of them) for the user an unsubscribe link was made for. */
export async function unsubscribeWithToken(params: {
  userId: unknown;
  pref: unknown;
  token: unknown;
  all?: boolean;
}): Promise<{ ok: true; turnedOff: EmailPref[] } | { ok: false }> {
  const { userId, pref, token, all } = params;
  if (typeof userId !== "string" || typeof token !== "string" || !isEmailPref(pref)) return { ok: false };
  if (!verifyUnsubscribe(userId, pref, token)) return { ok: false };

  const turnedOff = all ? (Object.keys(EMAIL_PREFS) as EmailPref[]) : [pref];
  const result = await prisma.user.updateMany({
    where: { id: userId },
    data: Object.fromEntries(turnedOff.map((p) => [p, false])),
  });
  return result.count ? { ok: true, turnedOff } : { ok: false };
}
