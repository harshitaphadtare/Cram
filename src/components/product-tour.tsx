"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/app/actions/onboarding";
import { cn } from "@/lib/utils";

interface TourStep {
  /** `data-tour` value of the element to spotlight; omit for a centred card. */
  target?: string;
  title: string;
  body: string;
}

const buildSteps = (firstName: string | null): TourStep[] => [
  {
    title: firstName ? `Welcome to Cram, ${firstName}!` : "Welcome to Cram!",
    body: "Here's a one-minute tour of how Cram helps you study a little every day and actually remember it.",
  },
  {
    target: "folders",
    title: "One folder per subject",
    body: "Create a folder for each subject. Inside, write pages of notes, keep a to-do list and a roadmap of every topic to cover.",
  },
  {
    target: "search",
    title: "Find anything, fast",
    body: "Press Ctrl+K from anywhere to jump to a page or search inside all of your notes.",
  },
  {
    target: "goal",
    title: "Your daily goal",
    body: "Focus sessions and time spent writing notes fill this ring. Study a few minutes each day to grow your streak. Freezes cover the busy days.",
  },
  {
    target: "next-step",
    title: "Always know what to do next",
    body: "Cram suggests the most useful thing to do right now, like reviewing pages you're about to forget.",
  },
  {
    target: "pomodoro",
    title: "Focus in short bursts",
    body: "Start a 25-minute focus session. The timer keeps running in the top bar while you work in your notes.",
  },
  {
    target: "level",
    title: "Level up as you learn",
    body: "Every minute of study earns XP. Level up, unlock achievements, and see your history on the Progress page.",
  },
  {
    title: "You're all set",
    body: "Start by creating a folder for the subject you're studying right now. You can replay this tour any time from your profile menu.",
  },
];

const PAD = 8;
const CARD_W = 340;
const GAP = 14;

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
 * First-run product tour: a spotlight that glides between parts of the app with a small card
 * explaining each one (Skip / Back / Next). Shown once per account on the dashboard; replayable
 * via the START_TOUR_EVENT (profile menu → "Take the tour").
 */
export function ProductTour({ show, firstName }: { show: boolean; firstName: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const steps = buildSteps(firstName);
  const [open, setOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState(show);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  const step = steps[index];
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Replays requested from the profile menu.
  useEffect(() => {
    const start = () => setPendingStart(true);
    window.addEventListener(START_TOUR_EVENT, start);
    return () => window.removeEventListener(START_TOUR_EVENT, start);
  }, []);

  // The tour points at dashboard widgets, so it only starts on the dashboard.
  useEffect(() => {
    if (!pendingStart) return;
    if (pathname !== "/app") {
      router.push("/app");
      return;
    }
    // Give the page's entrance animation a moment to settle before measuring.
    const t = setTimeout(() => {
      setIndex(0);
      setOpen(true);
      setPendingStart(false);
    }, 600);
    return () => clearTimeout(t);
  }, [pendingStart, pathname, router]);

  const measure = useCallback(() => {
    const el = findTarget(step?.target);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step?.target]);

  // Bring the target into view, then follow it through scrolls and resizes.
  useEffect(() => {
    if (!open) return;
    const el = findTarget(step?.target);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(measure, el ? 350 : 0);
    window.addEventListener("resize", measure);
    document.addEventListener("scroll", measure, { capture: true, passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      document.removeEventListener("scroll", measure, { capture: true });
    };
  }, [open, step?.target, measure]);

  useLayoutEffect(() => {
    if (!open) return;
    const h = cardRef.current?.offsetHeight ?? 200;
    // Positioning depends on the rendered card height, which is only known after layout.
    setCardPos(rect ? placeCard(rect, h) : null);
  }, [open, rect, index]);

  const finish = useCallback(() => {
    setOpen(false);
    void completeOnboarding();
  }, []);

  const next = useCallback(() => {
    if (index === steps.length - 1) finish();
    else setIndex((i) => i + 1);
  }, [index, steps.length, finish]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

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
              rect
                ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height, opacity: 1 }
                : { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0, opacity: 1 }
            }
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            style={{ boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)" }}
          />
          {/* Clicks outside the card don't fall through to the app. */}
          <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

          <motion.div
            ref={cardRef}
            className={cn(
              "absolute w-[340px] max-w-[calc(100vw-32px)] rounded-xl border bg-popover p-5 text-popover-foreground shadow-2xl",
              centred && "top-1/2 left-1/2",
            )}
            initial={false}
            animate={
              centred
                ? { x: "-50%", y: "-50%", top: "50%", left: "50%" }
                : { x: 0, y: 0, top: cardPos?.top ?? 0, left: cardPos?.left ?? 0 }
            }
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
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
              <div className="flex items-center gap-1" aria-label={`Step ${index + 1} of ${steps.length}`}>
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      i === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/25",
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
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
