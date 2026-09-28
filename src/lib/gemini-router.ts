import "server-only";
import { ApiError } from "@google/genai";
import { UserFacingError } from "@/lib/action-result";

/**
 * Gemini's free tier turns requests away per model when that model is busy (503 "high demand")
 * or its quota is spent (429) — while other models are fine at the same moment. Verified
 * directly: 7 of 8 flash models 503'd while another answered. So a request isn't tied to one
 * model; it walks a list of interchangeable ones:
 *
 * - a model that turns us away is skipped for a cool-down (longer for quota) and the next one
 *   tried at once — rejections come back in 1–3s, so trying several is cheap;
 * - a model that neither answers nor rejects (it happens: one hung for 40s) is *hedged*: after
 *   HEDGE_AFTER_MS the next model starts alongside it, the first success wins, the rest are
 *   cancelled;
 * - the model that last worked goes first next time;
 * - if every model is busy, wait briefly and go round again, until the deadline.
 *
 * State lives per server instance — enough to avoid hammering a model that just failed.
 */

/** Interchangeable models for structured JSON (quiz writing), cheapest/fastest first. */
export const TEXT_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
];

/** A healthy model writes a quiz well within this; past it, start the next model in parallel. */
const HEDGE_AFTER_MS = 12_000;
const BUSY_COOLDOWN_MS = 45_000;
const QUOTA_COOLDOWN_MS = 10 * 60_000;
const GONE_COOLDOWN_MS = 24 * 60 * 60_000;

const coolingUntil = new Map<string, number>();
let lastGood: string | null = null;

type Failure = "busy" | "quota" | "gone" | "timeout";

function classify(err: unknown): Failure | null {
  if (err instanceof ApiError) {
    if (err.status === 429) return "quota";
    if ([500, 502, 503, 504].includes(err.status)) return "busy";
    // Retired/renamed model ("no longer available") — skip it rather than fail the request.
    if (err.status === 404) return "gone";
    return null;
  }
  if (err instanceof Error && /timed? ?out|abort|ETIMEDOUT|ECONNRESET|fetch failed/i.test(`${err.name} ${err.message}`)) {
    return "timeout";
  }
  return null;
}

/** Ready models (last good first), then the ones still cooling down, soonest-ready first. */
function order(models: string[]): string[] {
  const now = Date.now();
  const ready = models.filter((m) => (coolingUntil.get(m) ?? 0) <= now);
  const cooling = models
    .filter((m) => (coolingUntil.get(m) ?? 0) > now)
    .sort((a, b) => (coolingUntil.get(a) ?? 0) - (coolingUntil.get(b) ?? 0));
  const readyFirst = lastGood && ready.includes(lastGood) ? [lastGood, ...ready.filter((m) => m !== lastGood)] : ready;
  return [...readyFirst, ...cooling];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type RoundResult<T> = { ok: true; value: T } | { ok: false; failures: Failure[]; lastError: unknown };

/**
 * One pass over `models`: start the first; start the next whenever one fails, or when the
 * running ones have taken longer than HEDGE_AFTER_MS. Resolves with the first success.
 */
function runRound<T>(
  models: string[],
  call: (model: string, signal: AbortSignal) => Promise<T>,
  deadline: number,
): Promise<RoundResult<T>> {
  return new Promise((resolve, reject) => {
    const controllers = new Map<string, AbortController>();
    const failures: Failure[] = [];
    let lastError: unknown;
    let next = 0;
    let running = 0;
    let done = false;
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: RoundResult<T> | { error: unknown }) => {
      if (done) return;
      done = true;
      clearTimeout(hedgeTimer);
      controllers.forEach((c) => c.abort()); // cancel the losers
      if ("error" in result) reject(result.error);
      else resolve(result);
    };

    const launch = () => {
      clearTimeout(hedgeTimer);
      if (done) return;
      if (next >= models.length || Date.now() >= deadline) {
        if (running === 0) finish({ ok: false, failures, lastError });
        return;
      }
      const model = models[next++];
      const controller = new AbortController();
      controllers.set(model, controller);
      running++;
      call(model, controller.signal).then(
        (value) => {
          lastGood = model;
          coolingUntil.delete(model);
          finish({ ok: true, value });
        },
        (err) => {
          running--;
          controllers.delete(model);
          if (done) return;
          const failure = classify(err);
          if (!failure) return finish({ error: err }); // a real error (bad request) — don't mask it
          lastError = err;
          failures.push(failure);
          coolingUntil.set(
            model,
            Date.now() + (failure === "quota" ? QUOTA_COOLDOWN_MS : failure === "gone" ? GONE_COOLDOWN_MS : BUSY_COOLDOWN_MS),
          );
          if (lastGood === model) lastGood = null;
          console.warn(`Gemini ${model}: ${failure} — trying the next model`);
          launch();
        },
      );
      // Hedge: if nothing has come back in a while, bring in the next model alongside.
      hedgeTimer = setTimeout(launch, HEDGE_AFTER_MS);
    };

    launch();
  });
}

/**
 * Runs `call` against the first model that accepts it. Throws a UserFacingError explaining the
 * real reason (busy vs. quota) only if no model answered before `deadlineMs`.
 */
export async function withModelFallback<T>(
  call: (model: string, signal: AbortSignal) => Promise<T>,
  { models = TEXT_MODELS, deadlineMs = 75_000 }: { models?: string[]; deadlineMs?: number } = {},
): Promise<T> {
  const deadline = Date.now() + deadlineMs;
  const failures: Failure[] = [];
  let lastError: unknown;

  for (let round = 0; Date.now() < deadline; round++) {
    const result = await runRound(order(models), call, deadline);
    if (result.ok) return result.value;
    failures.push(...result.failures);
    lastError = result.lastError;
    // Every model turned us away: give demand a moment to ease, then go round again.
    await sleep(Math.min(3_000 * (round + 1), Math.max(0, deadline - Date.now())));
  }

  console.error("All Gemini models unavailable", lastError);
  const allQuota = failures.length > 0 && failures.every((f) => f === "quota" || f === "gone");
  throw new UserFacingError(
    allQuota
      ? "Today's free AI quota is used up. Quizzes will work again once it resets (within 24 hours)."
      : "Google's AI is very busy right now and every model turned the request away. Please try again in a minute.",
  );
}
