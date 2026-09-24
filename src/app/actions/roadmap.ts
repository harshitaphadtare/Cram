"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { creditActivity } from "@/lib/gamification";
import { getFolderRole, roleAtLeast } from "@/lib/permissions";
import { FolderRole } from "@/generated/prisma/enums";

const TOPIC_XP = 10;
const TOPIC_XP_DAILY_CAP = 10;

async function ownItem(itemId: string, userId: string) {
  const item = await prisma.roadmapItem.findUniqueOrThrow({ where: { id: itemId } });
  if (item.userId !== userId) throw new Error("Not your roadmap.");
  return item;
}

export async function addRoadmapItem(folderId: string, title: string) {
  const user = await requireUser();
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Topic can't be empty.");
  const role = await getFolderRole(folderId, user.id);
  if (!roleAtLeast(role, FolderRole.VIEWER)) throw new Error("You can't add to that subject.");

  const max = await prisma.roadmapItem.aggregate({
    where: { userId: user.id, folderId },
    _max: { order: true },
  });
  const item = await prisma.roadmapItem.create({
    data: { userId: user.id, folderId, title: trimmed, order: (max._max.order ?? -1) + 1 },
  });
  revalidatePath("/app", "layout");
  return item;
}

export async function toggleRoadmapItem(itemId: string, done: boolean) {
  const user = await requireUser();
  const item = await ownItem(itemId, user.id);
  await prisma.roadmapItem.update({
    where: { id: itemId },
    data: { done, completedAt: done ? new Date() : null },
  });

  // Finishing a topic is real progress — reward it, capped per day so it can't be farmed.
  if (done && !item.done) {
    const recent = await prisma.roadmapItem.count({
      where: { userId: user.id, completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    if (recent <= TOPIC_XP_DAILY_CAP) await creditActivity(user.id, { bonusXp: TOPIC_XP });
  }
  revalidatePath("/app", "layout");
}

export async function renameRoadmapItem(itemId: string, title: string) {
  const user = await requireUser();
  await ownItem(itemId, user.id);
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Topic can't be empty.");
  await prisma.roadmapItem.update({ where: { id: itemId }, data: { title: trimmed } });
  revalidatePath("/app", "layout");
}

export async function deleteRoadmapItem(itemId: string) {
  const user = await requireUser();
  await ownItem(itemId, user.id);
  await prisma.roadmapItem.delete({ where: { id: itemId } });
  revalidatePath("/app", "layout");
}
