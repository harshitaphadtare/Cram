import { GoogleGenAI, ApiError, Type, type Schema } from "@google/genai";
import type { Difficulty } from "@/generated/prisma/enums";

// @google/generative-ai (the SDK this used to be built on) was deprecated by Google on
// 2025-11-30 — no further bug fixes. This uses the current unified SDK instead.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// gemini-3.6-flash's free-tier quota for structured (schema-constrained) JSON output is tight
// enough to 429/503 within a handful of requests — verified directly against the API. Flash-Lite
// is positioned by Google for exactly this kind of high-throughput, low-complexity task, and held
// up reliably (3/3 in back-to-back testing) where 3.6-flash didn't.
const MODEL = "gemini-3.5-flash-lite";

export interface QuizSourcePage {
  id: string;
  title: string;
  content: string;
}

export interface GeneratedQuizQuestion {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  /** Which of the input pages this question was drawn from — null if the model couldn't be sure. */
  sourcePageId: string | null;
}

function buildSchema(multiPage: boolean): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            questionText: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              minItems: "4",
              maxItems: "4",
            },
            correctAnswer: {
              type: Type.STRING,
              description: "Must exactly match one of the strings in options.",
            },
            explanation: {
              type: Type.STRING,
              description: "One or two sentences explaining why the answer is correct.",
            },
            ...(multiPage
              ? {
                  sourcePageNumber: {
                    type: Type.INTEGER,
                    description:
                      "The 1-based number of the source page (from the numbered list in the prompt) this question's content came from.",
                  },
                }
              : {}),
          },
          required: [
            "questionText",
            "options",
            "correctAnswer",
            "explanation",
            ...(multiPage ? ["sourcePageNumber"] : []),
          ],
        },
      },
    },
    required: ["questions"],
  };
}

const DIFFICULTY_GUIDANCE: Record<Difficulty, string> = {
  EASY: "Test recall of basic definitions and facts explicitly stated in the notes. Keep wording simple and direct.",
  MEDIUM: "Test understanding and application of concepts, not just memorization. Include some questions that require connecting two ideas from the notes.",
  HARD: "Test deep understanding, edge cases, and the ability to apply concepts to new scenarios not literally spelled out in the notes. Include tricky distractors.",
};

export async function generateQuizQuestions(params: {
  pages: QuizSourcePage[];
  difficulty: Difficulty;
  count: number;
}): Promise<GeneratedQuizQuestion[]> {
  const { pages, difficulty, count } = params;
  const multiPage = pages.length > 1;

  // A single-source-page quiz needs no page attribution from the model at all — every question
  // trivially belongs to that one page. Asking the model to identify a source page only makes
  // sense (and is only reliable) once there's more than one to choose between, and even then an
  // index into a numbered list holds up far better than asking it to echo a title string exactly.
  const notesContent = pages
    .map((p, i) => `## ${multiPage ? `Page ${i + 1}: ` : ""}${p.title}\n${p.content}`)
    .join("\n\n")
    .slice(0, 60_000);

  const prompt = `You are a study quiz generator. Based ONLY on the study notes below, write exactly ${count} multiple-choice questions.

Difficulty: ${difficulty}. ${DIFFICULTY_GUIDANCE[difficulty]}

Rules:
- Each question must have exactly 4 options.
- Exactly one option must be correct, and "correctAnswer" must match that option string exactly.
- Do not invent facts that aren't supported by the notes.
- Vary question phrasing and avoid trivially guessable options.
- Write a short explanation for each correct answer.
${multiPage ? '- Set "sourcePageNumber" to the numbered page (1, 2, 3, ...) this question\'s content mainly came from.' : ""}

STUDY NOTES:
"""
${notesContent}
"""`;

  const response = await generateWithRetry(() =>
    ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: buildSchema(multiPage),
      },
    }),
  );

  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response.");

  const parsed = JSON.parse(text) as {
    questions: (Omit<GeneratedQuizQuestion, "sourcePageId"> & { sourcePageNumber?: number })[];
  };

  return parsed.questions.map(({ sourcePageNumber, ...q }) => {
    if (!multiPage) return { ...q, sourcePageId: pages[0]?.id ?? null };
    const index = sourcePageNumber ? sourcePageNumber - 1 : -1;
    return { ...q, sourcePageId: pages[index]?.id ?? null };
  });
}

const RETRYABLE_STATUSES = new Set([429, 503]);
const MAX_ATTEMPTS = 3;

/** Gemini's free tier occasionally returns 503 ("high demand") or 429 (rate limit) — both are
 * transient and usually succeed within a couple of seconds, so retry with backoff before giving
 * up rather than failing the quiz generation outright. */
async function generateWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable = err instanceof ApiError && RETRYABLE_STATUSES.has(err.status);
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
    }
  }
  if (lastError instanceof ApiError && RETRYABLE_STATUSES.has(lastError.status)) {
    throw new Error("Gemini is under heavy load right now. Please try again in a minute.");
  }
  throw lastError;
}
