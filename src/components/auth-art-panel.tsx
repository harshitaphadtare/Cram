"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CramLogo } from "@/components/cram-logo";

const LINES = [
  { title: "Remember what you study.", body: "Cram quizzes you right before you'd forget." },
  { title: "A little every day.", body: "Hit your daily goal and watch your streak grow." },
  { title: "Your notes, but smarter.", body: "Turn any page into an AI quiz in one click." },
];

const ROTATE_MS = 5000;

/** Right-hand side of the auth pages: a calm brand panel with a rotating one-line pitch. */
export function AuthArtPanel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % LINES.length), ROTATE_MS);
    return () => clearInterval(t);
  }, []);
  const line = LINES[i];

  return (
    <div className="relative isolate flex h-full flex-col justify-between overflow-hidden rounded-3xl border bg-sidebar p-10">
      {/* Same faint grid as the landing hero, for continuity. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_70%)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <CramLogo size="lg" withWordmark={false} />

      <div className="min-h-36">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="max-w-md text-4xl leading-tight font-semibold">{line.title}</p>
            <p className="mt-3 text-lg text-muted-foreground">{line.body}</p>
          </motion.div>
        </AnimatePresence>
        <div className="mt-8 flex gap-1.5">
          {LINES.map((_, n) => (
            <button
              key={n}
              type="button"
              aria-label={`Show message ${n + 1}`}
              onClick={() => setI(n)}
              className={`h-1.5 rounded-full transition-all duration-300 ${n === i ? "w-6 bg-foreground" : "w-1.5 bg-muted-foreground/30"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
