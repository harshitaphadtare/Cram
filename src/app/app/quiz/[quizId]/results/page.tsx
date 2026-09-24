import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { CheckCircle2, MinusCircle, Sparkles, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { quizXp } from "@/lib/xp";
import { requireUser } from "@/lib/auth";
import { getQuizForUser, getFolderQuizStats } from "@/lib/data/quiz";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { folderDotClass } from "@/lib/folder-colors";
import { cn } from "@/lib/utils";

function formatDuration(startedAt: Date, endedAt: Date): string {
  const seconds = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  if (minutes === 0) return `${remSeconds}s`;
  return `${minutes}m ${remSeconds}s`;
}

function headline(percent: number) {
  if (percent === 100) return "Flawless!";
  if (percent >= 80) return "Great work";
  if (percent >= 50) return "Solid effort";
  return "Keep practising";
}

function scoreColorVar(percent: number): string {
  if (percent >= 80) return "var(--chart-3)";
  if (percent >= 50) return "var(--streak)";
  return "var(--destructive)";
}

export default async function QuizResultsPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const user = await requireUser();
  const quiz = await getQuizForUser(quizId, user.id);
  if (!quiz) notFound();
  if (quiz.status !== "completed") redirect(`/app/quiz/${quizId}`);

  const stats = await getFolderQuizStats(quiz.folderId, user.id, quiz.id);
  const percent = Math.round((quiz.correctCount / quiz.totalQuestions) * 100);
  const wrongCount = quiz.questions.filter((q) => q.isCorrect === false).length;
  const unansweredCount = quiz.questions.filter((q) => q.userAnswer === null).length;
  const trendDelta = stats.lastScore !== null ? percent - stats.lastScore : null;
  const ringColor = scoreColorVar(percent);
  const xpEarned = quizXp(quiz.correctCount, quiz.totalQuestions);
  const nextReview = (
    await prisma.pageReview.findFirst({
      where: { userId: user.id, pageId: { in: quiz.pages.map((p) => p.page.id) } },
      orderBy: { dueAt: "asc" },
      select: { dueAt: true },
    })
  )?.dueAt;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-16">
      <section className="flex flex-col items-center gap-6 rounded-xl border bg-card px-6 py-8 text-center sm:flex-row sm:text-left">
        <div
          className="relative flex size-28 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(${ringColor} ${percent}%, var(--muted) 0)` }}
        >
          <div className="flex size-[96px] flex-col items-center justify-center rounded-full bg-card">
            <span className="text-2xl font-semibold tabular-nums">{percent}%</span>
            <span className="text-xs text-muted-foreground">
              {quiz.correctCount}/{quiz.totalQuestions}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="text-2xl font-semibold">{headline(percent)}</h1>
          <p className="text-muted-foreground">
            {trendDelta === null
              ? `Your first quiz on ${quiz.folder.name}.`
              : trendDelta > 0
                ? `Up ${trendDelta}% on your last attempt.`
                : trendDelta < 0
                  ? `Down ${Math.abs(trendDelta)}% on your last attempt. Review the misses below.`
                  : "Same score as last time."}
            {nextReview && ` Next review ${formatDistanceToNowStrict(nextReview, { addSuffix: true })}.`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:justify-start">
            <span className="flex items-center gap-1 font-medium text-primary">
              <Sparkles className="size-3.5" />+{xpEarned} XP
            </span>
            <span className="flex items-center gap-1.5">
              <span className={cn("size-1.5 rounded-full", folderDotClass(quiz.folder.color))} />
              {quiz.folder.name}
            </span>
            <span>Quiz #{stats.quizNumber}</span>
            <span>{quiz.difficulty.charAt(0) + quiz.difficulty.slice(1).toLowerCase()}</span>
            {quiz.completedAt && <span>{formatDuration(quiz.createdAt, quiz.completedAt)}</span>}
            {wrongCount > 0 && <span className="text-destructive">{wrongCount} wrong</span>}
            {unansweredCount > 0 && <span>{unansweredCount} skipped</span>}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        {quiz.questions.map((q, i) => {
          const options = q.options as string[];
          return (
            <Card key={q.id}>
              <CardContent className="flex flex-col gap-3 py-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                  <p className="flex-1 font-medium">{q.questionText}</p>
                  {q.isCorrect === true && (
                    <CheckCircle2 className="size-5 shrink-0 text-chart-3" />
                  )}
                  {q.isCorrect === false && (
                    <XCircle className="size-5 shrink-0 text-destructive" />
                  )}
                  {q.userAnswer === null && (
                    <MinusCircle className="size-5 shrink-0 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-1.5 pl-9 text-sm">
                  {options.map((option) => {
                    const isCorrect = option === q.correctAnswer;
                    const isUserPick = option === q.userAnswer;
                    return (
                      <div
                        key={option}
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-2.5 py-1.5",
                          isCorrect && "border-chart-3/50 bg-chart-3/10",
                          isUserPick && !isCorrect && "border-destructive/60 bg-destructive/10",
                        )}
                      >
                        {isCorrect && <CheckCircle2 className="size-3.5 shrink-0 text-chart-3" />}
                        {isUserPick && !isCorrect && (
                          <XCircle className="size-3.5 shrink-0 text-destructive" />
                        )}
                        <span className="flex-1">{option}</span>
                        {isUserPick && (
                          <Badge variant="secondary" className="shrink-0">
                            Your answer
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                  {q.userAnswer === null && (
                    <p className="pl-1 text-xs text-muted-foreground">Not answered</p>
                  )}
                  {q.explanation && <p className="pt-1 text-muted-foreground">{q.explanation}</p>}
                  {q.isCorrect !== true && q.sourcePage && (
                    <Link
                      href={`/app/folders/${quiz.folder.id}/pages/${q.sourcePage.id}`}
                      className="w-fit font-medium text-primary underline underline-offset-2"
                    >
                      Review &ldquo;{q.sourcePage.title}&rdquo; →
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/app/folders/${quiz.folder.id}`} />}
        >
          Back to folder
        </Button>
        <Button nativeButton={false} render={<Link href="/app/quizzes" />}>
          View quiz history
        </Button>
      </div>
    </div>
  );
}
