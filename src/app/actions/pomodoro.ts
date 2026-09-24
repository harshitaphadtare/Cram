"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PomodoroType } from "@/generated/prisma/enums";
import { creditActivity } from "@/lib/gamification";

export async function logPomodoroSession(input: {
  type: PomodoroType;
  durationMin: number;
  taskId?: string | null;
}) {
  const user = await requireUser();

  await prisma.pomodoroSession.create({
    data: {
      userId: user.id,
      type: input.type,
      durationMin: input.durationMin,
      completed: true,
      completedAt: new Date(),
      taskId: input.taskId ?? null,
    },
  });

  let xpGained = 0;
  if (input.type === PomodoroType.WORK) {
    ({ xpGained } = await creditActivity(user.id, {
      seconds: input.durationMin * 60,
      qualifies: true,
    }));
  }

  revalidatePath("/app", "layout");
  return { xpGained };
}

export async function getTodayWorkSessionCount(): Promise<number> {
  const user = await requireUser();
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  return prisma.pomodoroSession.count({
    where: {
      userId: user.id,
      type: PomodoroType.WORK,
      completed: true,
      startedAt: { gte: start },
    },
  });
}
