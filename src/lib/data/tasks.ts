import "server-only";
import { prisma } from "@/lib/prisma";

/** Where-clause for "what's on today": overdue or due today (in the user's timezone), plus
 * repeating tasks saved before they carried a date. Later tasks and undated one-offs live in the
 * Planner only. */
export function dueByTodayWhere(today: Date) {
  return {
    completed: false,
    OR: [{ dueDate: { lte: today } }, { recurring: true, dueDate: null }],
  };
}

export async function listTasksForUser(userId: string) {
  return prisma.task.findMany({
    where: { userId },
    include: { folder: { select: { id: true, name: true, color: true } } },
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { order: "asc" }],
  });
}
