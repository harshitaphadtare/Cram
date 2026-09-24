"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { Brain, Check, Flame, PenLine, RotateCcw, Snowflake } from "lucide-react";
import { GoalRing } from "@/components/gamification/goal-ring";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

const STEPS = [
  {
    icon: PenLine,
    title: "Write it down",
    body: "Take notes in a fast, Notion-style editor: headings, tables, columns, images. Every subject gets its own folder.",
  },
  {
    icon: Brain,
    title: "Quiz yourself",
    body: "One click turns any page into a quiz. Wrong answers link straight back to the paragraph you wrote.",
  },
  {
    icon: RotateCcw,
    title: "Review before you forget",
    body: "Cram tracks how well you know each page and brings it back right before it would fade.",
  },
  {
    icon: Flame,
    title: "Come back tomorrow",
    body: "A daily goal, a streak with freezes for busy days, and achievements that reward real studying.",
  },
];

/* ---------- The four visuals ---------- */

function PanelFrame({ children }: { children: React.ReactNode }) {
  return <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl shadow-black/5">{children}</div>;
}

function WriteVisual() {
  const text = "Photosynthesis turns light energy into chemical energy stored in glucose.";
  const reduce = useReducedMotion();
  return (
    <PanelFrame>
      <p className="text-xs text-muted-foreground">Biology / Plant cells</p>
      <p className="mt-3 text-2xl font-bold">Photosynthesis</p>
      <p className="mt-4 text-lg font-semibold">Key idea</p>
      <p className="mt-1 text-[15px] leading-relaxed">
        {text.split("").map((ch, i) => (
          <motion.span
            key={i}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.018, duration: 0.01 }}
          >
            {ch}
          </motion.span>
        ))}
        <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-foreground" />
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {["Light reactions", "Calvin cycle"].map((t) => (
          <div key={t} className="rounded-lg border p-3">
            <p className="text-sm font-medium">{t}</p>
            <div className="mt-2 flex flex-col gap-1.5">
              <span className="h-1.5 w-full rounded-full bg-muted-foreground/15" />
              <span className="h-1.5 w-3/4 rounded-full bg-muted-foreground/15" />
            </div>
          </div>
        ))}
      </div>
    </PanelFrame>
  );
}

function QuizVisual() {
  const options = ["Chemical to light energy", "Light to chemical energy", "Heat to light energy"];
  return (
    <PanelFrame>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Question 3 of 8</span>
        <span>Medium</span>
      </div>
      <p className="mt-3 font-medium">What does photosynthesis convert?</p>
      <div className="mt-4 flex flex-col gap-2">
        {options.map((o, i) => (
          <motion.div
            key={o}
            initial={{ borderColor: "var(--border)", backgroundColor: "transparent" }}
            animate={
              i === 1
                ? { borderColor: "var(--chart-3)", backgroundColor: "color-mix(in oklch, var(--chart-3) 12%, transparent)" }
                : {}
            }
            transition={{ delay: 0.8, duration: 0.4 }}
            className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm"
          >
            {o}
            {i === 1 && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9, type: "spring", stiffness: 400, damping: 18 }}>
                <Check className="size-4 text-chart-3" strokeWidth={3} />
              </motion.span>
            )}
          </motion.div>
        ))}
      </div>
      <motion.p
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="mt-4 text-xs text-muted-foreground"
      >
        Correct. Linked to <span className="text-foreground">Photosynthesis › Key idea</span>
      </motion.p>
    </PanelFrame>
  );
}

