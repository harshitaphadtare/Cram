"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { submitFullQuiz } from "@/app/actions/quiz";

/** In-progress answers are kept per quiz in localStorage, so leaving the page (switching app
 * tabs, checking notes, reloading) doesn't throw away what's been answered. */
const progressKey = (quizId: string) => `cram.quiz-progress.${quizId}`;

interface SavedProgress {
  index: number;
  answers: Record<string, string>;
}

function loadProgress(quizId: string, questions: QuizQuestionView[]): SavedProgress | null {
  try {
    const raw = window.localStorage.getItem(progressKey(quizId));
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedProgress;
    // Keep only answers that still match a question and one of its options.
    const answers: Record<string, string> = {};
    for (const q of questions) {
      const a = saved.answers?.[q.id];
      if (typeof a === "string" && q.options.includes(a)) answers[q.id] = a;
    }
    const index = Number.isInteger(saved.index)
      ? Math.min(Math.max(saved.index, 0), questions.length - 1)
      : 0;
    return { index, answers };
  } catch {
    return null;
  }
}

function saveProgress(quizId: string, progress: SavedProgress) {
  try {
    window.localStorage.setItem(progressKey(quizId), JSON.stringify(progress));
  } catch {
    // Storage unavailable — progress just won't survive leaving the page.
  }
}

function clearProgress(quizId: string) {
  try {
    window.localStorage.removeItem(progressKey(quizId));
  } catch {}
}

interface QuizQuestionView {
  id: string;
  questionText: string;
  options: string[];
}

const noopSubscribe = () => () => {};

interface QuizRunnerProps {
  quizId: string;
  questions: QuizQuestionView[];
}

export function QuizRunner(props: QuizRunnerProps) {
  // Saved progress lives in localStorage, which the server can't see — so the runner only renders
  // in the browser, where it can start from the saved question instead of flashing question 1.
  const inBrowser = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!inBrowser) return <div className="mx-auto min-h-96 w-full max-w-2xl" />;
  return <QuizRunnerInner {...props} />;
}

function QuizRunnerInner({ quizId, questions }: QuizRunnerProps) {
  const [initial] = useState(() => loadProgress(quizId, questions));
  const [index, setIndex] = useState(initial?.index ?? 0);
  const [answers, setAnswers] = useState<Record<string, string>>(initial?.answers ?? {});
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    saveProgress(quizId, { index, answers });
  }, [quizId, index, answers]);

  const question = questions[index];
  const isLast = index === questions.length - 1;
  const answeredCount = Object.keys(answers).length;

  function handleSelect(option: string) {
    setAnswers((prev) => ({ ...prev, [question.id]: option }));
  }

  function handleSubmitQuiz() {
    startTransition(async () => {
      try {
        await submitFullQuiz(quizId, answers);
        clearProgress(quizId);
        router.push(`/app/quiz/${quizId}/results`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't submit the quiz.");
      }
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Question {index + 1} of {questions.length}
          </span>
          <span>{answeredCount} answered</span>
        </div>
        <Progress value={(answeredCount / questions.length) * 100} />
      </div>

      {/* Keyed by question so each one slides in as you move through the quiz. */}
      <Card key={question.id} className="animate-in fade-in slide-in-from-right-2 duration-300">
        <CardContent className="flex flex-col gap-4 py-6">
          <p className="text-lg font-medium">{question.questionText}</p>

          <div className="flex flex-col gap-2">
            {question.options.map((option) => {
              const isSelected = answers[question.id] === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "rounded-lg border p-3 text-left text-sm transition-all duration-150 active:scale-[0.99]",
                    isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted",
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setIndex((i) => i - 1)}
          disabled={index === 0 || pending}
          className="gap-1.5"
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>

        {isLast ? (
          <Button onClick={handleSubmitQuiz} disabled={pending} className="gap-1.5">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Submit quiz
          </Button>
        ) : (
          <Button onClick={() => setIndex((i) => i + 1)} disabled={pending} className="gap-1.5">
            Next question
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>

      {isLast && answeredCount < questions.length && (
        <p className="text-center text-sm text-muted-foreground">
          {questions.length - answeredCount} question{questions.length - answeredCount === 1 ? "" : "s"} left
          unanswered — you can still submit, they&apos;ll just count as wrong.
        </p>
      )}
    </div>
  );
}
