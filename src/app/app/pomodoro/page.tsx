import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PomodoroTimer } from "@/components/pomodoro-timer";

export default async function PomodoroPage() {
  const user = await requireUser();
  const tasks = await prisma.task.findMany({
    where: { userId: user.id, completed: false },
    select: { id: true, title: true },
    orderBy: { order: "asc" },
    take: 50,
  });

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">Pomodoro</h1>
        <p className="text-muted-foreground">Focus in short bursts, rest on purpose.</p>
      </div>
      <PomodoroTimer tasks={tasks} />
    </div>
  );
}
