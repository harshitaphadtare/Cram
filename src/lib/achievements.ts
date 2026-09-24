/**
 * Achievement definitions. Pure data — the server checks criteria in gamification.ts and stores
 * unlocks in UserAchievement; the UI renders from this list (locked ones included, so students can
 * see what to aim for next).
 */

export interface AchievementStats {
  longestStreak: number;
  level: number;
  focusMinutes: number;
  completedQuizzes: number;
  perfectQuizzes: number;
  pagesCreated: number;
  goalDays: number;
  bestMastery: number;
  studyDays: number;
}

export type AchievementIcon =
  | "sprout"
  | "flame"
  | "timer"
  | "brain"
  | "target"
  | "pen"
  | "star"
  | "trophy"
  | "crown";

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  icon: AchievementIcon;
  /** Current value and target, for progress bars on locked achievements. */
  progress: (s: AchievementStats) => [current: number, target: number];
}

const count = (pick: (s: AchievementStats) => number, target: number) => (s: AchievementStats) =>
  [Math.min(pick(s), target), target] as [number, number];

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first-step", title: "First step", description: "Study for the first time", icon: "sprout", progress: count((s) => s.studyDays, 1) },
  { key: "streak-3", title: "Warming up", description: "Reach a 3-day streak", icon: "flame", progress: count((s) => s.longestStreak, 3) },
  { key: "streak-7", title: "On fire", description: "Reach a 7-day streak", icon: "flame", progress: count((s) => s.longestStreak, 7) },
  { key: "streak-30", title: "Unstoppable", description: "Reach a 30-day streak", icon: "flame", progress: count((s) => s.longestStreak, 30) },
  { key: "streak-100", title: "Centurion", description: "Reach a 100-day streak", icon: "crown", progress: count((s) => s.longestStreak, 100) },
  { key: "focus-1h", title: "Deep focus", description: "Focus for 1 hour in total", icon: "timer", progress: count((s) => s.focusMinutes, 60) },
  { key: "focus-10h", title: "In the zone", description: "Focus for 10 hours in total", icon: "timer", progress: count((s) => s.focusMinutes, 600) },
  { key: "focus-50h", title: "Flow state", description: "Focus for 50 hours in total", icon: "timer", progress: count((s) => s.focusMinutes, 3000) },
  { key: "first-quiz", title: "Test yourself", description: "Complete your first quiz", icon: "brain", progress: count((s) => s.completedQuizzes, 1) },
  { key: "quiz-10", title: "Quiz regular", description: "Complete 10 quizzes", icon: "brain", progress: count((s) => s.completedQuizzes, 10) },
  { key: "perfect-score", title: "Flawless", description: "Score 100% on a quiz", icon: "star", progress: count((s) => s.perfectQuizzes, 1) },
  { key: "mastery-80", title: "Know it cold", description: "Reach 80% mastery on a page", icon: "target", progress: count((s) => s.bestMastery, 80) },
  { key: "notes-5", title: "Note taker", description: "Create 5 pages", icon: "pen", progress: count((s) => s.pagesCreated, 5) },
  { key: "notes-25", title: "Librarian", description: "Create 25 pages", icon: "pen", progress: count((s) => s.pagesCreated, 25) },
  { key: "goal-7", title: "Goal getter", description: "Hit your daily goal on 7 days", icon: "target", progress: count((s) => s.goalDays, 7) },
  { key: "level-5", title: "Scholar", description: "Reach level 5", icon: "trophy", progress: count((s) => s.level, 5) },
  { key: "level-10", title: "Expert in the making", description: "Reach level 10", icon: "trophy", progress: count((s) => s.level, 10) },
];

export function isUnlocked(def: AchievementDef, stats: AchievementStats) {
  const [current, target] = def.progress(stats);
  return current >= target;
}

/** Level-ups share the celebration queue with achievements, under keys like "level:7". */
export const LEVEL_KEY_PREFIX = "level:";
