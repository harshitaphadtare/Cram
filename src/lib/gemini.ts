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

/** Gemini's response schema. `multiPage` adds page attribution; `withDifficulty` a per-question
 * difficulty (question banks ask for a mix). */
function buildSchema(multiPage: boolean, withDifficulty = false): Schema {
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
            ...(withDifficulty ? { difficulty: { type: Type.STRING, enum: ["EASY", "MEDIUM", "HARD"] } } : {}),
          },
          required: [
            "questionText",
            "options",
            "correctAnswer",
            "explanation",
            ...(multiPage ? ["sourcePageNumber"] : []),
            ...(withDifficulty ? ["difficulty"] : []),
          ],
        },
      },
    },
    required: ["questions"],
  };
}

/** The same schema as strict JSON Schema, for Groq (strict mode wants every field required). */
function quizJsonSchema(withDifficulty = false) {
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
          required: [
            "questionText",
            "options",
            "correctAnswer",
            "explanation",
            "sourcePageNumber",
            ...(withDifficulty ? ["difficulty"] : []),
          ],
          properties: {
            questionText: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            correctAnswer: { type: "string" },
            explanation: { type: "string" },
            sourcePageNumber: { type: "integer" },
            ...(withDifficulty ? { difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] } } : {}),
          },
        },
      },
    },
  };
}

const DIFFICULTY_GUIDANCE: Record<Difficulty, string> = {
  EASY: "Test recall of basic definitions and facts explicitly stated in the notes. Keep wording simple and direct.",
  MEDIUM: "Test understanding and application of concepts, not just memorization. Include some questions that require connecting two ideas from the notes.",
  HARD: "Test deep understanding, edge cases, and the ability to apply concepts to new scenarios not literally spelled out in the notes. Include tricky distractors.",
};

const QUESTION_RULES = `Rules:
- Each question must have exactly 4 options.
- Exactly one option must be correct, and "correctAnswer" must match that option string exactly.
- Do not invent facts that aren't supported by the notes.
- Vary question phrasing and avoid trivially guessable options.
- Ask direct conceptual questions about the subject itself, as a textbook or exam would. Never refer to the notes, the text, the page, the author or "the definition given" in a question, its options or its explanation — no "according to the notes", "the notes' definition", "as described above" or "what do you think". Bad: "Which core pillar of the notes' definition is violated?" Good: "Which principle of the CIA triad is violated when an attacker gains unauthorized access to data?"
- Write a short explanation for each correct answer.`;

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

function buildQuizPrompt(notes: string, difficulty: Difficulty, count: number, multiPage: boolean) {
  return `You are a study quiz generator. Based ONLY on the study notes below, write exactly ${count} multiple-choice questions.

Difficulty: ${difficulty}. ${DIFFICULTY_GUIDANCE[difficulty]}

${QUESTION_RULES}
${multiPage ? '- Set "sourcePageNumber" to the numbered page (1, 2, 3, ...) this question\'s content mainly came from.' : '- Set "sourcePageNumber" to 1.'}

STUDY NOTES:
"""
${notes}
"""`;
}

function buildBankPrompt(notes: string, perDifficulty: number) {
  return `You are a study quiz generator. Based ONLY on the study notes below, write ${perDifficulty * 3} multiple-choice questions: exactly ${perDifficulty} EASY, ${perDifficulty} MEDIUM and ${perDifficulty} HARD. Cover different parts of the notes rather than repeating one idea.

Set "difficulty" on each question:
- EASY: ${DIFFICULTY_GUIDANCE.EASY}
- MEDIUM: ${DIFFICULTY_GUIDANCE.MEDIUM}
- HARD: ${DIFFICULTY_GUIDANCE.HARD}

${QUESTION_RULES}
- Set "sourcePageNumber" to 1.

STUDY NOTES:
"""
${notes}
"""`;
}

/**
 * Gets quiz-shaped JSON from the AI: Gemini first (routed across its models), then Groq's free
 * tier as a backup when every Gemini model is busy. With a backup available, Gemini gets a shorter
 * time budget. `prompt` receives the character budget for the notes (Groq's is much smaller).
 */
