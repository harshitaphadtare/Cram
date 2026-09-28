import { unstable_rethrow } from "next/navigation";

/**
 * Server actions can't usefully *throw* messages at the user: in production Next.js replaces
 * every thrown error with a generic "An error occurred in the Server Components render" (React
 * error #441) so server details don't leak. Actions return an ActionResult instead, and only
 * messages written for users (UserFacingError) are passed through.
 */

export class UserFacingError extends Error {}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function toActionResult<T>(fallback: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    // Redirects (e.g. to /login) and other Next.js control flow must keep propagating.
    unstable_rethrow(err);
    if (err instanceof UserFacingError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: fallback };
  }
}
