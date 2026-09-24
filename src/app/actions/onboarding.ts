"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Called when the product tour is finished or skipped, so it isn't shown again. */
export async function completeOnboarding() {
  const user = await requireUser();
  if (user.onboardedAt) return;
  await prisma.user.update({ where: { id: user.id }, data: { onboardedAt: new Date() } });
}
