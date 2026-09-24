"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLink, AuthShell } from "@/components/auth-shell";
import { PasswordInput } from "@/components/auth/password-field";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import type { OAuthProvider } from "@/lib/auth-providers";

function friendlyError(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Try again or reset your password.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first — check your inbox for the link we sent.";
  return message;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") === "auth" ? "That link has expired or was already used. Please try again." : null,
  );
  const [loading, setLoading] = useState(false);
  const passwordUpdated = params.get("reset") === "success";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      setError(friendlyError(error.message));
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {passwordUpdated && !error && (
        <p className="flex items-start gap-2 rounded-lg border border-chart-3/30 bg-chart-3/10 px-3 py-2.5 text-sm animate-in fade-in">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-chart-3" />
          Your password was updated. Log in with your new password.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="h-10"
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href={email ? `/forgot-password?email=${encodeURIComponent(email)}` : "/forgot-password"}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading} className="h-10">
        {loading && <Loader2 className="size-4 animate-spin" />}
        {loading ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}

export function LoginClient({ providers }: { providers: OAuthProvider[] }) {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to pick up where you left off."
      topRight={
        <>
          New to Cram? <AuthLink href="/signup">Sign up</AuthLink>
        </>
      }
    >
      <OAuthButtons providers={providers} />
      {/* useSearchParams needs a Suspense boundary so the page can still be prerendered. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
