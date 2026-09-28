import "server-only";

/**
 * Groq as a free backup for writing quizzes when every Gemini model is busy. Uses Groq's
 * OpenAI-compatible Chat Completions API directly (no SDK), with strict structured output
 * (constrained decoding — the reply always matches the schema) on the GPT-OSS models.
 *
 * Free plan (checked in Groq's docs): 30 requests/min and 1K/day per model, but only 8K tokens
 * per minute, input + output together — callers must keep prompts small (see QUIZ_TOKEN_BUDGET).
 *
 * Enabled by setting GROQ_API_KEY (console.groq.com → API Keys). Without it this is skipped.
 */

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
/** Best quality first; the smaller model has its own separate limits. */
const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

/** Free-plan tokens per minute, input + output. */
export const GROQ_TOKENS_PER_MINUTE = 8_000;

export function groqConfigured() {
  return !!process.env.GROQ_API_KEY;
}

export class GroqUnavailableError extends Error {
  constructor(
    message: string,
    readonly reason: "busy" | "quota",
  ) {
    super(message);
  }
}

/**
 * Sends one prompt and returns the model's JSON text, trying each model in turn on rate limits
 * or server errors. Throws GroqUnavailableError if none answered.
 */
export async function groqJson(params: {
  prompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
}): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new GroqUnavailableError("Groq isn't configured.", "busy");

  let sawQuota = false;
  for (const model of MODELS) {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(40_000),
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: params.prompt }],
          response_format: {
            type: "json_schema",
            json_schema: { name: params.schemaName, strict: true, schema: params.schema },
          },
          // GPT-OSS "thinks" before answering, and those tokens count against the 8K/min limit.
          reasoning_effort: "low",
          include_reasoning: false,
          max_completion_tokens: params.maxOutputTokens,
          temperature: 0.7,
        }),
      });
    } catch (err) {
      console.warn(`Groq ${model}: request failed — trying the next model`, err);
      continue;
    }

    if (res.ok) {
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      if (text) return text;
      console.warn(`Groq ${model}: empty reply — trying the next model`);
      continue;
    }

    const detail = await res.text().catch(() => "");
    // 429 = rate limit, 413 = prompt over the per-minute token allowance, 5xx = their side.
    if (res.status === 429 || res.status === 413 || res.status >= 500) {
      if (res.status === 429) sawQuota = true;
      console.warn(`Groq ${model}: ${res.status} — trying the next model`, detail.slice(0, 300));
      continue;
    }
    // 400/401/403 etc. are configuration problems — surface them in the logs, don't mask them.
    console.error(`Groq ${model}: ${res.status}`, detail.slice(0, 500));
    throw new Error(`Groq request failed (${res.status}).`);
  }
  throw new GroqUnavailableError("Every Groq model was unavailable.", sawQuota ? "quota" : "busy");
}
