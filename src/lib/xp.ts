/** Flat XP rewards for quizzes, shared by the scoring action and the results page. */
export const QUIZ_COMPLETION_XP = 10;
export const XP_PER_CORRECT = 5;
export const PERFECT_QUIZ_XP = 20;

export function quizXp(correct: number, total: number) {
  return QUIZ_COMPLETION_XP + correct * XP_PER_CORRECT + (total > 0 && correct === total ? PERFECT_QUIZ_XP : 0);
}
