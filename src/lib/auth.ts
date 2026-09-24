import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { refreshStreak } from "@/lib/gamification";
import type { User } from "@/generated/prisma/client";

/** Returns the current app User row, creating/syncing it from the Supabase auth session on first call. */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const user = await prisma.user.upsert({
    where: { id: authUser.id },
    update: { email: authUser.email! },
    create: {
      id: authUser.id,
      email: authUser.email!,
      // Email sign-up stores `name`; Google/Microsoft provide `full_name`/`name` and `avatar_url`/`picture`.
      name:
        ((authUser.user_metadata?.name ?? authUser.user_metadata?.full_name) as string | undefined) ?? null,
      avatarUrl:
        ((authUser.user_metadata?.avatar_url ?? authUser.user_metadata?.picture) as string | undefined) ?? null,
    },
  });

  return refreshStreak(user);
}

/** Same as getCurrentUser but redirects to /login when there's no session — for use in protected server components. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
