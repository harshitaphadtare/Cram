"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/app/actions/onboarding";
import { cn } from "@/lib/utils";

interface TourStep {
  /** Page the step lives on; the tour navigates there before showing it. */
  route: string;
  /** `data-tour` value of the element to spotlight; omit for a centred card. */
  target?: string;
  title: string;
  body: string;
}

interface TourContext {
  firstName: string | null;
  /** First folder, and a page inside one, so folder/editor steps can open real content. */
  folderHref: string | null;
  pageHref: string | null;
}

function buildSteps({ firstName, folderHref, pageHref }: TourContext): TourStep[] {
  const steps: TourStep[] = [
    {
      route: "/app",
      title: firstName ? `Welcome to Cram, ${firstName}!` : "Welcome to Cram!",
      body: "A quick tour of the app. Each step opens the page it's about, so you'll see exactly where everything lives.",
    },
    {
      route: "/app",
      target: "goal",
      title: "Your daily goal",
      body: "Focus sessions and time spent writing notes fill this ring. Study a little every day to grow your streak. Freezes cover the busy days.",
    },
    {
      route: "/app",
      target: "next-step",
      title: "Always know what's next",
      body: "Home suggests the single most useful thing to do right now, like reviewing pages you're about to forget.",
    },
    {
      route: "/app",
      target: "folders",
      title: "One folder per subject",
      body: "Every subject gets a folder in the sidebar. Use the + to create one; hover a folder to see its pages.",
    },
  ];

  if (folderHref) {
    steps.push(
      {
        route: folderHref,
        target: "folder-pages",
        title: "Your notes for this subject",
        body: "All the pages in a folder, with how well you know each one once you've quizzed yourself.",
      },
      {
        route: folderHref,
        target: "quiz-me",
        title: "Quiz yourself with AI",
        body: "Pick some pages and Cram writes a quiz from your own notes. Wrong answers link back to where you wrote it.",
      },
      {
        route: folderHref,
        target: "folder-sidebar",
        title: "To-do and roadmap",
        body: "Keep tasks for this subject here, and list every topic you need to cover so you can tick them off.",
      },
    );
  }

  if (pageHref) {
    steps.push({
      route: pageHref,
      target: "editor",
      title: "Write like in Notion",
      body: "Type / for headings, lists, tables and columns. The ⋯ menu next to the title switches the page to full width.",
    });
  }

  steps.push(
    {
      route: pageHref ?? folderHref ?? "/app",
      target: "search",
      title: "Find anything, fast",
      body: "Press Ctrl+K anywhere to jump to a page or search inside all of your notes.",
    },
    {
      route: "/app/planner",
      target: "planner-input",
      title: "Plan your days",
      body: "Add tasks in plain English, like “revise chapter 4 tomorrow”, and tag them with a subject.",
    },
    {
      route: "/app/pomodoro",
      target: "pomodoro-timer",
      title: "Focus in short bursts",
      body: "Start a 25-minute focus session. The timer keeps running in the top bar while you work in your notes.",
    },
    {
      route: "/app/progress",
      target: "progress-level",
      title: "Watch it add up",
      body: "Every minute of study earns XP. Level up, unlock achievements and see your study history here.",
    },
    {
      route: "/app/settings",
      target: "study-goals",
      title: "Make it yours",
      body: "Set a daily goal that fits your schedule, from 10 minutes to several hours.",
    },
    {
      route: "/app",
      title: "You're all set",
      body: "Start by creating a folder for the subject you're studying right now. You can replay this tour from your profile menu.",
    },
  );
  return steps;
}

const PAD = 8;
const CARD_W = 340;
const GAP = 14;
const TARGET_TIMEOUT_MS = 4000;

type Rect = { top: number; left: number; width: number; height: number };

