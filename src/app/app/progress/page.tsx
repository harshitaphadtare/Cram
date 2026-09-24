import { Brain, Flame, Snowflake, Target, Timer, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { addDays, getAchievementStats, GOAL_BONUS_XP, MAX_FREEZES, userToday } from "@/lib/gamification";
import { levelInfo } from "@/lib/levels";
import { AchievementBadge } from "@/components/gamification/achievement-badge";
import { LevelProgress } from "@/components/gamification/level-progress";
import { cn } from "@/lib/utils";

const WEEKS = 12;

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

export default async function ProgressPage() {
  const user = await requireUser();
  const today = userToday(user.timezone);
  // Heatmap covers whole weeks (Mon–Sun) ending with the current week.
  const weekday = (today.getUTCDay() + 6) % 7;
  const start = addDays(today, -weekday - (WEEKS - 1) * 7);

  const [stats, unlocked, logs] = await Promise.all([
    getAchievementStats(user.id),
    prisma.userAchievement.findMany({ where: { userId: user.id }, select: { key: true, unlockedAt: true } }),
    prisma.streakLog.findMany({ where: { userId: user.id, date: { gte: start } } }),
  ]);

  const unlockedAt = new Map(unlocked.map((u) => [u.key, u.unlockedAt]));
  const byDate = new Map(logs.map((l) => [l.date.getTime(), l]));
  const info = levelInfo(user.xp);
  const dayLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d);
      return { date, future: date > today, log: byDate.get(date.getTime()) };
    }),
  );

  const statTiles = [
    { label: "Current streak", value: `${user.streakCount}`, hint: "days", icon: Flame },
    { label: "Longest streak", value: `${user.longestStreak}`, hint: "days", icon: Trophy },
    { label: "Total focus", value: formatHours(stats.focusMinutes), icon: Timer },
    { label: "Quizzes done", value: `${stats.completedQuizzes}`, icon: Brain },
    { label: "Goal days", value: `${stats.goalDays}`, icon: Target },
    { label: "Streak freezes", value: `${user.streakFreezes}/${MAX_FREEZES}`, icon: Snowflake },
  ];

  return (
    <div className="cram-stagger mx-auto flex w-full max-w-4xl flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Progress</h1>
        <p className="text-muted-foreground">Every minute you put in, adding up.</p>
      </header>

      <section className="flex flex-col gap-5 rounded-xl border bg-card p-6 sm:flex-row sm:items-center">
        <div className="flex size-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <span className="text-[11px] font-medium uppercase">Level</span>
          <span className="text-3xl leading-none font-semibold">{info.level}</span>
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <div>
            <p className="text-lg font-semibold">{info.title}</p>
            <p className="text-sm text-muted-foreground">
              {user.xp.toLocaleString()} XP total · {info.levelSpan - info.intoLevel} XP to level {info.level + 1}
            </p>
          </div>
          <LevelProgress xp={user.xp} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
        {statTiles.map(({ label, value, hint, icon: Icon }) => (
          <div key={label} className="flex flex-col gap-1.5 bg-card px-5 py-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="size-3.5" />
              {label}
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums">{value}</span>
              {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
            </span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Last {WEEKS} weeks</h2>
        <div className="overflow-x-auto rounded-xl border bg-card p-5">
          <div className="flex gap-1">
            {weeks.map((week, i) => (
              <div key={i} className="flex flex-col gap-1">
                {week.map(({ date, future, log }) => {
                  const frozenOnly = !!log?.frozen && !log.studied;
                  const seconds = log?.seconds || (log?.studied ? 60 : 0);
                  return (
                    <span
                      key={date.getTime()}
                      className={cn(
                        "size-3.5 rounded-[3px]",
                        future ? "bg-transparent" : frozenOnly ? "bg-frost/40" : heatClass(seconds, !!log?.goalMet),
                      )}
                      title={
                        future
                          ? undefined
                          : `${dayLabel.format(date)} — ${
                              frozenOnly
                                ? "streak freeze"
                                : log?.seconds
                                  ? `${Math.round(log.seconds / 60)} min${log.goalMet ? " · goal met" : ""}`
                                  : log?.studied
                                    ? "studied"
                                    : "no study"
                            }`
                      }
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            Less
            <span className="size-3 rounded-[3px] bg-muted-foreground/10" />
            <span className="size-3 rounded-[3px] bg-streak/30" />
            <span className="size-3 rounded-[3px] bg-streak/60" />
            <span className="size-3 rounded-[3px] bg-streak" />
            More
            <span className="ml-3 size-3 rounded-[3px] bg-frost/40" /> Freeze
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Achievements · {ACHIEVEMENTS.filter((a) => unlockedAt.has(a.key)).length} of {ACHIEVEMENTS.length}
        </h2>
        <div className="cram-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const at = unlockedAt.get(a.key);
            const [current, target] = a.progress(stats);
            return (
              <div key={a.key} className={cn("flex items-center gap-3 rounded-xl border p-4", at ? "bg-card" : "bg-transparent")}>
                <AchievementBadge icon={a.icon} unlocked={!!at} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className={cn("truncate text-sm font-medium", !at && "text-muted-foreground")}>{a.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.description}</p>
                  {at ? (
                    <p className="text-[11px] text-gold">
                      Unlocked {at.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  ) : (
                    <div className="mt-0.5 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted-foreground/15">
                        <div className="cram-grow-x h-full rounded-full bg-gold/70" style={{ width: `${(current / target) * 100}%` }} />
                      </div>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {current}/{target}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How XP works</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          <li>1 XP per minute of focus or note-writing</li>
          <li>10 XP per quiz, +5 per correct answer</li>
          <li>+20 XP for a perfect quiz</li>
          <li>+{GOAL_BONUS_XP} XP when you hit your daily goal</li>
          <li>5 XP per completed task (up to 10 a day)</li>
          <li>A streak freeze every week protects a missed day</li>
        </ul>
      </section>
    </div>
  );
}
