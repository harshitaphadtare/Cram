import { Brain, CalendarCheck, ChevronDown, Flame, Snowflake, Target, Timer } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { addDays, getAchievementStats, GOAL_BONUS_XP, MAX_FREEZES, userToday } from "@/lib/gamification";
import { levelInfo, titleForLevel } from "@/lib/levels";
import { getTimeBreakdown } from "@/lib/data/time-breakdown";
import { AchievementBadge } from "@/components/gamification/achievement-badge";
import { TimeBreakdownCard } from "@/components/gamification/time-breakdown";
import { cn } from "@/lib/utils";

/** Weeks of history in the activity heatmap (a year). */
const WEEKS = 52;

function formatHours(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function heatClass(seconds: number, goalMet: boolean) {
  if (seconds <= 0) return "bg-muted-foreground/10";
  if (goalMet) return "bg-streak";
  if (seconds >= 15 * 60) return "bg-streak/60";
  return "bg-streak/30";
}

const utc = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" });
const fmtDay = utc({ month: "short", day: "numeric" });
const fmtMonth = utc({ month: "short" });
const fmtWeekdayLetter = utc({ weekday: "narrow" });

/** Card shell shared by every section: a title row (with optional right-hand controls) and a body. */
function Card({ title, aside, className, children }: { title?: string; aside?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      {(title || aside) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
          {title && <h2 className="text-sm font-medium">{title}</h2>}
          {aside}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/**
 * The Progress page: level and streak up top, the four numbers that matter, where the time went,
 * a year of activity, then achievements (unlocked first, then the closest to unlocking).
 */
export async function ProgressView({ user }: { user: User }) {
  const today = userToday(user.timezone);
  const weekday = (today.getUTCDay() + 6) % 7; // Monday = 0
  const heatStart = addDays(today, -weekday - (WEEKS - 1) * 7);

  const [stats, unlocked, logs, timeBreakdown] = await Promise.all([
    getAchievementStats(user.id),
    prisma.userAchievement.findMany({ where: { userId: user.id }, select: { key: true, unlockedAt: true } }),
    prisma.streakLog.findMany({ where: { userId: user.id, date: { gte: heatStart } } }),
    getTimeBreakdown(user, "week", 0),
  ]);

  const info = levelInfo(user.xp);
  const byDate = new Map(logs.map((l) => [l.date.getTime(), l]));
  const unlockedAt = new Map(unlocked.map((u) => [u.key, u.unlockedAt]));

  // ---- Streak: the last 7 days, oldest first.
  const lastWeek = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    const log = byDate.get(date.getTime());
    return { date, studied: !!log?.studied, frozen: !!log?.frozen && !log.studied, isToday: i === 6 };
  });

  // ---- Heatmap: whole weeks (Mon–Sun) ending this week, with a month label where a month starts.
  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(heatStart, w * 7 + d);
      return { date, future: date > today, log: byDate.get(date.getTime()) };
    }),
  );
  const monthLabels = weeks.map((week, i) => {
    const first = week[0].date;
    const prev = i > 0 ? weeks[i - 1][0].date : null;
    return !prev || prev.getUTCMonth() !== first.getUTCMonth() ? fmtMonth.format(first) : "";
  });
  const activeDays = logs.filter((l) => l.studied).length;

  // ---- Achievements: unlocked (newest first), then locked by how close they are.
  const done = ACHIEVEMENTS.filter((a) => unlockedAt.has(a.key)).sort(
    (a, b) => unlockedAt.get(b.key)!.getTime() - unlockedAt.get(a.key)!.getTime(),
  );
  const upNext = ACHIEVEMENTS.filter((a) => !unlockedAt.has(a.key))
    .map((a) => {
      const [current, target] = a.progress(stats);
      return { a, current, target, ratio: current / target };
    })
    .sort((x, y) => y.ratio - x.ratio);

  const statTiles = [
    { label: "Focus time", value: formatHours(stats.focusMinutes), icon: Timer, hint: "all time" },
    { label: "Days studied", value: String(stats.studyDays), icon: CalendarCheck, hint: "all time" },
    { label: "Goal days", value: String(stats.goalDays), icon: Target, hint: "daily goal met" },
    {
      label: "Quizzes",
      value: String(stats.completedQuizzes),
      icon: Brain,
      hint: stats.perfectQuizzes ? `${stats.perfectQuizzes} perfect` : "completed",
    },
  ];

  return (
    <div className="cram-stagger mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Progress</h1>
        <p className="text-muted-foreground">Every minute you put in, adding up.</p>
      </header>

      {/* Level + streak */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <div data-tour="progress-level" className="flex items-start gap-5">
            <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <span className="text-[0.625rem] font-semibold tracking-wider uppercase">Level</span>
              <span className="text-2xl leading-none font-semibold">{info.level}</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div>
                  <p className="text-lg font-semibold">{info.title}</p>
                  <p className="text-sm text-muted-foreground">{user.xp.toLocaleString()} XP earned</p>
                </div>
                {titleForLevel(info.level + 1) !== info.title && (
                  <p className="text-xs text-muted-foreground">
                    Next title: <span className="text-foreground">{titleForLevel(info.level + 1)}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="h-2 overflow-hidden rounded-full bg-muted-foreground/15">
                  <div
                    className="cram-grow-x h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(2, info.progress * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {info.intoLevel} / {info.levelSpan} XP
                  </span>
                  <span>
                    {info.levelSpan - info.intoLevel} XP to level {info.level + 1}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-baseline gap-2">
                  <Flame
                    className={cn(
                      "size-5 self-center",
                      user.streakCount > 0 ? "fill-streak/25 text-streak" : "text-muted-foreground",
                    )}
                  />
                  <span className="text-3xl font-semibold">{user.streakCount}</span>
                  <span className="text-sm text-muted-foreground">day streak</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Best: {user.longestStreak} days</p>
              </div>
              <div className="flex flex-col items-end gap-1" title="Streak freezes cover a missed day. You earn one a week.">
                <span className="flex gap-1">
                  {Array.from({ length: MAX_FREEZES }, (_, i) => (
                    <Snowflake
                      key={i}
                      className={cn("size-4", i < user.streakFreezes ? "text-frost" : "text-muted-foreground/30")}
                    />
                  ))}
                </span>
                <span className="text-xs text-muted-foreground">
                  {user.streakFreezes} of {MAX_FREEZES} freezes
                </span>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {lastWeek.map((d) => (
                <div key={d.date.getTime()} className="flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      "flex h-7 w-full items-center justify-center rounded-md",
                      d.studied ? "bg-streak/80" : d.frozen ? "bg-frost/40" : "bg-muted-foreground/10",
                      d.isToday && !d.studied && "ring-1 ring-border ring-inset",
                    )}
                    title={`${fmtDay.format(d.date)}: ${d.studied ? "studied" : d.frozen ? "streak freeze" : "no study"}`}
                  >
                    {d.frozen && <Snowflake className="size-3.5 text-frost" />}
                  </span>
                  <span className={cn("text-[0.6875rem]", d.isToday ? "font-medium text-foreground" : "text-muted-foreground")}>
                    {fmtWeekdayLetter.format(d.date)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* The four numbers */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        {statTiles.map(({ label, value, hint, icon: Icon }) => (
          <div key={label} className="flex flex-col gap-1 bg-card px-5 py-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="size-3.5" />
              {label}
            </span>
            <span className="text-2xl font-semibold">{value}</span>
            <span className="text-xs text-muted-foreground">{hint}</span>
          </div>
        ))}
      </section>

      <TimeBreakdownCard initial={timeBreakdown} />

      {/* Activity */}
      <Card
        title="Activity"
        aside={
          <span className="text-xs text-muted-foreground">
            {activeDays} {activeDays === 1 ? "day" : "days"} studied in the last year
          </span>
        }
      >
        <div className="flex gap-2 overflow-x-auto">
          <div className="grid shrink-0 grid-rows-[auto_repeat(7,minmax(0,1fr))] gap-[3px] pt-px text-[0.625rem] text-muted-foreground">
            <span className="h-3.5" />
            {["Mon", "", "Wed", "", "Fri", "", ""].map((d, i) => (
              <span key={i} className="flex items-center leading-none">{d}</span>
            ))}
          </div>
          <div className="min-w-[28rem] flex-1">
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
              {monthLabels.map((m, i) => (
                <span key={i} className="h-3.5 overflow-visible text-[0.625rem] leading-none whitespace-nowrap text-muted-foreground">
                  {m}
                </span>
              ))}
              {/* Column-major: each week is a column of 7 days. */}
              {Array.from({ length: 7 }, (_, d) =>
                weeks.map((week) => {
                  const { date, future, log } = week[d];
                  const frozenOnly = !!log?.frozen && !log.studied;
                  const seconds = log?.seconds || (log?.studied ? 60 : 0);
                  return (
                    <span
                      key={date.getTime()}
                      className={cn(
                        "aspect-square w-full rounded-[3px]",
                        future ? "bg-transparent" : frozenOnly ? "bg-frost/40" : heatClass(seconds, !!log?.goalMet),
                      )}
                      title={
                        future
                          ? undefined
                          : `${fmtDay.format(date)}: ${
                              frozenOnly
                                ? "streak freeze"
                                : log?.seconds
                                  ? `${Math.round(log.seconds / 60)} min${log.goalMet ? ", goal met" : ""}`
                                  : log?.studied
                                    ? "studied"
                                    : "no study"
                            }`
                      }
                    />
                  );
                }),
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
          Less
          <span className="size-3 rounded-[3px] bg-muted-foreground/10" />
          <span className="size-3 rounded-[3px] bg-streak/30" />
          <span className="size-3 rounded-[3px] bg-streak/60" />
          <span className="size-3 rounded-[3px] bg-streak" title="Daily goal met" />
          More
          <span className="ml-3 size-3 rounded-[3px] bg-frost/40" /> Freeze
        </div>
      </Card>

      {/* Achievements */}
      <Card
        title="Achievements"
        aside={
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted-foreground/15">
              <span className="block h-full rounded-full bg-gold" style={{ width: `${(done.length / ACHIEVEMENTS.length) * 100}%` }} />
            </span>
            <span className="tabular-nums">
              {done.length} of {ACHIEVEMENTS.length}
            </span>
          </span>
        }
      >
        <div className="flex flex-col gap-6">
          {upNext.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-medium text-muted-foreground">Up next</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {upNext.map(({ a, current, target }) => (
                  <div key={a.key} className="flex items-center gap-3 rounded-lg border border-dashed p-3">
                    <AchievementBadge icon={a.icon} unlocked={false} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.description}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted-foreground/15">
                          <div className="cram-grow-x h-full rounded-full bg-gold/70" style={{ width: `${(current / target) * 100}%` }} />
                        </div>
                        <span className="text-[0.6875rem] text-muted-foreground tabular-nums">
                          {current}/{target}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {done.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-medium text-muted-foreground">Unlocked</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {done.map((a) => (
                  <div key={a.key} className="flex items-center gap-3 rounded-lg border bg-gold/[0.04] p-3">
                    <AchievementBadge icon={a.icon} unlocked />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.description}</p>
                      <p className="text-[0.6875rem] text-gold">
                        Unlocked {unlockedAt.get(a.key)!.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* How XP works, out of the way until wanted */}
      <details className="group rounded-xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
          How XP works
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <ul className="grid gap-2 px-5 pb-5 text-sm text-muted-foreground sm:grid-cols-2">
          <li>1 XP per minute of focus or note-writing</li>
          <li>10 XP per quiz, +5 per correct answer</li>
          <li>+20 XP for a perfect quiz</li>
          <li>+{GOAL_BONUS_XP} XP when you hit your daily goal</li>
          <li>5 XP per completed task (up to 10 a day)</li>
          <li>A streak freeze every week protects a missed day</li>
        </ul>
      </details>
    </div>
  );
}
