"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_GOAL_MIN, MIN_GOAL_MIN } from "@/lib/goals";

export async function markCelebrationsSeen(ids: string[]) {
  const user = await requireUser();
  await prisma.userAchievement.updateMany({
    where: { userId: user.id, id: { in: ids } },
    data: { seen: true },
  });
}

export async function updateDailyGoal(minutes: number) {
  if (!Number.isInteger(minutes) || minutes < MIN_GOAL_MIN || minutes > MAX_GOAL_MIN) {
    throw new Error(`Pick a goal between ${MIN_GOAL_MIN} minutes and ${MAX_GOAL_MIN / 60} hours.`);
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
