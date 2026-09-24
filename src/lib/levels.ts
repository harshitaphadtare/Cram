/**
 * XP → level curve. Reaching level L takes 50·L·(L−1) total XP, so each level costs 100 more XP
 * than the last (L2 at 100, L3 at 300, L5 at 1,000, L10 at 4,500) — early levels come fast to hook
 * new students, later ones mark real, sustained effort. Roughly: 1 XP ≈ 1 minute of study.
 */

export function totalXpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (0.08 * Math.max(0, xp)))) / 2));
}

const TITLES: [minLevel: number, title: string][] = [
  [1, "Newcomer"],
  [3, "Learner"],
  [5, "Scholar"],
  [8, "Achiever"],
  [12, "Expert"],
  [16, "Master"],
  [20, "Sage"],
  [30, "Legend"],
];

export function titleForLevel(level: number): string {
  let title = TITLES[0][1];
  for (const [min, t] of TITLES) if (level >= min) title = t;
  return title;
}

export interface LevelInfo {
  level: number;
  title: string;
  /** XP earned inside the current level. */
  intoLevel: number;
  /** XP the current level spans (from its start to the next level). */
  levelSpan: number;
  /** 0–1 progress toward the next level. */
  progress: number;
}

export function levelInfo(xp: number): LevelInfo {
  const level = levelForXp(xp);
  const start = totalXpForLevel(level);
  const span = totalXpForLevel(level + 1) - start;
  const intoLevel = xp - start;
  return { level, title: titleForLevel(level), intoLevel, levelSpan: span, progress: intoLevel / span };
}
