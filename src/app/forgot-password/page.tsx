"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLink, AuthShell } from "@/components/auth-shell";

function ForgotPasswordForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // The callback exchanges the recovery code for a session, then sends them to set a new password.
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    // Rate limits are worth surfacing; anything else shows the same neutral confirmation, so the
    // page never reveals whether an address has an account.
    if (error && /rate limit|too many/i.test(error.message)) {
      setError("Too many requests. Please wait a few minutes and try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-8 text-center animate-in fade-in zoom-in-95 duration-300">
        <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="size-5" />
        </span>
        <p className="text-sm text-muted-foreground">
          If an account exists for <span className="font-medium text-foreground">{email}</span>, you&apos;ll
          get an email with a link to reset your password. The link expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading} className="h-10">
        {loading && <Loader2 className="size-4 animate-spin" />}
        {loading ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your account's email and we'll send you a reset link."
      footer={
        <>
          Remembered it? <AuthLink href="/login">Back to log in</AuthLink>
        </>
      }
    >
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
