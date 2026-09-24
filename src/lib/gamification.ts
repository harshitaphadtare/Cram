import "server-only";
import { prisma } from "@/lib/prisma";
import { PomodoroType } from "@/generated/prisma/enums";
import type { User } from "@/generated/prisma/client";
import { ACHIEVEMENTS, LEVEL_KEY_PREFIX, isUnlocked, type AchievementStats } from "@/lib/achievements";
import { levelForXp } from "@/lib/levels";

// ---------- Tunables ----------

/** Minimum study time in a day for it to count toward the streak (without a focus session/quiz). */
const STREAK_MIN_SECONDS = 5 * 60;
/** Bonus XP the first time the daily goal is reached each day. */
export const GOAL_BONUS_XP = 20;
/** Streak freezes are granted one per week, up to this many banked. */
export const MAX_FREEZES = 2;
/** Note edits closer together than this count as continuous study time. */
const EDIT_SESSION_GAP_MS = 5 * 60 * 1000;

// ---------- Dates (calendar days in the user's timezone, stored as UTC midnight) ----------

function todayYmd(timezone: string): string {
  const fmt = (tz?: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  try {
    return fmt(timezone);
  } catch {
    return fmt();
  }
}

export function userToday(timezone: string): Date {
  return new Date(`${todayYmd(timezone)}T00:00:00.000Z`);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday of the week containing `day` (UTC-anchored calendar date). */
function startOfWeek(day: Date): Date {
  const weekday = (day.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -weekday);
}

// ---------- Streak upkeep (runs on every app load) ----------

/**
 * Grants the weekly streak freeze, and — if the student missed days since their last activity —
 * spends freezes to cover them (Duolingo-style) or resets the streak when there aren't enough.
 * Returns the user with up-to-date streak fields.
 */
export async function refreshStreak(user: User): Promise<User> {
  const today = userToday(user.timezone);
  const yesterday = addDays(today, -1);
  const data: Partial<User> = {};
  let freezes = user.streakFreezes;

  const weekStart = startOfWeek(today);
  if (!user.lastFreezeGrantAt) {
    data.lastFreezeGrantAt = today; // new users start with the default banked freeze
  } else if (user.lastFreezeGrantAt < weekStart) {
    freezes = Math.min(MAX_FREEZES, freezes + 1);
    data.streakFreezes = freezes;
    data.lastFreezeGrantAt = today;
  }

  const last = user.lastActiveDate;
  if (user.streakCount > 0 && last && last < yesterday) {
    const missedDays = Math.round((yesterday.getTime() - last.getTime()) / DAY_MS);
    if (missedDays <= freezes) {
      const days = Array.from({ length: missedDays }, (_, i) => addDays(last, i + 1));
      await prisma.$transaction(
        days.map((date) =>
          prisma.streakLog.upsert({
            where: { userId_date: { userId: user.id, date } },
            update: { frozen: true },
            create: { userId: user.id, date, studied: false, frozen: true },
          }),
        ),
      );
      freezes -= missedDays;
      data.streakFreezes = freezes;
      data.lastActiveDate = yesterday;
    } else {
      data.streakCount = 0;
    }
  } else if (user.streakCount > 0 && !last) {
    data.streakCount = 0;
  }

  if (Object.keys(data).length === 0) return user;
  return prisma.user.update({ where: { id: user.id }, data });
}

// ---------- Crediting activity ----------

export interface ActivityResult {
  xpGained: number;
  goalReached: boolean;
}

/**
 * The single entry point for "the student did some studying". Adds study time and XP to today's
 * log, extends the streak once the day qualifies, awards the daily-goal bonus, then checks
 * achievements and level-ups.
 *
 * - `seconds`: study time (focus sessions, active note editing). Earns 1 XP per whole minute.
 * - `bonusXp`: flat XP (quiz answers, completed tasks).
 * - `qualifies`: the action alone counts for the streak (focus session, quiz) — otherwise the day
 *   needs STREAK_MIN_SECONDS of study time.
 */
export async function creditActivity(
  userId: string,
  { seconds = 0, bonusXp = 0, qualifies = false }: { seconds?: number; bonusXp?: number; qualifies?: boolean },
): Promise<ActivityResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const today = userToday(user.timezone);
  const existing = await prisma.streakLog.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  const prevSeconds = existing?.seconds ?? 0;
  const totalSeconds = prevSeconds + Math.max(0, Math.round(seconds));
  const minuteXp = Math.floor(totalSeconds / 60) - Math.floor(prevSeconds / 60);
  const goalReached = !existing?.goalMet && totalSeconds >= user.dailyGoalMin * 60;
  const xpGained = minuteXp + bonusXp + (goalReached ? GOAL_BONUS_XP : 0);
  const becomesStudied =
    !existing?.studied && (qualifies || totalSeconds >= STREAK_MIN_SECONDS);

  await prisma.streakLog.upsert({
    where: { userId_date: { userId, date: today } },
    update: {
      seconds: totalSeconds,
      xp: { increment: xpGained },
      ...(goalReached && { goalMet: true }),
      ...(becomesStudied && { studied: true }),
    },
    create: {
      userId,
      date: today,
      seconds: totalSeconds,
      xp: xpGained,
      goalMet: goalReached,
      studied: becomesStudied,
    },
  });

  const userData: Record<string, unknown> = {};
  if (xpGained > 0) userData.xp = { increment: xpGained };
  if (becomesStudied) {
    const yesterdayLog = await prisma.streakLog.findUnique({
      where: { userId_date: { userId, date: addDays(today, -1) } },
    });
    const continues = !!yesterdayLog && (yesterdayLog.studied || yesterdayLog.frozen);
    const streak = continues ? user.streakCount + 1 : 1;
    userData.streakCount = streak;
    userData.longestStreak = Math.max(streak, user.longestStreak);
    userData.lastActiveDate = today;
  }
  if (Object.keys(userData).length > 0) {
    await prisma.user.update({ where: { id: userId }, data: userData });
  }

  if (xpGained > 0 || becomesStudied) {
    await recordLevelUps(userId, user.xp, user.xp + xpGained);
    await checkAchievements(userId);
  }

  return { xpGained, goalReached };
}

/**
 * Credits active note-editing time. Autosaves arrive every few seconds while typing; the gap since
 * the previous save counts as study time if it's short enough to be the same writing session.
 */
export async function creditNoteEditing(userId: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { lastEditAt: true },
  });
  const now = new Date();
  await prisma.user.update({ where: { id: userId }, data: { lastEditAt: now } });

  const gap = user.lastEditAt ? now.getTime() - user.lastEditAt.getTime() : Infinity;
  if (gap <= EDIT_SESSION_GAP_MS) {
    await creditActivity(userId, { seconds: gap / 1000 });
  }
}

