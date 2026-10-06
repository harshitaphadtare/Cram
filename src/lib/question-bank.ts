import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { blocksToText } from "@/lib/blocknote-to-text";
import { generateBankQuestions } from "@/lib/gemini";
import type { Difficulty } from "@/generated/prisma/enums";

/**
 * Question banks: questions written ahead of time per page, so "Quiz me" can start instantly and
 * keep working when the AI is busy — and uses far fewer AI requests.
 *
 * - A bank is 5 EASY + 5 MEDIUM + 5 HARD questions written from one version of the page
 *   (`contentHash`). When the page changes, a fresh bank is written in the background.
 * - Refreshes are throttled per page (REFRESH_EVERY_MS), claimed atomically so two saves can't
 *   both start one, and never delete the old bank unless the new one was written.
 * - Drawing prefers questions from the current version at the requested difficulty, least
 *   recently used first; stale or other-difficulty questions are a fallback during outages.
 */

const PER_DIFFICULTY = 5;
const REFRESH_EVERY_MS = 10 * 60_000;
/** Too little text to write 15 sensible questions from. */
const MIN_CHARS = 150;

export function contentHash(text: string) {
  return createHash("sha256").update(text).digest("hex").slice(0, 24);
}

/** Matches the same question across the bank and past quizzes (quizzes copy the bank's text). */
export function questionKey(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface PastQuestion {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
  sourcePageId: string;
}

/**
 * What this user has already been asked from these pages, judged by their latest attempt at each
 * question: `seen` holds every question asked (to skip when drawing fresh ones), `asked` their text
 * newest first (so the AI can steer clear of it), and `missed` the ones last answered wrong or
 * skipped in a submitted quiz (worth asking again).
 */
export async function loadQuizHistory(userId: string, pageIds: string[]) {
  const rows = await prisma.quizQuestion.findMany({
    where: { sourcePageId: { in: pageIds }, quiz: { userId } },
    select: {
      questionText: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      sourcePageId: true,
      isCorrect: true,
      quiz: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const seen = new Set<string>();
  const asked: string[] = [];
  const missed: PastQuestion[] = [];
  for (const r of rows) {
    const key = questionKey(r.questionText);
    if (seen.has(key)) continue; // only the latest attempt counts
    seen.add(key);
    asked.push(r.questionText);
    if (r.quiz.status === "completed" && r.isCorrect !== true && r.sourcePageId) {
      missed.push({
        questionText: r.questionText,
        options: r.options as string[],
        correctAnswer: r.correctAnswer,
        explanation: r.explanation,
        sourcePageId: r.sourcePageId,
      });
    }
  }
  return { seen, asked, missed };
}

/** How many banked questions at this difficulty, for the pages' current versions, the user hasn't seen. */
export async function countUnseen(hashes: Map<string, string>, difficulty: Difficulty, seen: Set<string>) {
  const rows = await prisma.bankQuestion.findMany({
    where: { pageId: { in: [...hashes.keys()] }, difficulty },
    select: { pageId: true, contentHash: true, questionText: true },
  });
  return rows.filter((r) => r.contentHash === hashes.get(r.pageId) && !seen.has(questionKey(r.questionText))).length;
}

/**
 * Writes a fresh bank for a page if its current content doesn't have one yet. Safe to call often
 * (after every save): it returns quickly unless a refresh is actually due. Never throws.
 */
export async function refreshPageBank(pageId: string, { force = false }: { force?: boolean } = {}) {
  try {
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { id: true, title: true, content: true, bankAttemptAt: true },
    });
    if (!page) return;
    const text = blocksToText(page.content);
    if (text.trim().length < MIN_CHARS) return;
    const hash = contentHash(text);

    const current = await prisma.bankQuestion.count({ where: { pageId, contentHash: hash } });
    if (current >= PER_DIFFICULTY * 2) return; // this version already has a (near-)full bank

    // Claim the refresh atomically: only proceeds if no attempt within the throttle window.
    const cutoff = new Date(Date.now() - (force ? 60_000 : REFRESH_EVERY_MS));
    const claimed = await prisma.page.updateMany({
      where: { id: pageId, OR: [{ bankAttemptAt: null }, { bankAttemptAt: { lt: cutoff } }] },
      data: { bankAttemptAt: new Date() },
    });
    if (claimed.count === 0) return;

    const drafts = await generateBankQuestions({ id: page.id, title: page.title, content: text }, PER_DIFFICULTY);
    if (drafts.length === 0) return;

    // Replace the old bank only now that the new one exists.
    await prisma.$transaction([
      prisma.bankQuestion.deleteMany({ where: { pageId } }),
      prisma.bankQuestion.createMany({
        data: drafts.map((d) => ({ pageId, contentHash: hash, ...d, options: d.options })),
      }),
    ]);
  } catch (err) {
    // Background work: a busy AI or a bad moment just means the next save/visit tries again.
    console.warn(`Question bank refresh skipped for page ${pageId}:`, err instanceof Error ? err.message : err);
  }
}

/** Refreshes the banks of up to `limit` pages that need one, one at a time. Never throws. */
export async function refreshStaleBanks(pageIds: string[], limit = 3) {
  const pages = await prisma.page
    .findMany({ where: { id: { in: pageIds } }, select: { id: true, content: true, bankAttemptAt: true } })
    .catch(() => []);
  const cutoff = Date.now() - REFRESH_EVERY_MS;
  const due: string[] = [];
  for (const p of pages) {
    if (due.length >= limit) break;
    if (p.bankAttemptAt && p.bankAttemptAt.getTime() > cutoff) continue;
    const text = blocksToText(p.content);
    if (text.trim().length < MIN_CHARS) continue;
    const fresh = await prisma.bankQuestion.count({ where: { pageId: p.id, contentHash: contentHash(text) } });
    if (fresh < PER_DIFFICULTY * 2) due.push(p.id);
  }
  for (const id of due) await refreshPageBank(id);
}

export interface DrawnQuestion {
  bankId: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
  sourcePageId: string;
}

/**
 * Picks up to `count` banked questions for a quiz, spread across the pages (round-robin),
 * least recently used first. `hashes` maps each page to its current content hash.
 * Questions in `seen` (by questionKey) are skipped, so the user isn't asked the same thing twice.
 * With `fallback`, questions from older page versions and other difficulties can fill gaps, and
 * seen ones come last rather than being skipped — a repeat beats no quiz during an AI outage.
 */
export async function drawFromBank(params: {
  hashes: Map<string, string>;
  difficulty: Difficulty;
  count: number;
  fallback?: boolean;
  exclude?: Set<string>;
  seen?: Set<string>;
}): Promise<DrawnQuestion[]> {
  const { hashes, difficulty, count, fallback = false, exclude = new Set(), seen = new Set() } = params;
  const pageIds = [...hashes.keys()];
  const rows = await prisma.bankQuestion.findMany({
    where: { pageId: { in: pageIds }, ...(fallback ? {} : { difficulty }) },
    orderBy: [{ lastUsedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
  });

  // Best first: current version + right difficulty, then (fallback only) current version at other
  // difficulties, then older versions.
  const rank = (r: (typeof rows)[number]) =>
    (seen.has(questionKey(r.questionText)) ? 4 : 0) +
    (r.contentHash === hashes.get(r.pageId) ? 0 : 2) +
    (r.difficulty === difficulty ? 0 : 1);
  const usable = rows
    .filter(
      (r) =>
        !exclude.has(r.id) &&
        (fallback || (r.contentHash === hashes.get(r.pageId) && !seen.has(questionKey(r.questionText)))),
    )
    .sort((a, b) => rank(a) - rank(b));

  const byPage = new Map<string, typeof usable>();
  for (const r of usable) byPage.set(r.pageId, [...(byPage.get(r.pageId) ?? []), r]);

  const picked: typeof usable = [];
  for (let round = 0; picked.length < count; round++) {
    let added = false;
    for (const id of pageIds) {
      const q = byPage.get(id)?.[round];
      if (q && picked.length < count) {
        picked.push(q);
        added = true;
      }
    }
    if (!added) break;
  }

  return picked.map((r) => ({
    bankId: r.id,
    questionText: r.questionText,
    options: r.options as string[],
    correctAnswer: r.correctAnswer,
    explanation: r.explanation,
    sourcePageId: r.pageId,
  }));
}

export async function markBankQuestionsUsed(ids: string[]) {
  if (ids.length === 0) return;
  await prisma.bankQuestion.updateMany({ where: { id: { in: ids } }, data: { lastUsedAt: new Date() } });
}

/** Saves questions written live into their pages' banks, so they can be reused. `used` marks them
 * as just asked (written for a quiz) rather than waiting for the next one (written ahead). */
export async function saveLiveQuestionsToBank(
  questions: { questionText: string; options: string[]; correctAnswer: string; explanation: string; sourcePageId: string | null }[],
  difficulty: Difficulty,
  hashes: Map<string, string>,
  { used = true }: { used?: boolean } = {},
) {
  const rows = questions.flatMap((q) => {
    const hash = q.sourcePageId ? hashes.get(q.sourcePageId) : undefined;
    return q.sourcePageId && hash
      ? [
          {
            pageId: q.sourcePageId,
            contentHash: hash,
            difficulty,
            questionText: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            lastUsedAt: used ? new Date() : null,
          },
        ]
      : [];
  });
  if (rows.length > 0) await prisma.bankQuestion.createMany({ data: rows }).catch(() => {});
}
