"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireFolderRole } from "@/lib/permissions";
import { FolderRole, Difficulty } from "@/generated/prisma/enums";
import { generateQuizQuestions } from "@/lib/gemini";
import { blocksToText } from "@/lib/blocknote-to-text";
import { creditActivity, recordPageReviews } from "@/lib/gamification";
import { quizXp } from "@/lib/xp";

export async function startQuiz(input: {
  folderId: string;
  pageIds: string[];
  difficulty: Difficulty;
  questionCount: number;
}) {
  const user = await requireUser();
  await requireFolderRole(input.folderId, user.id, FolderRole.VIEWER);

  if (input.pageIds.length === 0) throw new Error("Select at least one page to quiz on.");

  const pages = await prisma.page.findMany({
    where: { id: { in: input.pageIds }, folderId: input.folderId },
  });
  if (pages.length === 0) throw new Error("Couldn't find the selected pages.");

  const sourcePages = pages.map((p) => ({ id: p.id, title: p.title, content: blocksToText(p.content) }));
  if (!sourcePages.some((p) => p.content.trim())) {
    throw new Error("The selected pages don't have any content to quiz on yet.");
  }

  const questionCount = Math.min(Math.max(input.questionCount, 3), 20);

  const generated = await generateQuizQuestions({
    pages: sourcePages,
    difficulty: input.difficulty,
    count: questionCount,
  });

  if (generated.length === 0) {
    throw new Error("The AI couldn't generate questions from these notes. Try different pages.");
  }

  const folder = await prisma.folder.findUniqueOrThrow({ where: { id: input.folderId } });

  const quiz = await prisma.quiz.create({
    data: {
      userId: user.id,
      folderId: input.folderId,
      title: `${folder.name} quiz — ${new Date().toLocaleDateString()}`,
      difficulty: input.difficulty,
      totalQuestions: generated.length,
      pages: { create: pages.map((p) => ({ pageId: p.id })) },
      questions: {
        create: generated.map((q, i) => ({
          order: i,
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          sourcePageId: q.sourcePageId,
        })),
      },
    },
  });

  return quiz.id;
}

/** Answers aren't scored or saved until the whole quiz is submitted at once — no per-question
 * feedback, matching a real exam rather than a flashcard flow. */
export async function submitFullQuiz(quizId: string, answers: Record<string, string>) {
  const user = await requireUser();
  const quiz = await prisma.quiz.findUniqueOrThrow({
    where: { id: quizId },
    include: { questions: true, pages: { select: { pageId: true } } },
  });
  if (quiz.userId !== user.id) throw new Error("Not your quiz.");
  if (quiz.status === "completed") throw new Error("This quiz was already submitted.");

  let correctCount = 0;
  await prisma.$transaction(
    quiz.questions.map((q) => {
      const userAnswer = answers[q.id] ?? null;
      const isCorrect = userAnswer === q.correctAnswer;
      if (isCorrect) correctCount++;
      return prisma.quizQuestion.update({
        where: { id: q.id },
        data: { userAnswer, isCorrect: userAnswer ? isCorrect : null },
      });
    }),
  );

  await prisma.quiz.update({
    where: { id: quizId },
    data: { status: "completed", correctCount, completedAt: new Date() },
  });

  // Per-page recall feeds spaced repetition. Questions without a source page are attributed to the
  // quiz's only page when there is exactly one.
  const fallbackPageId = quiz.pages.length === 1 ? quiz.pages[0].pageId : null;
  const perPage = new Map<string, { pageId: string; correct: number; total: number }>();
  for (const q of quiz.questions) {
    const pageId = q.sourcePageId ?? fallbackPageId;
    if (!pageId) continue;
    const entry = perPage.get(pageId) ?? { pageId, correct: 0, total: 0 };
    entry.total++;
    if (answers[q.id] === q.correctAnswer) entry.correct++;
    perPage.set(pageId, entry);
  }
  await recordPageReviews(user.id, [...perPage.values()]);

  const { xpGained } = await creditActivity(user.id, {
    bonusXp: quizXp(correctCount, quiz.totalQuestions),
    qualifies: true,
  });
  revalidatePath("/app", "layout");
  revalidatePath("/app/quizzes");

  return { correctCount, totalQuestions: quiz.totalQuestions, xpGained };
}

export async function deleteQuiz(quizId: string) {
  const user = await requireUser();
  const quiz = await prisma.quiz.findUniqueOrThrow({ where: { id: quizId } });
  if (quiz.userId !== user.id) throw new Error("Not your quiz.");

  await prisma.quiz.delete({ where: { id: quizId } });
  revalidatePath("/app/quizzes");
}
