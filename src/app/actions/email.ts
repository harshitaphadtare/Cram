"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isEmailPref } from "@/lib/email/unsubscribe";
import { unsubscribeWithToken } from "@/lib/email/preferences";

/** Settings → Email notifications switches. */
export async function updateEmailPreference(pref: string, on: boolean) {
  if (!isEmailPref(pref)) throw new Error("Unknown email setting.");
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { [pref]: on } });
  revalidatePath("/app/settings");
}

/** The confirm button on /email/unsubscribe (reached from an email, possibly signed out). */
export async function unsubscribeFromEmail(formData: FormData) {
  const all = formData.get("all") === "1";
  const result = await unsubscribeWithToken({
    userId: formData.get("u"),
    pref: formData.get("p"),
    token: formData.get("t"),
    all,
  });
  redirect(`/email/unsubscribe?done=${result.ok ? (all ? "all" : formData.get("p")) : "invalid"}`);
}
