import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { refreshStreak } from "@/lib/gamification";
import type { User } from "@/generated/prisma/client";

/**
 * Returns the current app User row, creating it from the Supabase session on first sign-in.
 *
 * Performance notes — this runs on every page render, so it's kept to the minimum:
 * - `getClaims()` verifies the session JWT locally against the project's cached signing keys
 *   (asymmetric ES256), instead of `getUser()`'s network round trip to Supabase Auth.
 * - Wrapped in React `cache()`, so the layout and the page share one lookup per request.
 * - Reads first and only writes when the row is missing or the email changed (the old upsert
 *   wrote to the database on every navigation).
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const id = claims.sub;
  const email = claims.email ?? "";
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;

  let user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    user = await prisma.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        email,
        // Email sign-up stores `name`; Google provides `full_name`/`name` and `avatar_url`/`picture`.
        name: ((meta.name ?? meta.full_name) as string | undefined) ?? null,
        avatarUrl: ((meta.avatar_url ?? meta.picture) as string | undefined) ?? null,
      },
    });
  } else if (email && user.email !== email) {
    user = await prisma.user.update({ where: { id }, data: { email } });
  }

  return refreshStreak(user);
});

/** Same as getCurrentUser but redirects to /login when there's no session — for use in protected server components. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