// ---------- Celebrations: level-ups and achievements ----------

async function recordLevelUps(userId: string, oldXp: number, newXp: number) {
  const from = levelForXp(oldXp);
  const to = levelForXp(newXp);
  if (to <= from) return;
  // Only celebrate the level reached — a big XP jump shouldn't queue several popups.
  await prisma.userAchievement.upsert({
    where: { userId_key: { userId, key: `${LEVEL_KEY_PREFIX}${to}` } },
    update: {},
    create: { userId, key: `${LEVEL_KEY_PREFIX}${to}` },
  });
}

export async function getAchievementStats(userId: string): Promise<AchievementStats> {
  const [user, focus, quizzes, pagesCreated, goalDays, studyDays, bestReview] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { longestStreak: true, xp: true } }),
    prisma.pomodoroSession.aggregate({
      where: { userId, type: PomodoroType.WORK, completed: true },
      _sum: { durationMin: true },
    }),
    prisma.quiz.findMany({
      where: { userId, status: "completed" },
      select: { correctCount: true, totalQuestions: true },
    }),
    prisma.page.count({ where: { createdById: userId } }),
    prisma.streakLog.count({ where: { userId, goalMet: true } }),
    prisma.streakLog.count({ where: { userId, studied: true } }),
    prisma.pageReview.findFirst({ where: { userId }, orderBy: { mastery: "desc" }, select: { mastery: true } }),
  ]);

  return {
    longestStreak: user.longestStreak,
    level: levelForXp(user.xp),
    focusMinutes: focus._sum.durationMin ?? 0,
    completedQuizzes: quizzes.length,
    perfectQuizzes: quizzes.filter((q) => q.totalQuestions > 0 && q.correctCount === q.totalQuestions).length,
    pagesCreated,
    goalDays,
    bestMastery: bestReview?.mastery ?? 0,
    studyDays,
  };
}

/** Unlocks any achievements whose criteria are now met. Safe to call often. */
export async function checkAchievements(userId: string, precomputed?: AchievementStats): Promise<void> {
  const [stats, unlocked] = await Promise.all([
    precomputed ?? getAchievementStats(userId),
    prisma.userAchievement.findMany({ where: { userId }, select: { key: true } }),
  ]);
  const have = new Set(unlocked.map((a) => a.key));
  const fresh = ACHIEVEMENTS.filter((a) => !have.has(a.key) && isUnlocked(a, stats));
  if (fresh.length === 0) return;
  await prisma.userAchievement.createMany({
    data: fresh.map((a) => ({ userId, key: a.key })),
    skipDuplicates: true,
  });
}

// ---------- Spaced repetition ----------

const MAX_INTERVAL_DAYS = 60;

/**
 * Updates per-page mastery and the next review date from one quiz's results — a light SM-2:
 * strong recall stretches the interval, shaky recall holds it, poor recall resets it to tomorrow.
 */
export async function recordPageReviews(
  userId: string,
  results: { pageId: string; correct: number; total: number }[],
) {
  const now = new Date();
  for (const { pageId, correct, total } of results) {
    if (total === 0) continue;
    const ratio = correct / total;
    const prev = await prisma.pageReview.findUnique({
      where: { userId_pageId: { userId, pageId } },
    });

    // First attempt can't jump straight to 100%: mastery is earned over repeated reviews.
    const mastery = Math.round(prev ? prev.mastery * 0.4 + ratio * 100 * 0.6 : ratio * 100 * 0.8);
    let interval: number;
    if (ratio >= 0.8) interval = prev ? prev.intervalDays * 2.5 : 3;
    else if (ratio >= 0.5) interval = prev ? Math.max(1, prev.intervalDays * 1.2) : 1;
    else interval = 1;
    interval = Math.min(interval, MAX_INTERVAL_DAYS);

    await prisma.pageReview.upsert({
      where: { userId_pageId: { userId, pageId } },
      update: { mastery, intervalDays: interval, dueAt: new Date(now.getTime() + interval * DAY_MS), lastReviewedAt: now },
      create: { userId, pageId, mastery, intervalDays: interval, dueAt: new Date(now.getTime() + interval * DAY_MS) },
    });
  }
}
