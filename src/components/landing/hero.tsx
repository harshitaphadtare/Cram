"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// WebGL can't render on the server; load the 3D deck in the browser only.
const StudyDeckScene = dynamic(() => import("@/components/landing/study-deck-scene"), {
  ssr: false,
  loading: () => null,
});

const EASE = [0.22, 1, 0.36, 1] as const;

function RevealLine({ text, delay, muted = false }: { text: string; delay: number; muted?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <span className="block">
      {text.split(" ").map((word, i) => (
        // Each word rises out of its own clipping box.
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span
            className={`inline-block ${muted ? "text-muted-foreground" : ""}`}
            initial={reduce ? false : { y: "105%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: delay + i * 0.06 }}
          >
            {word}
            {" "}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

export function Hero() {
  const reduce = useReducedMotion();
  const fade = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, ease: EASE, delay },
        };

  return (
    <section className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pt-16 pb-8 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pt-24">
      <div className="relative z-10 flex flex-col items-start gap-6">
        <h1 className="text-[2.6rem] leading-[1.05] font-semibold sm:text-6xl">
          <RevealLine text="Study a little every day." delay={0.1} />
          <RevealLine text="Remember it for good." delay={0.35} muted />
        </h1>
        <motion.p {...fade(0.7)} className="max-w-md text-lg text-muted-foreground">
          Cram turns your notes into quizzes, tells you what you&apos;re about to forget, and makes
          showing up every day feel good.
        </motion.p>
        <motion.div {...fade(0.85)} className="flex flex-wrap items-center gap-3">
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
          <Button size="lg" variant="ghost" className="h-11 px-5 text-[15px]" nativeButton={false} render={<Link href="/login">Log in</Link>} />
        </motion.div>
        <motion.p {...fade(1)} className="text-sm text-muted-foreground">
          Free for students. No card, no ads.
        </motion.p>
      </div>

      <div className="relative h-[340px] sm:h-[440px] lg:h-[540px]">
        {/* Soft light behind the deck; also the placeholder while the 3D scene loads. */}
        <div
          aria-hidden
          className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle,var(--primary)_0%,transparent_65%)] opacity-[0.12] blur-2xl"
        />
        <StudyDeckScene />
      </div>
    </section>
  );
}
