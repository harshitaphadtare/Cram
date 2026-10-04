import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ACHIEVEMENTS, LEVEL_KEY_PREFIX } from "@/lib/achievements";
import { levelInfo } from "@/lib/levels";
import { appUrl, sendEmail } from "@/lib/email/send";
import { unsubscribeOneClickUrl, unsubscribePageUrl, type EmailPref } from "@/lib/email/unsubscribe";
import { comebackEmail, planEmail, streakRiskEmail, weeklyEmail, type RenderedEmail } from "@/lib/email/templates";

/**
 * Duolingo-style reminder emails. `runReminders` is called once an hour (see docs/EMAILS.md);
 * each email goes out at a set hour of the student's own day:
 *
 *   08:00  plan         pages due for review + tasks due: daily when a task is due today,
 *                       otherwise (reviews / overdue tasks only) at most every other day
 *   18:00  weekly       Sundays: the week's recap, if they studied at all that week
 *   18:00  comeback     2, 7 and 21 days after they last studied (1 and 4 days after sign-up if
 *                       they never have), then nothing until they're back
 *   20:00  streak_risk  they have a live streak and haven't studied yet today
 *
 * Nothing is sent to anyone who already studied today (except the morning plan and the recap),
 * at most one email goes out per run, and EmailLog makes every email once-per-day at most.
 */

export const EMAIL_KINDS = ["plan", "weekly", "comeback", "streak_risk"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

const PREF_FOR: Record<EmailKind, EmailPref> = {
  plan: "emailPlan",
  weekly: "emailWeekly",
  comeback: "emailReminders",
  streak_risk: "emailReminders",
};

const HOUR = { plan: 8, weekly: 18, comeback: 18, streak_risk: 20 } as const;
const COMEBACK_DAYS = [2, 7, 21];
const NEW_USER_DAYS = [1, 4];
/** Reviews or overdue tasks alone don't justify a daily email; repeat at most this often. */
const PLAN_REVIEW_GAP_MS = 44 * 60 * 60 * 1000;
/** The plan email is for active students; lapsed ones get the comeback emails instead. */
const PLAN_ACTIVE_WITHIN_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const LIST_LIMIT = 5;

const userSelect = {
  id: true,
  email: true,
  name: true,
  timezone: true,
  streakCount: true,
  longestStreak: true,
  lastActiveDate: true,
  streakFreezes: true,
  xp: true,
  dailyGoalMin: true,
  createdAt: true,
  emailReminders: true,
  emailPlan: true,
  emailWeekly: true,
} satisfies Prisma.UserSelect;

type ReminderUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

// ---------- The student's local clock ----------

interface LocalClock {
  /** YYYY-MM-DD in their timezone. */
  ymd: string;
  /** Their calendar date as UTC midnight, matching how StreakLog/Task dates are stored. */
  today: Date;
  hour: number;
  /** 0 = Sunday. */
  weekday: number;
}

function localClock(timezone: string, now: Date): LocalClock {
  const parts = (tz?: string) =>
    Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
        weekday: "short",
      })
        .formatToParts(now)
        .map((p) => [p.type, p.value]),
    );
  let v: Record<string, string>;
  try {
    v = parts(timezone);
  } catch {
    v = parts("UTC");
  }
  const ymd = `${v.year}-${v.month}-${v.day}`;
  return {
    ymd,
    today: new Date(`${ymd}T00:00:00.000Z`),
    hour: Number(v.hour) % 24,
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(v.weekday),
  };
}

const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY_MS);
const firstName = (name: string | null) => name?.trim().split(/\s+/)[0] || null;

function footer(user: ReminderUser, kind: EmailKind) {
  const pref = PREF_FOR[kind];
  return {
    unsubscribeUrl: unsubscribePageUrl(user.id, pref),
    settingsUrl: appUrl("/app/settings"),
  };
}

// ---------- Data each email needs ----------

/** Pages due for review in folders the student can still open. */
async function dueReviews(userId: string, now: Date) {
  const where = {
    userId,
    dueAt: { lte: now },
    page: { folder: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] } },
  } satisfies Prisma.PageReviewWhereInput;
  const [count, top] = await Promise.all([
    prisma.pageReview.count({ where }),
    prisma.pageReview.findMany({
      where,
      orderBy: [{ mastery: "asc" }, { dueAt: "asc" }],
      take: LIST_LIMIT,
      select: { page: { select: { title: true, folder: { select: { name: true } } } } },
    }),
  ]);
  return { count, top: top.map((r) => ({ title: r.page.title || "Untitled", folder: r.page.folder.name })) };
}

async function dueTasks(userId: string, today: Date) {
  const where = { userId, completed: false, dueDate: { lte: today } } satisfies Prisma.TaskWhereInput;
  const [count, dueToday, top] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.count({ where: { ...where, dueDate: today } }),
    // Today's first, then the most recently missed.
    prisma.task.findMany({ where, orderBy: [{ dueDate: "desc" }, { priority: "asc" }], take: LIST_LIMIT, select: { title: true, dueDate: true } }),
  ]);
  return { count, dueToday, top: top.map((t) => ({ title: t.title, overdue: !!t.dueDate && t.dueDate < today })) };
}

