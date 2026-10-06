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
import { after } from "next/server";
import type { GeneratedQuizQuestion } from "@/lib/gemini";
import {
  contentHash,
  countUnseen,
  drawFromBank,
  loadQuizHistory,
  questionKey,
  markBankQuestionsUsed,
  refreshStaleBanks,
  saveLiveQuestionsToBank,
} from "@/lib/question-bank";

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
import { toActionResult, UserFacingError, type ActionResult } from "@/lib/action-result";

export async function startQuiz(input: {
  folderId: string;
  pageIds: string[];
  difficulty: Difficulty;
  questionCount: number;
}): Promise<ActionResult<string>> {
  return toActionResult("Couldn't generate the quiz. Please try again.", () => createQuiz(input));
}

async function createQuiz(input: {
  folderId: string;
  pageIds: string[];
  difficulty: Difficulty;
  questionCount: number;
}) {
  const user = await requireUser();
  await requireFolderRole(input.folderId, user.id, FolderRole.VIEWER);

  if (input.pageIds.length === 0) throw new UserFacingError("Select at least one page to quiz on.");

  const pages = await prisma.page.findMany({
    where: { id: { in: input.pageIds }, folderId: input.folderId },
  });
  if (pages.length === 0) throw new UserFacingError("Couldn't find the selected pages.");

  const sourcePages = pages.map((p) => ({ id: p.id, title: p.title, content: blocksToText(p.content) }));
  if (!sourcePages.some((p) => p.content.trim())) {
    throw new UserFacingError("The selected pages don't have any content to quiz on yet.");
  }

  const questionCount = Math.min(Math.max(input.questionCount, 3), 20);
  const withContent = sourcePages.filter((p) => p.content.trim());
  const hashes = new Map(withContent.map((p) => [p.id, contentHash(p.content)]));

  // What this user has already been asked from these pages. Questions they got right don't come
  // back; ones they got wrong do, as review.
  const history = await loadQuizHistory(user.id, [...hashes.keys()]);

  // 1. Review: up to a quarter of the quiz re-asks questions they last got wrong, with the options
  //    reshuffled so the answer's position can't be memorised.
  const review = shuffle(history.missed)
    .slice(0, Math.floor(questionCount / 4))
    .map((q) => ({ ...q, options: shuffle(q.options) }));
  const freshCount = questionCount - review.length;

  // 2. Banked questions they haven't seen, for these exact page versions (instant, no AI call).
  const banked = await drawFromBank({ hashes, difficulty: input.difficulty, count: freshCount, seen: history.seen });

  // 3. Write the shortfall live, telling the AI what's been asked so it moves on to untested parts
  //    of the notes, or new question formats once they're covered.
  let live: GeneratedQuizQuestion[] = [];
  let liveError: unknown = null;
  const missing = freshCount - banked.length;
  if (missing > 0) {
    // Pages with the fewest banked questions first — that's where the gap is.
    const bankedPerPage = new Map<string, number>();
    for (const q of banked) bankedPerPage.set(q.sourcePageId, (bankedPerPage.get(q.sourcePageId) ?? 0) + 1);
    const needy = [...withContent].sort((a, b) => (bankedPerPage.get(a.id) ?? 0) - (bankedPerPage.get(b.id) ?? 0));
    try {
      live = await generateQuizQuestions({
        pages: banked.length > 0 ? needy.slice(0, Math.max(1, Math.ceil(needy.length / 2))) : withContent,
        difficulty: input.difficulty,
        count: Math.max(3, missing),
        avoid: history.asked,
        // With some banked questions in hand, don't keep the user waiting as long for the rest.
        geminiDeadlineMs: banked.length > 0 ? 20_000 : undefined,
      });
      // The AI sometimes repeats one anyway.
      live = live.filter((q) => !history.seen.has(questionKey(q.questionText)));
    } catch (err) {
      liveError = err;
    }
  }

  // 4. Outage fallback: older banked questions (earlier page versions / other difficulties, unseen
  //    first), then any remaining missed questions.
  let fallback: Awaited<ReturnType<typeof drawFromBank>> = [];
  const freshSoFar = banked.length + Math.min(live.length, missing);
  if (freshSoFar < freshCount) {
    fallback = await drawFromBank({
      hashes,
      difficulty: input.difficulty,
      count: freshCount - freshSoFar,
      fallback: true,
      exclude: new Set(banked.map((q) => q.bankId)),
      seen: history.seen,
    });
  }

  const generated = shuffle([
    ...review,
    ...banked,
    ...live.slice(0, Math.max(0, missing)),
    ...fallback,
  ]).slice(0, questionCount);

  if (generated.length < Math.min(3, questionCount)) {
    if (liveError) throw liveError;
    throw new UserFacingError("The AI couldn't generate questions from these notes. Try different pages.");
  }

  const usedBankIds = [...banked, ...fallback].map((q) => q.bankId);
  after(async () => {
    await markBankQuestionsUsed(usedBankIds);
    if (live.length > 0) await saveLiveQuestionsToBank(live, input.difficulty, hashes);
    // Write the next quiz's questions now if this user is running out of unseen ones, so it starts
    // instantly instead of waiting on the AI.
    try {
      const seenNow = new Set([...history.seen, ...generated.map((q) => questionKey(q.questionText))]);
      if ((await countUnseen(hashes, input.difficulty, seenNow)) < questionCount) {
        const ahead = await generateQuizQuestions({
          pages: withContent,
          difficulty: input.difficulty,
          count: questionCount,
          avoid: [...generated.map((q) => q.questionText), ...history.asked],
        });
        const fresh = ahead.filter((q) => !seenNow.has(questionKey(q.questionText)));
        await saveLiveQuestionsToBank(fresh, input.difficulty, hashes, { used: false });
      }
    } catch (err) {
      console.warn("Writing next quiz's questions skipped:", err instanceof Error ? err.message : err);
    }
    // Top up banks that are missing or out of date, for next time.
    await refreshStaleBanks([...hashes.keys()], 2);
  });

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
export async function submitFullQuiz(
  quizId: string,
  answers: Record<string, string>,
): Promise<ActionResult<{ correctCount: number; totalQuestions: number; xpGained: number }>> {
  return toActionResult("Couldn't submit the quiz. Please try again.", () => scoreQuiz(quizId, answers));
}

async function scoreQuiz(quizId: string, answers: Record<string, string>) {
  const user = await requireUser();
  const quiz = await prisma.quiz.findUniqueOrThrow({
    where: { id: quizId },
    include: { questions: true, pages: { select: { pageId: true } } },
  });
  if (quiz.userId !== user.id) throw new UserFacingError("Not your quiz.");
  if (quiz.status === "completed") throw new UserFacingError("This quiz was already submitted.");

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
