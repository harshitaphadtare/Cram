import "server-only";
import { prisma } from "@/lib/prisma";

export async function listTasksForUser(userId: string) {
  return prisma.task.findMany({
    where: { userId },
    include: { folder: { select: { id: true, name: true, color: true } } },
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { order: "asc" }],
  });
}
