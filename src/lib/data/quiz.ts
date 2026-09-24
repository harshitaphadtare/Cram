import "server-only";
import { prisma } from "@/lib/prisma";

export async function getQuizForUser(quizId: string, userId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { sourcePage: { select: { id: true, title: true } } },
      },
      folder: { select: { id: true, name: true, color: true } },
      pages: { include: { page: { select: { id: true, title: true } } } },
    },
  });
  if (!quiz || quiz.userId !== userId) return null;
  return quiz;
}

export async function listQuizzesForUser(userId: string) {
  return prisma.quiz.findMany({
    where: { userId },
    include: { folder: { select: { id: true, name: true, color: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export interface FolderQuizStats {
  /** 1-based position of this quiz among all quizzes (completed or not) taken on this folder. */
  quizNumber: number;
  /** Percent scores of previously *completed* quizzes on this folder, oldest first. */
  previousScores: number[];
  averagePreviousScore: number | null;
  lastScore: number | null;
}

/** Stats for the results dashboard: where this quiz sits in the folder's history, and how past
 * attempts on the same folder compare. */
export async function getFolderQuizStats(
  folderId: string,
  userId: string,
  currentQuizId: string,
): Promise<FolderQuizStats> {
  const quizzes = await prisma.quiz.findMany({
    where: { folderId, userId },
    select: { id: true, status: true, correctCount: true, totalQuestions: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const quizNumber = Math.max(1, quizzes.findIndex((q) => q.id === currentQuizId) + 1);

  const previousCompleted = quizzes.filter(
    (q) => q.id !== currentQuizId && q.status === "completed" && q.totalQuestions > 0,
  );
  const previousScores = previousCompleted.map((q) =>
    Math.round((q.correctCount / q.totalQuestions) * 100),
  );

  return {
    quizNumber,
    previousScores,
    averagePreviousScore:
      previousScores.length > 0
        ? Math.round(previousScores.reduce((a, b) => a + b, 0) / previousScores.length)
        : null,
    lastScore: previousScores.length > 0 ? previousScores[previousScores.length - 1] : null,
  };
}