async function writeQuizJson(params: {
  prompt: (maxNotesChars: number) => string;
  multiPage: boolean;
  withDifficulty?: boolean;
  questionCount: number;
  geminiDeadlineMs?: number;
}): Promise<string> {
  const { prompt, multiPage, withDifficulty = false, questionCount } = params;
  const backup = groqConfigured();

  try {
    const response = await withModelFallback(
      (model, abortSignal) =>
        ai.models.generateContent({
          model,
          contents: prompt(60_000),
          config: {
            responseMimeType: "application/json",
            responseSchema: buildSchema(multiPage, withDifficulty),
            abortSignal,
          },
        }),
      { deadlineMs: params.geminiDeadlineMs ?? (backup ? 25_000 : 75_000) },
    );
    if (!response.text) throw new UserFacingError("The AI returned an empty response. Please try again.");
    return response.text;
  } catch (err) {
    if (!(err instanceof UserFacingError) || !backup) throw err;
    console.warn("Gemini unavailable — using Groq instead");
    // Fit Groq's free 8K tokens/minute: ~150 output tokens per question plus a reserve for the
    // prompt and the model's (low-effort) reasoning; the notes get what's left (~3.5 chars/token).
    const outputTokens = questionCount * 150 + 700;
    const notesTokens = Math.max(1_000, GROQ_TOKENS_PER_MINUTE - outputTokens - 900);
    try {
      return await groqJson({
        prompt: prompt(notesTokens * 3.5),
        schemaName: "quiz",
        schema: quizJsonSchema(withDifficulty),
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
}

type RawQuestion = Omit<GeneratedQuizQuestion, "sourcePageId"> & { sourcePageNumber?: number; difficulty?: string };

/** Parses the AI's JSON and drops malformed questions rather than showing a broken one. */
function parseQuestions(text: string): RawQuestion[] {
  let parsed: { questions?: RawQuestion[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    // Almost always a reply cut off mid-way on a very long quiz.
    throw new UserFacingError("The AI's reply got cut off. Try again, or ask for fewer questions.");
  }
  return (parsed.questions ?? []).filter(
    (q) =>
      typeof q?.questionText === "string" &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      q.options.includes(q.correctAnswer),
  );
}

/** Writes a quiz live for the given pages. */
export async function generateQuizQuestions(params: {
  pages: QuizSourcePage[];
  difficulty: Difficulty;
  count: number;
  geminiDeadlineMs?: number;
}): Promise<GeneratedQuizQuestion[]> {
  const { pages, difficulty, count } = params;
  // A single-source-page quiz needs no page attribution from the model at all — every question
  // trivially belongs to that one page. Asking the model to identify a source page only makes
  // sense (and is only reliable) once there's more than one to choose between, and even then an
  // index into a numbered list holds up far better than asking it to echo a title string exactly.
  const multiPage = pages.length > 1;
  const text = await writeQuizJson({
    prompt: (maxChars) => buildQuizPrompt(buildNotes(pages, multiPage, maxChars), difficulty, count, multiPage),
    multiPage,
    questionCount: count,
    geminiDeadlineMs: params.geminiDeadlineMs,
  });

  return parseQuestions(text)
    .slice(0, count)
    .map(({ sourcePageNumber, questionText, options, correctAnswer, explanation }) => ({
      questionText,
      options,
      correctAnswer,
      explanation,
      sourcePageId: multiPage
        ? (pages[(sourcePageNumber ?? 0) - 1]?.id ?? null)
        : (pages[0]?.id ?? null),
    }));
}

export interface BankQuestionDraft {
  difficulty: Difficulty;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

/** Writes a page's question bank: `perDifficulty` questions at each difficulty, in one request. */
export async function generateBankQuestions(page: QuizSourcePage, perDifficulty = 5): Promise<BankQuestionDraft[]> {
  const text = await writeQuizJson({
    prompt: (maxChars) => buildBankPrompt(buildNotes([page], false, maxChars), perDifficulty),
    multiPage: false,
    withDifficulty: true,
    questionCount: perDifficulty * 3,
  });
  return parseQuestions(text)
    .filter((q) => q.difficulty === "EASY" || q.difficulty === "MEDIUM" || q.difficulty === "HARD")
    .map((q) => ({
      difficulty: q.difficulty as Difficulty,
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    }));
}
