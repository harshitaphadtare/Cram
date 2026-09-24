import Link from "next/link";
import { CramLogo } from "@/components/cram-logo";

/**
 * Minimal, centered auth layout: brand in the top bar, one focused column for the form, and a
 * quiet footer. No marketing chrome — the task here is just to get the student signed in.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  topRight,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** e.g. "New to Cram? Sign up" in the top-right corner. */
  topRight?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* A barely-there glow behind the form; purely decorative. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,var(--primary)_0%,transparent_65%)] opacity-[0.07]"
      />

      <header className="relative flex h-16 items-center justify-between px-6">
        <Link href="/" className="rounded-md transition-opacity hover:opacity-80">
          <CramLogo />
        </Link>
        {topRight && <div className="text-sm text-muted-foreground">{topRight}</div>}
      </header>

      <main className="relative flex flex-1 items-center justify-center px-6 pb-16">
        <div className="flex w-full max-w-[380px] flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-semibold">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>

      <footer className="relative px-6 pb-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Cram
      </footer>
    </div>
  );
}

/** Consistent inline link style for auth pages. */
export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-foreground underline-offset-4 transition-colors hover:underline">
      {children}
    </Link>
  );
}
