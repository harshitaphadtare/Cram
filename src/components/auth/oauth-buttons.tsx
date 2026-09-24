"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { OAuthProvider } from "@/lib/auth-providers";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.28a12 12 0 0 0 0 10.8l4.01-3.1z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.6l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
      <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
      <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
      <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
    </svg>
  );
}

const META: Record<OAuthProvider, { label: string; icon: React.ReactNode; scopes?: string }> = {
  google: { label: "Continue with Google", icon: <GoogleIcon /> },
  // Microsoft (Supabase's "azure" provider) needs the email scope to return the address.
  azure: { label: "Continue with Microsoft", icon: <MicrosoftIcon />, scopes: "email" },
};

/**
 * Social sign-in buttons plus an "or" divider. Renders nothing when no provider is enabled in
 * Supabase. The same flow handles sign-up: a first sign-in creates the account.
 */
export function OAuthButtons({ providers }: { providers: OAuthProvider[] }) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  if (providers.length === 0) return null;

  async function signIn(provider: OAuthProvider) {
    setPending(provider);
    // Clear any saved tabs from a previous account on this browser.
    try {
      window.localStorage.removeItem("cram.tabs");
    } catch {
      // Storage unavailable — nothing to clear.
    }
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: META[provider].scopes,
      },
    });
    // On success the browser is already navigating to the provider.
    if (error) {
      setPending(null);
      toast.error("Couldn't start sign-in. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        {providers.map((p) => (
          <Button
            key={p}
            type="button"
            variant="outline"
            className="h-10 gap-2.5"
            disabled={pending !== null}
            onClick={() => signIn(p)}
          >
            {pending === p ? <Loader2 className="size-4 animate-spin" /> : META[p].icon}
            {META[p].label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or continue with email
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
