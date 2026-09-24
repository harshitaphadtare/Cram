import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarCheck2, Command, Map as MapIcon, PanelsTopLeft, Timer, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CramLogo } from "@/components/cram-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";

const EXTRAS = [
  { icon: Timer, title: "Focus timer that follows you", body: "Pomodoro sessions keep running while you move between notes." },
  { icon: CalendarCheck2, title: "Planner that speaks English", body: "Type “revise chapter 4 tomorrow” and the date sets itself." },
  { icon: MapIcon, title: "Roadmaps per subject", body: "List every topic in the syllabus and watch the progress bar fill." },
  { icon: Command, title: "Find anything with Ctrl+K", body: "Search titles and the text inside every page, instantly." },
  { icon: PanelsTopLeft, title: "Tabs, columns, full width", body: "Open pages side by side and lay notes out the way you think." },
  { icon: Users, title: "Study with friends", body: "Share a folder, write together, and see who's putting in the hours." },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/app");

  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/75 backdrop-blur-md">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <CramLogo />
          </Link>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button variant="ghost" nativeButton={false} render={<Link href="/login">Log in</Link>} />
            <Button nativeButton={false} render={<Link href="/signup">Get started</Link>} />
          </div>
        </nav>
      </header>

      <main>
        <Hero />
        <HowItWorks />

        <section className="border-t bg-sidebar">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_2fr]">
            <div>
              <h2 className="text-3xl font-semibold">And the small things that add up</h2>
              <p className="mt-3 text-muted-foreground">
                Built by students who wanted one calm place instead of five tabs.
              </p>
            </div>
            <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {EXTRAS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-3.5">
                  <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div>
                    <dt className="font-medium">{title}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-28 text-center sm:px-6">
            <h2 className="text-3xl font-semibold sm:text-5xl">Start your streak today</h2>
            <p className="max-w-md text-muted-foreground">
              Set a daily goal, write your first page, and let Cram handle the rest.
            </p>
            <Button
              size="lg"
              className="group h-11 px-6 text-[15px]"
              nativeButton={false}
              render={
                <Link href="/signup">
                  Create your free account
                  <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              }
            />
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-8 text-sm text-muted-foreground sm:px-6">
          <CramLogo size="sm" />
          <span>© {new Date().getFullYear()} Cram</span>
        </div>
      </footer>
    </div>
  );
}
