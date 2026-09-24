import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Brain,
  Check,
  Flame,
  PenLine,
  Snowflake,
  Sparkles,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CramLogo } from "@/components/cram-logo";
import { GoalRing } from "@/components/gamification/goal-ring";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: PenLine,
    title: "Notes that feel like Notion",
    body: "A clean, fast editor with headings, tables and images. Organise by subject and jump anywhere with Ctrl+K.",
  },
  {
    icon: Brain,
    title: "AI quizzes from your notes",
    body: "Turn any page into a quiz in seconds. Every answer links back to where you wrote it.",
  },
  {
    icon: Sparkles,
    title: "Spaced review, built in",
    body: "Cram tracks what you're forgetting and tells you exactly what to review, and when.",
  },
  {
    icon: Timer,
    title: "Focus sessions",
    body: "A Pomodoro timer that follows you around the app, so you stay in the zone while you write.",
  },
  {
    icon: Flame,
    title: "Streaks, XP and levels",
    body: "A daily goal, streak freezes for busy days, and achievements that reward real studying.",
  },
  {
    icon: Users,
    title: "Study with friends",
    body: "Share folders with classmates, write together, and see who's putting in the work this week.",
  },
];

function HeroPreview() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="relative mx-auto w-full max-w-4xl">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-black/10">
        <div className="flex items-center gap-1.5 border-b bg-sidebar px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          <span className="ml-3 text-xs text-muted-foreground">Home</span>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Tuesday, October 14</p>
              <p className="text-xl font-semibold">Good evening, Maya</p>
            </div>
            <div className="flex items-center gap-5 rounded-xl border bg-background p-4">
              <GoalRing minutes={24} goal={30} size={80} stroke={8} />
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-1.5 text-sm">
                  <Flame className="size-4 fill-streak/25 text-streak" />
                  <b className="font-semibold">12</b> day streak
                </span>
                <div className="flex gap-1">
                  {days.map((d, i) => (
                    <span
                      key={i}
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full",
                        i === 3 ? "bg-frost/20 text-frost" : i < 6 ? "bg-streak text-streak-foreground" : "border border-dashed border-muted-foreground/40",
                      )}
                    >
                      {i === 3 ? <Snowflake className="size-2.5" /> : i < 6 ? <Check className="size-2.5" strokeWidth={3} /> : null}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium tracking-wide text-primary uppercase">Next step</p>
                <p className="text-sm font-medium">Review Organic Chemistry</p>
              </div>
              <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">Start</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border bg-background p-4">
            <p className="text-xs font-medium text-muted-foreground">Due for review</p>
            {[
              ["Alkenes & alkynes", 42],
              ["Stereochemistry", 58],
              ["Reaction mechanisms", 71],
              ["Functional groups", 86],
            ].map(([title, m]) => (
              <div key={title as string} className="flex items-center gap-3 py-1">
                <span className="flex-1 truncate text-sm">{title}</span>
                <span className="h-1 w-14 overflow-hidden rounded-full bg-muted-foreground/15">
                  <span
                    className={cn("block h-full rounded-full", (m as number) >= 80 ? "bg-chart-3" : (m as number) >= 50 ? "bg-gold" : "bg-streak")}
                    style={{ width: `${m}%` }}
                  />
                </span>
                <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">{m}%</span>
              </div>
            ))}
            <div className="mt-auto flex items-center gap-2 border-t pt-3">
              <span className="flex size-7 items-center justify-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/40">
                <Trophy className="size-3.5" />
              </span>
              <span className="text-xs">
                <b className="font-medium">Level 7</b> <span className="text-muted-foreground">· Achiever</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/app");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-transparent bg-background/80 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <CramLogo />
          <div className="flex items-center gap-2">
            <Button variant="ghost" nativeButton={false} render={<Link href="/login">Log in</Link>} />
            <Button nativeButton={false} render={<Link href="/signup">Get started</Link>} />
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
          <span className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Notes, quizzes and focus in one place
          </span>
          <h1 className="max-w-3xl text-4xl leading-[1.1] font-semibold sm:text-6xl">
            Study a little every day.
            <br />
            <span className="text-muted-foreground">Remember it for good.</span>
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Cram turns your notes into quizzes, tells you what you&apos;re about to forget, and makes
            showing up every day feel good.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              className="h-11 px-5 text-[15px]"
              nativeButton={false}
              render={
                <Link href="/signup">
                  Start studying free
                  <ArrowRight />
                </Link>
              }
            />
            <Button size="lg" variant="outline" className="h-11 px-5 text-[15px]" nativeButton={false} render={<Link href="/login">Log in</Link>} />
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6">
          <HeroPreview />
        </section>

        <section className="border-t bg-sidebar px-4 py-24 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-12">
            <div className="flex max-w-2xl flex-col gap-3">
              <h2 className="text-3xl font-semibold">Everything you need to actually learn it</h2>
              <p className="text-muted-foreground">
                Most study apps help you take notes. Cram helps you keep what&apos;s in them.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex flex-col gap-3 bg-background p-6">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Icon className="size-4" />
                  </span>
                  <h3 className="font-medium">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-24 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <h2 className="text-3xl font-semibold">Your future self will thank you</h2>
            <p className="text-muted-foreground">Set a daily goal, start a streak, and see it add up.</p>
            <Button
              size="lg"
              className="h-11 px-5 text-[15px]"
              nativeButton={false}
              render={
                <Link href="/signup">
                  Create your free account
                  <ArrowRight />
                </Link>
              }
            />
          </div>
        </section>
      </main>

      <footer className="border-t px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-sm text-muted-foreground">
          <CramLogo size="sm" />
          <span>© {new Date().getFullYear()} Cram</span>
        </div>
      </footer>
    </div>
  );
}
