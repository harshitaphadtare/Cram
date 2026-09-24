"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const EASE = [0.22, 1, 0.36, 1] as const;

function RevealLine({ text, delay, muted = false }: { text: string; delay: number; muted?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <span className="block">
      {text.split(" ").map((word, i) => (
        // Each word rises out of its own clipping box.
        <span key={i} className="inline-block overflow-hidden pb-[0.1em] align-bottom">
          <motion.span
            className={`inline-block ${muted ? "text-muted-foreground" : ""}`}
            initial={reduce ? false : { y: "110%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: delay + i * 0.06 }}
          >
            {word}
            {" "}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Clean, typographic hero: the headline is the one animated moment on the page. */
export function Hero() {
  const reduce = useReducedMotion();
  const fade = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, ease: EASE, delay },
        };

  return (
    <section className="relative isolate overflow-hidden">
      {/* Faint grid that fades out toward the edges — texture, not decoration. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 pt-28 pb-24 text-center sm:px-6 sm:pt-36 sm:pb-32">
        <h1 className="text-5xl leading-[1.04] font-semibold sm:text-7xl">
          <RevealLine text="Study a little every day." delay={0.05} />
          <RevealLine text="Remember it for good." delay={0.3} muted />
        </h1>
        <motion.p {...fade(0.7)} className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Cram turns your notes into quizzes, tells you what you&apos;re about to forget, and keeps you
          coming back with goals and streaks.
        </motion.p>
        <motion.div {...fade(0.85)} className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            className="group h-11 px-5 text-[15px]"
            nativeButton={false}
            render={
              <Link href="/signup">
                Start studying free
                <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            }
          />
          <Button
            size="lg"
            variant="outline"
            className="h-11 px-5 text-[15px]"
            nativeButton={false}
            render={<a href="#how-it-works">See how it works</a>}
          />
        </motion.div>
        <motion.p {...fade(1)} className="mt-5 text-sm text-muted-foreground">
          Free for students. No card, no ads.
        </motion.p>
      </div>
    </section>
  );
}
