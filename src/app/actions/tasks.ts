"use server";

import { revalidatePath } from "next/cache";
import { creditActivity, userToday } from "@/lib/gamification";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskPriority } from "@/generated/prisma/enums";
import { dateOnlyStringToUTCDate } from "@/lib/date-only";
import { getFolderRole, roleAtLeast } from "@/lib/permissions";
import { FolderRole } from "@/generated/prisma/enums";

/** A task's subject must be a folder the user can at least view. */
async function assertSubject(folderId: string | null | undefined, userId: string) {
  if (!folderId) return;
  const role = await getFolderRole(folderId, userId);
  if (!roleAtLeast(role, FolderRole.VIEWER)) throw new Error("You can't use that subject.");
}

export async function createTask(input: {
  title: string;
  /** Plain "YYYY-MM-DD" — not an ISO datetime, which would drift across midnight in non-UTC timezones. */
  dueDate?: string | null;
  priority?: TaskPriority;
  recurring?: boolean;
  /** Subject (folder) this task is for, if any. */
  folderId?: string | null;
}) {
  const user = await requireUser();
  const title = input.title.trim();
  if (!title) throw new Error("Task title is required.");
  await assertSubject(input.folderId, user.id);

  const maxOrder = await prisma.task.aggregate({
    where: { userId: user.id },
    _max: { order: true },
  });

  const task = await prisma.task.create({
    data: {
      userId: user.id,
      title,
      // A repeating task always has a next occurrence — it starts today unless told otherwise.
      dueDate: input.dueDate
        ? dateOnlyStringToUTCDate(input.dueDate)
        : input.recurring
          ? userToday(user.timezone)
          : null,
      priority: input.priority ?? TaskPriority.P3,
      recurring: input.recurring ?? false,
      folderId: input.folderId ?? null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidatePath("/app", "layout");
  return task;
}

const TASK_XP = 5;
const TASK_XP_DAILY_CAP = 10;

export async function toggleTask(taskId: string, completed: boolean) {
  const user = await requireUser();
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  if (task.userId !== user.id) throw new Error("Not your task.");

  if (completed && task.recurring) {
    // Repeating tasks never stay done: ticking one rolls it to the day after its due date
    // (or after today, if it was overdue), ready to be done again.
    const today = userToday(user.timezone);
    const base = task.dueDate && task.dueDate > today ? task.dueDate : today;
    const next = new Date(base);
    next.setUTCDate(next.getUTCDate() + 1);
    await prisma.task.update({
      where: { id: taskId },
      data: { completed: false, completedAt: new Date(), dueDate: next },
    });
  } else {
    await prisma.task.update({
      where: { id: taskId },
      data: { completed, completedAt: completed ? new Date() : null },
    });
  }

  // Small reward for finishing tasks, capped per day so creating-and-ticking tasks can't farm XP.
  if (completed && !task.completed) {
    const completedRecently = await prisma.task.count({
      where: { userId: user.id, completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    if (completedRecently <= TASK_XP_DAILY_CAP) {
      await creditActivity(user.id, { bonusXp: TASK_XP });
    }
  }

  revalidatePath("/app", "layout");
}

export async function updateTask(
  taskId: string,
  input: {
    title?: string;
    dueDate?: string | null;
    priority?: TaskPriority;
    description?: string | null;
    recurring?: boolean;
    folderId?: string | null;
  },
) {
  const user = await requireUser();
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  if (task.userId !== user.id) throw new Error("Not your task.");
  await assertSubject(input.folderId, user.id);

  await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() || task.title } : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? dateOnlyStringToUTCDate(input.dueDate) : null }
        : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.recurring !== undefined ? { recurring: input.recurring } : {}),
      ...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
    },
  });

  revalidatePath("/app", "layout");
}

export async function deleteTask(taskId: string) {
  const user = await requireUser();
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  if (task.userId !== user.id) throw new Error("Not your task.");

  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath("/app/planner");
  revalidatePath("/app");
}