function findTarget(id?: string): HTMLElement | null {
  if (!id) return null;
  // Several elements can share a target (e.g. mobile + desktop); use the first visible one.
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`);
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/** Places the card beside the spotlight: right, then below, left, above — whichever fits. */
function placeCard(rect: Rect, cardH: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(16, x), vw - CARD_W - 16);
  const clampY = (y: number) => Math.min(Math.max(16, y), vh - cardH - 16);

  if (rect.left + rect.width + GAP + CARD_W < vw - 16) {
    return { left: rect.left + rect.width + GAP, top: clampY(rect.top) };
  }
  if (rect.top + rect.height + GAP + cardH < vh - 16) {
    return { left: clampX(rect.left), top: rect.top + rect.height + GAP };
  }
  if (rect.left - GAP - CARD_W > 16) {
    return { left: rect.left - GAP - CARD_W, top: clampY(rect.top) };
  }
  return { left: clampX(rect.left), top: clampY(rect.top - GAP - cardH) };
}

export const START_TOUR_EVENT = "cram:start-tour";

/**
 * First-run product tour. Each step belongs to a page: the tour navigates there, waits for the
 * element to render, then glides a spotlight onto it with a small explainer card (Skip / Back /
 * Next). Shown once per account; replayable via START_TOUR_EVENT (profile menu → "Take the tour").
 */
export function ProductTour({
  show,
  firstName,
  folderHref,
  pageHref,
}: { show: boolean } & TourContext) {
  const pathname = usePathname();
  const router = useRouter();
  const steps = useMemo(() => buildSteps({ firstName, folderHref, pageHref }), [firstName, folderHref, pageHref]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  // False while navigating to a step's page and waiting for its target to appear.
  const [ready, setReady] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  const step = steps[Math.min(index, steps.length - 1)];
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // First visit: start once the app has settled.
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, [show]);

  // Replays requested from the profile menu.
  useEffect(() => {
    const start = () => {
      setIndex(0);
      setReady(false);
      setOpen(true);
    };
    window.addEventListener(START_TOUR_EVENT, start);
    return () => window.removeEventListener(START_TOUR_EVENT, start);
  }, []);

  // Go to the step's page if we aren't there yet.
  useEffect(() => {
    if (open && pathname !== step.route) router.push(step.route);
  }, [open, pathname, step.route, router]);

  const measure = useCallback(() => {
    const el = findTarget(step.target);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step.target]);

  // Once on the right page, wait for the target to render, scroll it into view, then reveal.
  useEffect(() => {
    if (!open || pathname !== step.route) return;
    let cancelled = false;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout>;

    const poll = () => {
      if (cancelled) return;
      const el = findTarget(step.target);
      if (!step.target || el || Date.now() - startedAt > TARGET_TIMEOUT_MS) {
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
        // Let the page's entrance animation and the scroll settle before measuring.
        timer = setTimeout(() => {
          if (cancelled) return;
          measure();
          setReady(true);
        }, el ? 450 : 150);
        return;
      }
      timer = setTimeout(poll, 100);
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, pathname, step.route, step.target, measure]);

  // Follow the target through scrolls and resizes.
  useEffect(() => {
    if (!open || !ready) return;
    window.addEventListener("resize", measure);
    document.addEventListener("scroll", measure, { capture: true, passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      document.removeEventListener("scroll", measure, { capture: true });
    };
  }, [open, ready, measure]);

  useLayoutEffect(() => {
    if (!open) return;
    const h = cardRef.current?.offsetHeight ?? 200;
    // Positioning depends on the rendered card height, which is only known after layout.
    setCardPos(rect ? placeCard(rect, h) : null);
  }, [open, rect, index, ready]);

  const finish = useCallback(() => {
    setOpen(false);
    setIndex(0);
    void completeOnboarding();
  }, []);

  const goTo = useCallback(
    (i: number) => {
      const target = steps[i];
      // Only hide while switching pages; same-page steps just glide.
      if (target.route !== steps[index].route) setReady(false);
      setIndex(i);
    },
    [steps, index],
  );

  const next = useCallback(() => {
    if (index === steps.length - 1) finish();
    else goTo(index + 1);
  }, [index, steps.length, finish, goTo]);

  const back = useCallback(() => goTo(Math.max(0, index - 1)), [goTo, index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      // Enter is left to the focused button, so it doesn't advance twice.
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, back, finish]);

  if (!mounted) return null;

  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  const centred = !rect;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="tour"
          className="fixed inset-0 z-[100]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
        >
          {/* Spotlight: a transparent hole whose huge shadow dims everything else. */}
          <motion.div
            className="pointer-events-none absolute rounded-xl ring-2 ring-primary/60"
            initial={false}
            animate={
              rect && ready
                ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
                : { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 }
            }
            transition={{ type: "spring", stiffness: 240, damping: 30 }}
            style={{ boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)" }}
          />
          {/* Clicks outside the card don't fall through to the app. */}
          <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-white/80" />
            </div>
          )}

          <motion.div
            ref={cardRef}
            className={cn(
              "absolute w-[340px] max-w-[calc(100vw-32px)] rounded-xl border bg-popover p-5 text-popover-foreground shadow-2xl",
              centred && "top-1/2 left-1/2",
            )}
            initial={false}
            animate={{
              ...(centred
                ? { x: "-50%", y: "-50%", top: "50%", left: "50%" }
                : { x: 0, y: 0, top: cardPos?.top ?? 0, left: cardPos?.left ?? 0 }),
              opacity: ready ? 1 : 0,
              scale: ready ? 1 : 0.97,
            }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            style={{ pointerEvents: ready ? "auto" : "none" }}
          >
            <button
              type="button"
              onClick={finish}
              aria-label="Close tour"
              className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
              >
                <p className="mb-1.5 text-xs text-muted-foreground">
                  {index + 1} of {steps.length}
                </p>
                {(isFirst || isLast) && (
                  <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="size-5" />
                  </span>
                )}
                <h2 id="tour-title" className="pr-6 text-base font-semibold">
                  {step.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted-foreground/15">
                <motion.span
                  className="h-full rounded-full bg-primary"
                  animate={{ width: `${((index + 1) / steps.length) * 100}%` }}
                  transition={{ type: "spring", stiffness: 200, damping: 30 }}
                />
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {isFirst ? (
                  <Button variant="ghost" size="sm" onClick={finish}>
                    Skip
                  </Button>
                ) : (
                  !isLast && (
                    <Button variant="ghost" size="sm" onClick={back}>
                      Back
                    </Button>
                  )
                )}
                <Button size="sm" onClick={next} autoFocus>
                  {isFirst ? "Start tour" : isLast ? "Get started" : "Next"}
                </Button>
              </div>
            </div>
            {!isFirst && !isLast && (
              <button
                type="button"
                onClick={finish}
                className="mt-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Skip tour
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Dispatches the event that (re)starts the product tour. */
export function startProductTour() {
  window.dispatchEvent(new Event(START_TOUR_EVENT));
}
