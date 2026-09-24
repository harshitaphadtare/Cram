"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function updateProfileName(name: string) {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name can't be empty.");

  await prisma.user.update({ where: { id: user.id }, data: { name: trimmed } });
  revalidatePath("/app", "layout");
}

export async function updateTimezone(timezone: string) {
  const user = await requireUser();
  if (!timezone) throw new Error("Pick a timezone.");

  await prisma.user.update({ where: { id: user.id }, data: { timezone } });
  revalidatePath("/app/settings");
}

export async function updateAvatarUrl(avatarUrl: string) {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl } });
  revalidatePath("/app", "layout");
}
