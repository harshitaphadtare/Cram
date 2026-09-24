/** Daily study-goal quick picks, in minutes. Any whole number in [MIN_GOAL, MAX_GOAL] is allowed. */
export const DAILY_GOAL_OPTIONS = [10, 20, 30, 45, 60, 90] as const;
export const MIN_GOAL_MIN = 5;
export const MAX_GOAL_MIN = 12 * 60;

export function formatGoal(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h} ${h === 1 ? "hour" : "hours"}`;
}
