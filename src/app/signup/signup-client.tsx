"use client";

import { useState } from "react";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLink, AuthShell } from "@/components/auth-shell";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-field";
import { checkPassword } from "@/lib/password";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import type { OAuthProvider } from "@/lib/auth-providers";

export function SignupClient({ providers }: { providers: OAuthProvider[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { isStrong } = checkPassword(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isStrong) {
      setError("Choose a stronger password — it needs to meet every requirement below.");
      return;
    }
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle={
          <>
            We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>.
          </>
        }
        footer={
          <>
            Wrong address?{" "}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Go back
            </button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-8 text-center animate-in fade-in zoom-in-95 duration-300">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">
            Open the link to activate your account. It can take a minute to arrive — check your spam
            folder if you don&apos;t see it.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free forever. Takes under a minute."
      topRight={
        <>
          Have an account? <AuthLink href="/login">Log in</AuthLink>
        </>
      }
    >
      <OAuthButtons providers={providers} />
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            aria-describedby="password-requirements"
          />
          <div id="password-requirements" className="pt-1">
            <PasswordStrength password={password} />
          </div>
        </div>
        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading || !isStrong} className="h-10">
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
