"use server";

import { revalidatePath } from "next/cache";
import { checkAchievements, creditNoteEditing } from "@/lib/gamification";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireFolderRole } from "@/lib/permissions";
import { FolderRole } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export async function createPage(folderId: string) {
  const user = await requireUser();
  await requireFolderRole(folderId, user.id, FolderRole.EDITOR);

  const maxOrder = await prisma.page.aggregate({
    where: { folderId },
    _max: { order: true },
  });

  const page = await prisma.page.create({
    data: {
      folderId,
      title: "Untitled",
      content: [],
      order: (maxOrder._max.order ?? -1) + 1,
      createdById: user.id,
    },
  });

  await checkAchievements(user.id);
  revalidatePath("/app", "layout");
  return page;
}

export async function renamePage(pageId: string, title: string) {
  const user = await requireUser();
  const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
  await requireFolderRole(page.folderId, user.id, FolderRole.EDITOR);

  const trimmed = title.trim() || "Untitled";
  await prisma.page.update({
    where: { id: pageId },
    data: { title: trimmed, updatedById: user.id },
  });

  revalidatePath("/app", "layout");
}

export async function updatePageContent(pageId: string, content: Prisma.InputJsonValue) {
  const user = await requireUser();
  const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
  await requireFolderRole(page.folderId, user.id, FolderRole.EDITOR);

  await prisma.page.update({
    where: { id: pageId },
    data: { content, updatedById: user.id },
  });

  // Writing notes is studying: active editing time counts toward the goal, XP and streak.
  await creditNoteEditing(user.id);
}

export async function deletePage(pageId: string) {
  const user = await requireUser();
  const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
  await requireFolderRole(page.folderId, user.id, FolderRole.EDITOR);

  await prisma.page.delete({ where: { id: pageId } });
  revalidatePath("/app", "layout");
}

export async function reorderPages(folderId: string, orderedPageIds: string[]) {
  const user = await requireUser();
  await requireFolderRole(folderId, user.id, FolderRole.EDITOR);

  await prisma.$transaction(
    orderedPageIds.map((id, index) =>
      prisma.page.update({ where: { id }, data: { order: index } }),
    ),
  );

  revalidatePath("/app", "layout");
}

export async function updatePageLayout(
  pageId: string,
  layout: { fullWidth?: boolean; smallText?: boolean },
) {
  const user = await requireUser();
  const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
  await requireFolderRole(page.folderId, user.id, FolderRole.EDITOR);

  await prisma.page.update({
    where: { id: pageId },
    data: {
      ...(layout.fullWidth !== undefined && { fullWidth: layout.fullWidth }),
      ...(layout.smallText !== undefined && { smallText: layout.smallText }),
    },
  });
}
