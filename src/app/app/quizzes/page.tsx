import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listQuizzesForUser } from "@/lib/data/quiz";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { folderDotClass } from "@/lib/folder-colors";
import { cn } from "@/lib/utils";
import { DeleteQuizButton } from "@/components/delete-quiz-button";
import { History, CheckCircle2, CircleDashed } from "lucide-react";

function scoreTone(percent: number): string {
  if (percent >= 80) return "bg-chart-3/15 text-foreground";
  if (percent >= 50) return "bg-streak/15 text-foreground";
  return "bg-destructive/10 text-destructive";
}

export default async function QuizzesPage() {
  const user = await requireUser();
  const quizzes = await listQuizzesForUser(user.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-16">
      <div>
        <h1 className="text-3xl font-semibold">Quiz history</h1>
        <p className="text-muted-foreground">Every quiz you&apos;ve taken, with full results.</p>
      </div>

      {quizzes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <History className="size-8" />
            <p>No quizzes yet.</p>
            <p className="text-sm">Open a folder and hit &ldquo;Quiz me&rdquo; to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {quizzes.map((quiz) => {
            const href =
              quiz.status === "completed"
                ? `/app/quiz/${quiz.id}/results`
                : `/app/quiz/${quiz.id}`;
            const percent =
              quiz.status === "completed"
                ? Math.round((quiz.correctCount / quiz.totalQuestions) * 100)
                : null;

            return (
              // Delete button and the link are siblings, not nested — an <a> can't validly
              // contain a <button>, and browsers handle click bubbling through that pairing
              // inconsistently (which is exactly why the delete button used to also navigate).
              <Card key={quiz.id} className="group transition-colors hover:bg-accent">
                <CardContent className="flex items-center gap-2 py-4">
                  <Link href={href} className="flex min-w-0 flex-1 items-center gap-4">
                    <div
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        percent !== null ? scoreTone(percent) : "bg-muted text-muted-foreground",
                      )}
                    >
                      {percent !== null ? `${percent}%` : <CircleDashed className="size-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            folderDotClass(quiz.folder.color),
                          )}
                        />
                        <p className="truncate font-medium">{quiz.folder.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {quiz.createdAt.toLocaleDateString()} ·{" "}
                        {quiz.difficulty.charAt(0) + quiz.difficulty.slice(1).toLowerCase()} ·{" "}
                        {quiz.totalQuestions} questions
                        {quiz.status === "completed" && (
                          <>
                            {" "}
                            · {quiz.correctCount}/{quiz.totalQuestions} correct
                          </>
                        )}
                      </p>
                    </div>

                    {quiz.status !== "completed" && (
                      <Badge variant="outline" className="shrink-0 gap-1">
                        <CheckCircle2 className="size-3" />
                        Resume
                      </Badge>
                    )}
                  </Link>

                  <DeleteQuizButton
                    quizId={quiz.id}
                    label={`${quiz.folder.name} quiz from ${quiz.createdAt.toLocaleDateString()}`}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