function ReviewVisual() {
  const rows: [string, number, boolean][] = [
    ["Calvin cycle", 38, true],
    ["Light reactions", 54, true],
    ["Cell membranes", 72, false],
    ["Mitochondria", 91, false],
  ];
  return (
    <PanelFrame>
      <div className="flex items-center justify-between">
        <p className="font-medium">Biology mastery</p>
        <span className="rounded-full bg-streak/15 px-2 py-0.5 text-xs text-streak">2 due today</span>
      </div>
      <div className="mt-4 flex flex-col gap-3.5">
        {rows.map(([title, value, due], i) => (
          <div key={title} className="flex items-center gap-3">
            <span className={cn("flex-1 text-sm", due && "font-medium")}>{title}</span>
            <span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted-foreground/15">
              <motion.span
                className={cn(
                  "block h-full rounded-full",
                  value >= 80 ? "bg-chart-3" : value >= 50 ? "bg-gold" : "bg-streak",
                )}
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.8, ease: EASE }}
              />
            </span>
            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{value}%</span>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg bg-primary/[0.06] px-3 py-2.5 text-sm">
        Review <span className="font-medium">Calvin cycle</span> today, before it fades.
      </div>
    </PanelFrame>
  );
}

function StreakVisual() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <PanelFrame>
      <div className="flex items-center gap-5">
        <GoalRing minutes={30} goal={30} size={92} stroke={9} />
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5">
            <Flame className="size-5 fill-streak/25 text-streak" />
            <span className="text-lg font-semibold">12</span>
            <span className="text-sm text-muted-foreground">day streak</span>
          </span>
          <div className="flex gap-1">
            {days.map((d, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.07, type: "spring", stiffness: 380, damping: 20 }}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full",
                  i === 3 ? "bg-frost/20 text-frost" : "bg-streak text-streak-foreground",
                )}
                title={d}
              >
                {i === 3 ? <Snowflake className="size-3" /> : <Check className="size-3" strokeWidth={3} />}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5, ease: EASE }}
        className="mt-5 flex items-center gap-3 rounded-lg border p-3"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/40">
          <Flame className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium">Achievement unlocked</p>
          <p className="text-xs text-muted-foreground">On fire: a 7-day streak</p>
        </div>
      </motion.div>
    </PanelFrame>
  );
}

const VISUALS = [WriteVisual, QuizVisual, ReviewVisual, StreakVisual];

/* ---------- Section ---------- */

/**
 * Scroll-driven walkthrough: the step list and its visual stay pinned while scrolling through
 * the section advances the active step. On small screens it becomes a plain stacked list.
 */
export function HowItWorks() {
  const target = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const next = Math.min(STEPS.length - 1, Math.floor(v * STEPS.length));
    if (next !== active) setActive(next);
  });

  const Visual = VISUALS[active];

  return (
    <section id="how-it-works" className="border-t">
      <div className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <h2 className="max-w-xl text-3xl font-semibold sm:text-4xl">How Cram helps it stick</h2>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Four habits, one loop. Cram handles the scheduling so you only have to show up.
        </p>
      </div>

      {/* Desktop: pinned story */}
      <div ref={target} className="relative hidden lg:block" style={{ height: `${STEPS.length * 70}vh` }}>
        <div className="sticky top-0 mx-auto grid h-screen max-w-6xl grid-cols-[1fr_1.1fr] items-center gap-16 px-6">
          <ol className="relative flex flex-col gap-2">
            {/* Progress rail */}
            <span className="absolute top-3 bottom-3 left-[19px] w-px bg-border" aria-hidden />
            <motion.span
              aria-hidden
              className="absolute top-3 left-[19px] w-px origin-top bg-primary"
              style={{ height: "calc(100% - 24px)", scaleY: scrollYProgress }}
            />
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative flex gap-4 py-3">
                <span
                  className={cn(
                    "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border bg-background transition-colors duration-300",
                    i <= active ? "border-primary text-primary" : "text-muted-foreground",
                  )}
                >
                  <step.icon className="size-4" />
                </span>
                <div className={cn("transition-opacity duration-300", i === active ? "opacity-100" : "opacity-45")}>
                  <p className="font-medium">{step.title}</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="flex justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                className="flex w-full justify-center"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.98 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <Visual />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Mobile / tablet: stacked */}
      <div className="mx-auto flex max-w-xl flex-col gap-14 px-4 py-14 sm:px-6 lg:hidden">
        {STEPS.map((step, i) => {
          const V = VISUALS[i];
          return (
            <div key={step.title} className="flex flex-col gap-5">
              <div className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border text-primary">
                  <step.icon className="size-4" />
                </span>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                </div>
              </div>
              <V />
            </div>
          );
        })}
      </div>
    </section>
  );
}
