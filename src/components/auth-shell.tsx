import Link from "next/link";
import { CramLogo } from "@/components/cram-logo";
import { AuthArtPanel } from "@/components/auth-art-panel";

/**
 * Split auth layout: a focused form column on the left, and on large screens a rounded panel
 * with the landing page's 3D study objects and a rotating tagline, so the brand feels continuous
 * from the homepage into the app.
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
  /** e.g. "New to Cram? Sign up" in the top-right corner of the form column. */
  topRight?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-screen flex-col px-6 sm:px-10">
        <header className="flex h-20 items-center justify-between">
          <Link href="/" className="rounded-md transition-opacity hover:opacity-80">
            <CramLogo />
          </Link>
          {topRight && <div className="text-sm text-muted-foreground">{topRight}</div>}
        </header>

        <main className="flex flex-1 items-center justify-center pb-16">
          <div className="flex w-full max-w-[25rem] flex-col gap-8 animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold">{title}</h1>
              {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
            </div>
            {children}
            {footer && <div className="text-sm text-muted-foreground">{footer}</div>}
          </div>
        </main>

        <footer className="pb-6 text-xs text-muted-foreground">© {new Date().getFullYear()} Cram</footer>
      </div>

      <div className="hidden p-3 lg:block">
        <div className="sticky top-3 h-[calc(100vh-1.5rem)]">
          <AuthArtPanel />
        </div>
      </div>
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