/** The most recent day the student studied, and whether that's today. */
async function lastStudyDay(userId: string) {
  const log = await prisma.streakLog.findFirst({
    where: { userId, studied: true },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  return log?.date ?? null;
}

/** Same rule as refreshStreak: a streak survives missed days while there are freezes to cover them. */
function streakAlive(user: ReminderUser, today: Date) {
  if (user.streakCount <= 0 || !user.lastActiveDate) return { alive: false, freezeCovers: false };
  const missed = Math.max(0, daysBetween(user.lastActiveDate, today) - 1);
  return { alive: missed <= user.streakFreezes, freezeCovers: missed + 1 <= user.streakFreezes };
}

// ---------- Building each email ----------

async function buildPlan(user: ReminderUser, clock: LocalClock, now: Date) {
  const [reviews, tasks] = await Promise.all([dueReviews(user.id, now), dueTasks(user.id, clock.today)]);
  return {
    reviews,
    tasks,
    render: (): RenderedEmail =>
      planEmail({
        name: firstName(user.name),
        reviews: reviews.top,
        reviewCount: reviews.count,
        tasks: tasks.top,
        taskCount: tasks.count,
        tasksDueToday: tasks.dueToday,
        url: appUrl(reviews.count ? "/app" : "/app/planner"),
        footer: footer(user, "plan"),
      }),
  };
}

async function buildWeekly(user: ReminderUser, clock: LocalClock) {
  const weekStart = new Date(clock.today.getTime() - ((clock.weekday + 6) % 7) * DAY_MS); // Monday
  const [logs, unlocked, upcoming] = await Promise.all([
    prisma.streakLog.findMany({ where: { userId: user.id, date: { gte: weekStart } }, select: { studied: true, seconds: true, xp: true } }),
    prisma.userAchievement.findMany({
      where: { userId: user.id, unlockedAt: { gte: weekStart }, NOT: { key: { startsWith: LEVEL_KEY_PREFIX } } },
      select: { key: true },
    }),
    prisma.pageReview.count({ where: { userId: user.id, dueAt: { gt: new Date(), lte: new Date(Date.now() + 7 * DAY_MS) } } }),
  ]);
  const daysStudied = logs.filter((l) => l.studied).length;
  const level = levelInfo(user.xp);
  return {
    daysStudied,
    render: (): RenderedEmail =>
      weeklyEmail({
        name: firstName(user.name),
        minutes: Math.round(logs.reduce((s, l) => s + l.seconds, 0) / 60),
        daysStudied,
        xp: logs.reduce((s, l) => s + l.xp, 0),
        streak: user.streakCount,
        level: level.level,
        levelTitle: level.title,
        achievements: unlocked.map((u) => ACHIEVEMENTS.find((a) => a.key === u.key)?.title).filter((t): t is string => !!t),
        reviewsComingUp: upcoming,
        url: appUrl("/app/progress"),
        footer: footer(user, "weekly"),
      }),
  };
}

async function buildComeback(user: ReminderUser, clock: LocalClock, lastStudied: Date | null) {
  const neverStudied = !lastStudied;
  const since = lastStudied ?? localClock(user.timezone, user.createdAt).today;
  const daysAway = daysBetween(since, clock.today);
  const reviews = neverStudied ? { count: 0 } : await prisma.pageReview.count({ where: { userId: user.id, dueAt: { lte: new Date() } } }).then((count) => ({ count }));
  return {
    daysAway,
    neverStudied,
    render: (): RenderedEmail =>
      comebackEmail({
        name: firstName(user.name),
        daysAway,
        neverStudied,
        longestStreak: user.longestStreak,
        reviewCount: reviews.count,
        url: appUrl("/app"),
        footer: footer(user, "comeback"),
      }),
  };
}

function buildStreakRisk(user: ReminderUser, freezeCovers: boolean) {
  return (): RenderedEmail =>
    streakRiskEmail({
      name: firstName(user.name),
      streak: user.streakCount,
      freezeCovers,
      url: appUrl("/app"),
      footer: footer(user, "streak_risk"),
    });
}

// ---------- Deciding what (if anything) a student gets this hour ----------

type Decision = { kind: EmailKind; render: () => RenderedEmail } | { kind: null; reason: string };

async function decide(user: ReminderUser, clock: LocalClock, now: Date): Promise<Decision> {
  const wants = (kind: EmailKind) => user[PREF_FOR[kind]] && clock.hour === HOUR[kind];
  if (!EMAIL_KINDS.some(wants)) return { kind: null, reason: "not a send hour" };

  const lastStudied = await lastStudyDay(user.id);
  const studiedToday = !!lastStudied && lastStudied.getTime() === clock.today.getTime();

  if (wants("streak_risk")) {
    const { alive, freezeCovers } = streakAlive(user, clock.today);
    if (alive && !studiedToday) return { kind: "streak_risk", render: buildStreakRisk(user, freezeCovers) };
  }

  if (wants("weekly") && clock.weekday === 0) {
    const weekly = await buildWeekly(user, clock);
    if (weekly.daysStudied > 0) return { kind: "weekly", render: weekly.render };
  }

  if (wants("comeback") && !studiedToday && !streakAlive(user, clock.today).alive) {
    const comeback = await buildComeback(user, clock, lastStudied);
    const days = comeback.neverStudied ? NEW_USER_DAYS : COMEBACK_DAYS;
    if (days.includes(comeback.daysAway)) return { kind: "comeback", render: comeback.render };
  }

  if (wants("plan")) {
    const recent = lastStudied ?? localClock(user.timezone, user.createdAt).today;
    if (daysBetween(recent, clock.today) <= PLAN_ACTIVE_WITHIN_DAYS) {
      const plan = await buildPlan(user, clock, now);
      // Something due today is worth a daily email; a backlog of reviews or overdue tasks isn't.
      let send = plan.tasks.dueToday > 0;
      if (!send && (plan.reviews.count > 0 || plan.tasks.count > 0)) {
        const recentPlan = await prisma.emailLog.findFirst({
          where: { userId: user.id, kind: "plan", sentAt: { gte: new Date(now.getTime() - PLAN_REVIEW_GAP_MS) } },
          select: { id: true },
        });
        send = !recentPlan;
      }
      if (send) return { kind: "plan", render: plan.render };
    }
  }

  return { kind: null, reason: "nothing to send" };
}

// ---------- The hourly run ----------

export interface RunResult {
  checked: number;
  sent: { userId: string; kind: EmailKind }[];
  wouldSend: { userId: string; kind: EmailKind; subject: string }[];
  failed: { userId: string; kind: EmailKind; error: string }[];
}

export async function runReminders({ dryRun = false, now = new Date() } = {}): Promise<RunResult> {
  const users = await prisma.user.findMany({
    where: { OR: [{ emailReminders: true }, { emailPlan: true }, { emailWeekly: true }] },
    select: userSelect,
  });
  const result: RunResult = { checked: users.length, sent: [], wouldSend: [], failed: [] };

  // A few at a time keeps the database pool and Resend's rate limit (2 req/s on free) happy.
  for (let i = 0; i < users.length; i += 2) {
    await Promise.all(
      users.slice(i, i + 2).map(async (user) => {
        const clock = localClock(user.timezone, now);
        let decision: Decision;
        try {
          decision = await decide(user, clock, now);
        } catch (err) {
          console.error("Reminder decision failed", user.id, err);
          return;
        }
        if (!decision.kind) return;
        const { kind } = decision;

        if (dryRun) {
          const already = await prisma.emailLog.findUnique({
            where: { userId_kind_day: { userId: user.id, kind, day: clock.ymd } },
            select: { id: true },
          });
          if (!already) result.wouldSend.push({ userId: user.id, kind, subject: decision.render().subject });
          return;
        }

        // Claim the slot first: if two runs overlap, only one gets to send.
        try {
          await prisma.emailLog.create({ data: { userId: user.id, kind, day: clock.ymd } });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
          throw err;
        }

        const email = decision.render();
        const sent = await sendEmail({
          to: user.email,
          ...email,
          unsubscribeUrl: unsubscribeOneClickUrl(user.id, PREF_FOR[kind]),
          idempotencyKey: `${user.id}:${kind}:${clock.ymd}`,
        });
        if (sent.ok) {
          result.sent.push({ userId: user.id, kind });
        } else {
          // Give the slot back so the next run (or tomorrow) can try again.
          await prisma.emailLog.deleteMany({ where: { userId: user.id, kind, day: clock.ymd } });
          result.failed.push({ userId: user.id, kind, error: sent.error });
          console.error("Reminder email failed", user.id, kind, sent.error);
        }
      }),
    );
  }
  return result;
}

/**
 * Sends one kind of email to one account right now, ignoring the hour and the rules — for checking
 * how an email looks in a real inbox. Not logged, so it doesn't affect the real schedule.
 */
export async function sendTestReminder(email: string, kind: EmailKind) {
  const user = await prisma.user.findUnique({ where: { email }, select: userSelect });
  if (!user) return { ok: false as const, error: "No account with that email" };
  const clock = localClock(user.timezone, new Date());
  const lastStudied = await lastStudyDay(user.id);

  let render: () => RenderedEmail;
  if (kind === "plan") {
    const plan = await buildPlan(user, clock, new Date());
    if (!plan.reviews.count && !plan.tasks.count) return { ok: false as const, error: "Nothing due — add a task due today or wait for a review" };
    render = plan.render;
  } else if (kind === "weekly") render = (await buildWeekly(user, clock)).render;
  else if (kind === "comeback") render = (await buildComeback(user, clock, lastStudied)).render;
  else render = buildStreakRisk(user, streakAlive(user, clock.today).freezeCovers);

  const rendered = render();
  const sent = await sendEmail({
    to: user.email,
    ...rendered,
    subject: `[Test] ${rendered.subject}`,
    unsubscribeUrl: unsubscribeOneClickUrl(user.id, PREF_FOR[kind]),
  });
  return sent.ok ? { ok: true as const, subject: rendered.subject } : sent;
}
