import "server-only";
import { prisma } from "@/lib/prisma";
import { PomodoroType } from "@/generated/prisma/enums";
import type { User } from "@/generated/prisma/client";
import { ACHIEVEMENTS, isUnlocked } from "@/lib/achievements";
import { addDays, checkAchievements, getAchievementStats, userToday } from "@/lib/gamification";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type DayStatus = "studied" | "frozen" | "partial" | "none" | "today";

/** Everything the home dashboard shows beyond folders and tasks, fetched in parallel. */
export async function getDashboardData(user: User, folderIds: string[]) {
  const today = userToday(user.timezone);
  // Catches anything earned outside a crediting action (e.g. history from before achievements existed).
  await checkAchievements(user.id);
  const weekStart = addDays(today, -6);

  const [recentPages, focus, quizzes, logs, dueReviews, allReviews, unlocked, stats, roadmap] =
    await Promise.all([
      prisma.page.findMany({
        where: { folderId: { in: folderIds } },
        select: {
          id: true,
          title: true,
          updatedAt: true,
          folder: { select: { id: true, name: true, color: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),
      prisma.pomodoroSession.aggregate({
        where: {
          userId: user.id,
          type: PomodoroType.WORK,
          completed: true,
          startedAt: { gte: new Date(Date.now() - WEEK_MS) },
        },
        _sum: { durationMin: true },
      }),
      prisma.quiz.findMany({
        where: { userId: user.id, status: "completed" },
        select: { correctCount: true, totalQuestions: true },
      }),
      prisma.streakLog.findMany({
        where: { userId: user.id, date: { gte: weekStart } },
        orderBy: { date: "asc" },
      }),
      prisma.pageReview.findMany({
        where: { userId: user.id, dueAt: { lte: new Date() }, page: { folderId: { in: folderIds } } },
        include: {
          page: { select: { id: true, title: true, folder: { select: { id: true, name: true, color: true } } } },
        },
        orderBy: [{ mastery: "asc" }, { dueAt: "asc" }],
        take: 12,
      }),
      prisma.pageReview.findMany({
        where: { userId: user.id, page: { folderId: { in: folderIds } } },
        select: { mastery: true, page: { select: { folderId: true } } },
      }),
      prisma.userAchievement.findMany({
        where: { userId: user.id, NOT: { key: { startsWith: "level:" } } },
        orderBy: { unlockedAt: "desc" },
      }),
      getAchievementStats(user.id),
      prisma.roadmapItem.findMany({
        where: { userId: user.id, folderId: { in: folderIds } },
        select: { id: true, folderId: true, title: true, done: true, createdAt: true },
        orderBy: { order: "asc" },
      }),
    ]);

  const scored = quizzes.filter((q) => q.totalQuestions > 0);
  const averageQuizScore =
    scored.length > 0
      ? Math.round(
          (scored.reduce((sum, q) => sum + q.correctCount / q.totalQuestions, 0) / scored.length) *
            100,
        )
      : null;

  // Last 7 calendar days, oldest first, for the streak strip.
  const byDate = new Map(logs.map((l) => [l.date.getTime(), l]));
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const log = byDate.get(date.getTime());
    const isToday = i === 6;
    let status: DayStatus = "none";
    if (log?.studied) status = "studied";
    else if (log?.frozen) status = "frozen";
    else if (log && log.seconds > 0) status = "partial";
    else if (isToday) status = "today";
    return { date, status, isToday };
  });

  const todayLog = byDate.get(today.getTime());
  const yesterdayLog = byDate.get(addDays(today, -1).getTime());

  // Average mastery per folder, over pages that have been quizzed at least once.
  const folderMastery = new Map<string, { sum: number; n: number }>();
  for (const r of allReviews) {
    const m = folderMastery.get(r.page.folderId) ?? { sum: 0, n: 0 };
    m.sum += r.mastery;
    m.n++;
    folderMastery.set(r.page.folderId, m);
  }

  // Achievements: most recent unlocks, and the locked ones closest to unlocking.
  const unlockedKeys = new Set(unlocked.map((u) => u.key));
  const recentAchievements = unlocked
    .map((u) => ACHIEVEMENTS.find((a) => a.key === u.key))
    .filter((a): a is (typeof ACHIEVEMENTS)[number] => !!a)
    .slice(0, 3);
  const nextAchievements = ACHIEVEMENTS.filter((a) => !unlockedKeys.has(a.key) && !isUnlocked(a, stats))
    .map((a) => {
      const [current, target] = a.progress(stats);
      return { def: a, current, target, ratio: current / target };
    })
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3);

  return {
    recentPages,
    focusMinutesThisWeek: focus._sum.durationMin ?? 0,
    completedQuizzes: quizzes.length,
    averageQuizScore,
    week,
    todaySeconds: todayLog?.seconds ?? 0,
    studiedToday: !!todayLog?.studied,
    freezeUsedYesterday: !!yesterdayLog?.frozen && !yesterdayLog.studied,
    dueReviews: dueReviews.map((r) => ({
      pageId: r.page.id,
      title: r.page.title,
      folder: r.page.folder,
      mastery: r.mastery,
    })),
    folderMastery: Object.fromEntries(
      [...folderMastery].map(([id, m]) => [id, Math.round(m.sum / m.n)]),
    ) as Record<string, number>,
    unlockedCount: unlocked.length,
    totalAchievements: ACHIEVEMENTS.length,
    recentAchievements,
    nextAchievements,
    roadmap: roadmap.map((r) => ({ id: r.id, folderId: r.folderId, title: r.title, done: r.done })),
    // Open the roadmap on the subject you most recently added topics to.
    roadmapFolderId:
      [...roadmap].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.folderId ?? null,
  };
}
