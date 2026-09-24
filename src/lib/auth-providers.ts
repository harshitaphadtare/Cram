import "server-only";

export type OAuthProvider = "google" | "azure";

/**
 * Which social sign-in providers are switched on in Supabase (Authentication → Providers).
 * Reads Supabase's public settings endpoint, so buttons only appear for providers that will
 * actually work. Cached for five minutes.
 */
export async function getEnabledOAuthProviders(): Promise<OAuthProvider[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    const enabled = settings.external ?? {};
    return (["google", "azure"] as const).filter((p) => enabled[p]);
  } catch {
    return [];
  }
}
