import { GoogleGenAI, Type, type Schema } from "@google/genai";
import type { Difficulty } from "@/generated/prisma/enums";
import { UserFacingError } from "@/lib/action-result";
import { withModelFallback } from "@/lib/gemini-router";
import { GROQ_TOKENS_PER_MINUTE, GroqUnavailableError, groqConfigured, groqJson } from "@/lib/groq";

// @google/generative-ai (the SDK this used to be built on) was deprecated by Google on
// 2025-11-30 — no further bug fixes. This uses the current unified SDK instead.
// A stalled request shouldn't eat the whole time budget: give up on one model after 40s and let
// the router try the next.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!, httpOptions: { timeout: 40_000 } });

// Which model writes a quiz is decided per request by lib/gemini-router.ts: the free tier turns
// requests away per model when it's busy, so the router moves on to another model instead of
// failing. Flash-Lite is tried first — it's the model Google positions for this kind of
// high-throughput structured task.

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

/**
 * The notes to quiz on, with each page trimmed fairly (not just the first pages kept) when they
 * don't fit `maxChars` — Groq's free tier only allows a few thousand tokens per request.
 */
function buildNotes(pages: QuizSourcePage[], multiPage: boolean, maxChars: number) {
  const total = pages.reduce((sum, p) => sum + p.content.length, 0);
  const share = total > maxChars ? maxChars / total : 1;
  return pages
    .map((p, i) => {
      const content = share < 1 ? `${p.content.slice(0, Math.max(400, Math.floor(p.content.length * share)))}…` : p.content;
      return `## ${multiPage ? `Page ${i + 1}: ` : ""}${p.title}\n${content}`;
    })
    .join("\n\n")
    .slice(0, maxChars);
}

function buildPrompt(notes: string, difficulty: Difficulty, count: number, multiPage: boolean) {
  return `You are a study quiz generator. Based ONLY on the study notes below, write exactly ${count} multiple-choice questions.

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
${notes}
"""`;
}

/** The quiz schema in JSON Schema form, for Groq's strict structured output. */
function quizJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["questions"],
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["questionText", "options", "correctAnswer", "explanation", "sourcePageNumber"],
          properties: {
            questionText: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            correctAnswer: { type: "string" },
            explanation: { type: "string" },
            sourcePageNumber: { type: "integer" },
          },
        },
      },
    },
  };
}

/**
 * Writes a quiz: Gemini first (routed across its models), then Groq's free tier as a backup when
 * every Gemini model is busy. With a backup available Gemini gets a shorter time budget.
 */
export async function generateQuizQuestions(params: {
  pages: QuizSourcePage[];
  difficulty: Difficulty;
  count: number;
}): Promise<GeneratedQuizQuestion[]> {
  const { pages, difficulty, count } = params;
  // A single-source-page quiz needs no page attribution from the model at all — every question
  // trivially belongs to that one page. Asking the model to identify a source page only makes
  // sense (and is only reliable) once there's more than one to choose between, and even then an
  // index into a numbered list holds up far better than asking it to echo a title string exactly.
  const multiPage = pages.length > 1;
  const backup = groqConfigured();

  let text: string | undefined;
  try {
    const response = await withModelFallback(
      (model, abortSignal) =>
        ai.models.generateContent({
          model,
          contents: buildPrompt(buildNotes(pages, multiPage, 60_000), difficulty, count, multiPage),
          config: {
            responseMimeType: "application/json",
            responseSchema: buildSchema(multiPage),
            abortSignal,
          },
        }),
      { deadlineMs: backup ? 25_000 : 75_000 },
    );
    text = response.text;
  } catch (err) {
    if (!(err instanceof UserFacingError) || !backup) throw err;
    console.warn("Gemini unavailable — writing the quiz with Groq instead");
    // Fit Groq's free 8K tokens/minute: ~150 output tokens per question plus a reserve for the
    // prompt and the model's (low-effort) reasoning; the notes get what's left (~3.5 chars/token).
    const outputTokens = count * 150 + 700;
    const notesTokens = Math.max(1_000, GROQ_TOKENS_PER_MINUTE - outputTokens - 900);
    try {
      text = await groqJson({
        prompt: buildPrompt(buildNotes(pages, multiPage, notesTokens * 3.5), difficulty, count, multiPage),
        schemaName: "quiz",
        schema: quizJsonSchema(),
        maxOutputTokens: outputTokens,
      });
    } catch (groqErr) {
      if (groqErr instanceof GroqUnavailableError) {
        throw new UserFacingError(
          "Both AI services are busy right now (Google's Gemini and the Groq backup). Please try again in a minute.",
        );
      }
      throw groqErr;
    }
  }

  if (!text) throw new UserFacingError("The AI returned an empty response. Please try again.");

  let parsed: { questions?: (Omit<GeneratedQuizQuestion, "sourcePageId"> & { sourcePageNumber?: number })[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    // Almost always a reply cut off mid-way on a very long quiz.
    throw new UserFacingError("The AI's reply got cut off. Try again, or ask for fewer questions.");
  }

  // Drop any malformed question rather than show a broken one.
  const valid = (parsed.questions ?? []).filter(
    (q) =>
      typeof q?.questionText === "string" &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      q.options.includes(q.correctAnswer),
  );

  return valid.slice(0, count).map(({ sourcePageNumber, ...q }) => {
    if (!multiPage) return { ...q, sourcePageId: pages[0]?.id ?? null };
    const index = sourcePageNumber ? sourcePageNumber - 1 : -1;
    return { ...q, sourcePageId: pages[index]?.id ?? null };
  });
}
