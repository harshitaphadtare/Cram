import "server-only";
import { prisma } from "@/lib/prisma";
import { questionKey } from "@/lib/question-bank";

const DAY_MS = 86_400_000;
const dateLabel = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" });

/**
 * Estimated recall of one page right now: R = m · 0.9^(t / I), where m is the page's mastery
 * (0–1, from quiz scores), t the days since it was last quizzed, and I its review interval in
 * days. At t = I (the review due date) recall has slipped to 90% of mastery, the usual target
 * for spaced repetition, and it keeps fading the longer a page goes unreviewed.
 */
export function recallNow(mastery: number, lastReviewedAt: Date, intervalDays: number, now: number) {
  const t = Math.max(0, (now - lastReviewedAt.getTime()) / DAY_MS);
  return (mastery / 100) * Math.pow(0.9, t / Math.max(intervalDays, 0.5));
}

export interface QuizRow {
  id: string;
  folderId: string;
  folderName: string;
  folderColor: string;
  createdAt: number;
  dateLabel: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  totalQuestions: number;
  correctCount: number;
  pageCount: number;
  completed: boolean;
  /** 0–100, null until submitted. */
  percent: number | null;
}

export interface SubjectStats {
  folderId: string;
  name: string;
  color: string;
  /** 0–100: mean estimated recall across the subject's quizzed pages. Null before any quiz. */
  retention: number | null;
  /** Different questions whose latest answer was right, out of all different questions asked. */
  conceptsMastered: number;
  conceptsAsked: number;
  pagesQuizzed: number;
  pagesTotal: number;
  dueForReview: number;
  /** Completed quiz scores, oldest first (last 10). */
  scores: number[];
  averageScore: number | null;
  /** The quizzed page with the lowest recall now — the best one to revise next. */
  reviewNext: { pageId: string; title: string; recall: number } | null;
}

export interface QuizHistoryData {
  quizzes: QuizRow[];
  subjects: SubjectStats[];
  overall: {
    completed: number;
    averageScore: number | null;
    questionsAnswered: number;
    conceptsMastered: number;
    conceptsAsked: number;
    retention: number | null;
  };
}

export async function getQuizHistory(userId: string): Promise<QuizHistoryData> {
  const now = Date.now();
  const [quizzes, reviews, answered] = await Promise.all([
    prisma.quiz.findMany({
      where: { userId },
      include: { folder: { select: { id: true, name: true, color: true } }, _count: { select: { pages: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.pageReview.findMany({
      where: { userId },
      select: {
        mastery: true,
        intervalDays: true,
        dueAt: true,
        lastReviewedAt: true,
        page: { select: { id: true, title: true, folderId: true } },
      },
    }),
    prisma.quizQuestion.findMany({
      where: { quiz: { userId, status: "completed" } },
      select: { questionText: true, isCorrect: true, quiz: { select: { folderId: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const folderIds = [...new Set(quizzes.map((q) => q.folderId))];
  const pageCounts = await prisma.page.groupBy({
    by: ["folderId"],
    where: { folderId: { in: folderIds } },
    _count: { _all: true },
  });
  const pagesTotal = new Map(pageCounts.map((p) => [p.folderId, p._count._all]));

  const rows: QuizRow[] = quizzes.map((q) => {
    const completed = q.status === "completed";
    return {
      id: q.id,
      folderId: q.folderId,
      folderName: q.folder.name,
      folderColor: q.folder.color,
      createdAt: q.createdAt.getTime(),
      dateLabel: dateLabel.format(q.createdAt),
      difficulty: q.difficulty,
      totalQuestions: q.totalQuestions,
      correctCount: q.correctCount,
      pageCount: q._count.pages,
      completed,
      percent: completed && q.totalQuestions > 0 ? Math.round((q.correctCount / q.totalQuestions) * 100) : null,
    };
  });

  // Concepts: each different question counts once, judged by its latest answer.
  const concepts = new Map<string, { asked: number; mastered: number }>();
  const seen = new Set<string>();
  for (const a of answered) {
    const key = `${a.quiz.folderId}:${questionKey(a.questionText)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const c = concepts.get(a.quiz.folderId) ?? { asked: 0, mastered: 0 };
    c.asked++;
    if (a.isCorrect === true) c.mastered++;
    concepts.set(a.quiz.folderId, c);
  }

  const average = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

  const subjects: SubjectStats[] = folderIds.map((folderId) => {
    const folder = quizzes.find((q) => q.folderId === folderId)!.folder;
    const pageReviews = reviews.filter((r) => r.page.folderId === folderId);
    const recalls = pageReviews.map((r) => ({
      pageId: r.page.id,
      title: r.page.title || "Untitled",
      recall: recallNow(r.mastery, r.lastReviewedAt, r.intervalDays, now),
    }));
    const weakest = recalls.reduce<(typeof recalls)[number] | null>((w, r) => (!w || r.recall < w.recall ? r : w), null);
    const scores = rows
      .filter((r) => r.folderId === folderId && r.percent !== null)
      .map((r) => r.percent!)
      .reverse()
      .slice(-10);
    const c = concepts.get(folderId) ?? { asked: 0, mastered: 0 };
    return {
      folderId,
      name: folder.name,
      color: folder.color,
      retention: recalls.length ? Math.round((recalls.reduce((s, r) => s + r.recall, 0) / recalls.length) * 100) : null,
      conceptsMastered: c.mastered,
      conceptsAsked: c.asked,
      pagesQuizzed: pageReviews.length,
      pagesTotal: Math.max(pagesTotal.get(folderId) ?? 0, pageReviews.length),
      dueForReview: pageReviews.filter((r) => r.dueAt.getTime() <= now).length,
      scores,
      averageScore: average(scores),
      reviewNext: weakest ? { ...weakest, recall: Math.round(weakest.recall * 100) } : null,
    };
  });
  // Weakest subjects first: that's where revision pays off most.
  subjects.sort((a, b) => (a.retention ?? 101) - (b.retention ?? 101));

  const completedRows = rows.filter((r) => r.percent !== null);
  const allRecalls = reviews.map((r) => recallNow(r.mastery, r.lastReviewedAt, r.intervalDays, now));
  const totals = [...concepts.values()].reduce((t, c) => ({ asked: t.asked + c.asked, mastered: t.mastered + c.mastered }), {
    asked: 0,
    mastered: 0,
  });

  return {
    quizzes: rows,
    subjects,
    overall: {
      completed: completedRows.length,
      averageScore: average(completedRows.map((r) => r.percent!)),
      questionsAnswered: completedRows.reduce((s, r) => s + r.totalQuestions, 0),
      conceptsMastered: totals.mastered,
      conceptsAsked: totals.asked,
      retention: allRecalls.length ? Math.round((allRecalls.reduce((s, r) => s + r, 0) / allRecalls.length) * 100) : null,
    },
  };
}
