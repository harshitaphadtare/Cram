"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DAILY_GOAL_OPTIONS } from "@/lib/goals";

export async function markCelebrationsSeen(ids: string[]) {
  const user = await requireUser();
  await prisma.userAchievement.updateMany({
    where: { userId: user.id, id: { in: ids } },
    data: { seen: true },
  });
}

export async function updateDailyGoal(minutes: number) {
  if (!DAILY_GOAL_OPTIONS.includes(minutes as (typeof DAILY_GOAL_OPTIONS)[number])) {
    throw new Error("Pick one of the listed goals.");
  }
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { dailyGoalMin: minutes } });
  revalidatePath("/app", "layout");
}

export async function updateLeaderboardVisibility(show: boolean) {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { showOnLeaderboard: show } });
  revalidatePath("/app", "layout");
}
