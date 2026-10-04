import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CramLogo } from "@/components/cram-logo";
import { EMAIL_PREFS, isEmailPref, verifyUnsubscribe } from "@/lib/email/unsubscribe";
import { unsubscribeFromEmail } from "@/app/actions/email";

export const metadata: Metadata = { title: "Email preferences · Cram" };

/**
 * Landing page for the "Unsubscribe" link in reminder emails. It asks for a click rather than
 * unsubscribing on load, because mail scanners open every link in an email automatically.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { u, p, t, done } = await searchParams;

  let body: React.ReactNode;
  if (done && done !== "invalid") {
    body = (
      <>
        <CheckCircle2 className="size-8 text-primary" />
        <h1 className="text-xl font-semibold">You&apos;re unsubscribed</h1>
        <p className="text-muted-foreground">
          {done === "all"
            ? "Cram won't send you any more reminder emails."
            : `You won't get ${isEmailPref(done) ? EMAIL_PREFS[done].label.toLowerCase() : "these"} emails any more.`}{" "}
          You can turn them back on in Settings at any time.
        </p>
        <Button variant="outline" className="mt-2" nativeButton={false} render={<Link href="/app/settings">Email settings</Link>} />
      </>
    );
  } else if (done === "invalid" || !u || !t || !isEmailPref(p) || !verifyUnsubscribe(u, p, t)) {
    body = (
      <>
        <h1 className="text-xl font-semibold">This link doesn&apos;t work</h1>
        <p className="text-muted-foreground">
          It may be incomplete. You can turn emails off in Settings instead.
        </p>
        <Button variant="outline" className="mt-2" nativeButton={false} render={<Link href="/app/settings">Email settings</Link>} />
      </>
    );
  } else {
    body = (
      <>
        <h1 className="text-xl font-semibold">Unsubscribe from {EMAIL_PREFS[p].label.toLowerCase()}?</h1>
        <p className="text-muted-foreground">Your notes, streak and progress aren&apos;t affected.</p>
        <form action={unsubscribeFromEmail} className="mt-2 flex w-full flex-col gap-2">
          <input type="hidden" name="u" value={u} />
          <input type="hidden" name="p" value={p} />
          <input type="hidden" name="t" value={t} />
          <Button type="submit">Unsubscribe</Button>
          <Button type="submit" name="all" value="1" variant="ghost" className="text-muted-foreground">
            Turn off all Cram emails
          </Button>
        </form>
      </>
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-12">
      <Link href="/" aria-label="Cram home">
        <CramLogo />
      </Link>
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center">
        {body}
      </div>
    </main>
  );
}
