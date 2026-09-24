"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startQuiz } from "@/app/actions/quiz";
import { Difficulty } from "@/generated/prisma/enums";

/** One click from "this is fading" to a short review quiz on exactly those pages. */
export function ReviewButton({
  folderId,
  pageIds,
  label = "Review",
  size = "sm",
  variant = "outline",
}: {
  folderId: string;
  pageIds: string[];
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "default";
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      size={size}
      variant={variant}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const quizId = await startQuiz({
              folderId,
              pageIds,
              difficulty: Difficulty.MEDIUM,
              questionCount: Math.min(10, Math.max(5, pageIds.length * 3)),
            });
            router.push(`/app/quiz/${quizId}`);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't start the review.");
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {pending ? "Preparing…" : label}
    </Button>
  );
}
