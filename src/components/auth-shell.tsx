import Link from "next/link";
import { Check, Flame, Snowflake, Sparkles } from "lucide-react";
import { CramLogo } from "@/components/cram-logo";
import { GoalRing } from "@/components/gamification/goal-ring";
import { cn } from "@/lib/utils";

/** A static, miniature slice of the real dashboard — shows what you're signing up for. */
function ProductPreview() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <div className="flex items-center gap-5 rounded-xl border bg-background p-5 shadow-sm">
        <GoalRing minutes={24} goal={30} size={84} stroke={8} />
        <div className="flex flex-col gap-2.5">
          <span className="flex items-center gap-1.5">
            <Flame className="size-5 fill-streak/25 text-streak" />
            <span className="text-lg font-semibold">12</span>
            <span className="text-sm text-muted-foreground">day streak</span>
          </span>
          <div className="flex gap-1">
            {days.map((d, i) => (
              <span
                key={i}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full",
                  i === 3 ? "bg-frost/20 text-frost" : i < 6 ? "bg-streak text-streak-foreground" : "border border-dashed border-muted-foreground/40",
                )}
              >
                {i === 3 ? <Snowflake className="size-3" /> : i < 6 ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-background p-4 shadow-sm">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">Review Organic Chemistry</p>
          <p className="text-xs text-muted-foreground">3 pages are fading — a quick quiz locks them in.</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border bg-background p-4 shadow-sm">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/40">
          <Flame className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium">Achievement unlocked: On fire</p>
          <p className="text-xs text-muted-foreground">Reached a 7-day streak</p>
        </div>
      </div>
    </div>
  );
}

/** Two-column auth layout: product preview on the left (large screens), form on the right. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r bg-sidebar p-10 lg:flex">
        <Link href="/">
          <CramLogo />
        </Link>
        <div className="flex flex-col items-start gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="max-w-md text-3xl leading-tight font-semibold">
              Study a little every day. Remember it for good.
            </h2>
            <p className="max-w-md text-muted-foreground">
              Notes, AI quizzes, spaced review, focus sessions and streaks — one calm place built to
              bring you back tomorrow.
            </p>
          </div>
          <ProductPreview />
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Cram</p>
      </aside>

      <main className="flex flex-col items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <Link href="/" className="lg:hidden">
            <CramLogo />
          </Link>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          <p className="text-sm text-muted-foreground">{footer}</p>
        </div>
      </main>
    </div>
  );
}
