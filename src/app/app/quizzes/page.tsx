import { requireUser } from "@/lib/auth";
import { getQuizHistory } from "@/lib/data/quiz-history";
import { QuizHistory } from "@/components/quiz-history/quiz-history";

export default async function QuizzesPage() {
  const user = await requireUser();
  const data = await getQuizHistory(user.id);

  return (
    <div className="cram-stagger mx-auto flex w-full max-w-5xl flex-col gap-6 pb-16">
      <div>
        <h1 className="text-3xl font-semibold">Quiz history</h1>
        <p className="text-muted-foreground">Every quiz you&apos;ve taken, and how much of it is sticking.</p>
      </div>
      <QuizHistory data={data} />
    </div>
  );
}
