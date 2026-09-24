"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-field";
import { checkPassword } from "@/lib/password";

/**
 * Reached from the password-reset email: /auth/callback has already exchanged the recovery code
 * for a session (the middleware sends anyone without one back to /login).
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isStrong } = checkPassword(password);
  const matches = password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isStrong) return setError("Your new password needs to meet every requirement.");
    if (!matches) return setError("The passwords don't match.");
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setError(
        /same.*password|different from the old/i.test(error.message)
          ? "Choose a password you haven't used for this account before."
          : error.message,
      );
      return;
    }
    // Sign out of the recovery session so they log in fresh with the new password.
    await supabase.auth.signOut();
    router.push("/login?reset=success");
  }

  return (
    <AuthShell title="Set a new password" subtitle="Make it strong — you'll use it to log in from now on.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <div className="pt-1">
            <PasswordStrength password={password} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">Confirm new password</Label>
          <PasswordInput
            id="confirm"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            aria-invalid={confirm.length > 0 && !matches}
          />
          {confirm.length > 0 && !matches && (
            <p className="text-xs text-destructive animate-in fade-in">Passwords don&apos;t match yet.</p>
          )}
        </div>
        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading || !isStrong || !matches} className="h-10">
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}
