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

/**
 * "Reset progress": everything gamified starts from zero — streak and best streak, XP and level,
 * achievements (and their celebrations), streak freezes, and the day-by-day study log behind the
 * goal ring, heatmap and leaderboards. Notes, folders, tasks, quiz history and review schedules
 * are kept; `progressResetAt` makes stats and achievements ignore activity from before the reset.
 */
export async function resetProgress() {
  const user = await requireUser();
  await prisma.$transaction([
    prisma.streakLog.deleteMany({ where: { userId: user.id } }),
    prisma.userAchievement.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        xp: 0,
        streakCount: 0,
        longestStreak: 0,
        lastActiveDate: null,
        streakFreezes: 1,
        lastFreezeGrantAt: null,
        lastEditAt: null,
        progressResetAt: new Date(),
      },
    }),
  ]);
  revalidatePath("/app", "layout");
}

export async function updateLeaderboardVisibility(show: boolean) {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { showOnLeaderboard: show } });
  revalidatePath("/app", "layout");
}
