"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { submitFullQuiz } from "@/app/actions/quiz";

interface QuizQuestionView {
  id: string;
  questionText: string;
  options: string[];
}

export function QuizRunner({
  quizId,
  questions,
}: {
  quizId: string;
  questions: QuizQuestionView[];
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();

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

      <Card>
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
                    "rounded-lg border p-3 text-left text-sm transition",
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
