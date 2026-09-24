import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getQuizForUser } from "@/lib/data/quiz";
import { QuizRunner } from "@/components/quiz-runner";

export default async function QuizPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const user = await requireUser();
  const quiz = await getQuizForUser(quizId, user.id);
  if (!quiz) notFound();
  if (quiz.status === "completed") redirect(`/app/quiz/${quizId}/results`);

  return (
    <div className="flex flex-1 flex-col pt-4">
      <QuizRunner
        quizId={quiz.id}
        questions={quiz.questions.map((q) => ({
          id: q.id,
          questionText: q.questionText,
          options: q.options as string[],
        }))}
      />
    </div>
  );
}
