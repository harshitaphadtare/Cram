"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { QuizVisual, ReviewVisual, StreakVisual, WriteVisual } from "@/components/landing/how-it-works";

// Each pitch is paired with the real Cram UI it describes (same cards as the landing page).
const SLIDES = [
  { title: "Write it down.", body: "Fast, Notion-style notes, one folder per subject.", Visual: WriteVisual },
  { title: "Quiz yourself.", body: "Turn any page into an AI quiz in one click.", Visual: QuizVisual },
  { title: "Review before you forget.", body: "Cram brings topics back right before they fade.", Visual: ReviewVisual },
  { title: "Come back tomorrow.", body: "Hit your daily goal and watch your streak grow.", Visual: StreakVisual },
];

const ROTATE_MS = 6000;
const EASE = [0.22, 1, 0.36, 1] as const;

/** Right-hand side of the auth pages: a product glimpse that cycles with a one-line pitch. */
export function AuthArtPanel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % SLIDES.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [i]); // restart the timer after a manual pick
  const { title, body, Visual } = SLIDES[i];

  return (
    <div className="relative isolate flex h-full flex-col overflow-hidden rounded-3xl border bg-sidebar p-10">
      {/* Faint grid + a soft light behind the card. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_70%)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div aria-hidden className="absolute top-1/2 left-1/2 -z-10 size-[420px] -translate-1/2 rounded-full bg-primary opacity-[0.08] blur-[100px]" />

      <div className="flex flex-1 items-center justify-center py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            className="flex w-full justify-center"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <Visual />
          </motion.div>
        </AnimatePresence>
      </div>

      <div>
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <p className="text-3xl leading-tight font-semibold">{title}</p>
            <p className="mt-2 text-muted-foreground">{body}</p>
          </motion.div>
        </AnimatePresence>
        <div className="mt-6 flex gap-1.5">
          {SLIDES.map((_, n) => (
            <button
              key={n}
              type="button"
              aria-label={`Show slide ${n + 1}`}
              onClick={() => setI(n)}
              className={`h-1.5 rounded-full transition-all duration-300 ${n === i ? "w-6 bg-foreground" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
