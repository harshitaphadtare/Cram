import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userToday } from "@/lib/gamification";
import { PomodoroTimer } from "@/components/pomodoro-timer";

export default async function PomodoroPage() {
  const user = await requireUser();
  const [tasks, todayLog] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, completed: false },
      select: { id: true, title: true, folder: { select: { id: true, name: true, color: true } } },
      orderBy: { order: "asc" },
      take: 50,
    }),
    prisma.streakLog.findUnique({
      where: { userId_date: { userId: user.id, date: userToday(user.timezone) } },
      select: { seconds: true },
    }),
  ]);

  return (
    <PomodoroTimer
      tasks={tasks}
      todayMinutes={Math.floor((todayLog?.seconds ?? 0) / 60)}
      goalMinutes={user.dailyGoalMin}
      streak={user.streakCount}
    />
  );
}
