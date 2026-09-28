"use server";

import { revalidatePath } from "next/cache";
import { checkAchievements, creditNoteEditing } from "@/lib/gamification";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireFolderRole } from "@/lib/permissions";
import { FolderRole } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/** Creates a page in a folder — at the top level, or as a sub-page of `parentId`. */
export async function createPage(folderId: string, parentId: string | null = null) {
  const user = await requireUser();
  await requireFolderRole(folderId, user.id, FolderRole.EDITOR);
  if (parentId) {
    const parent = await prisma.page.findUnique({ where: { id: parentId }, select: { folderId: true } });
    if (parent?.folderId !== folderId) throw new Error("That parent page isn't in this subject.");
  }

  // New pages go last among their siblings.
  const maxOrder = await prisma.page.aggregate({
    where: { folderId, parentId },
    _max: { order: true },
  });

  const page = await prisma.page.create({
    data: {
      folderId,
      parentId,
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

/**
 * Moves a page (with all its sub-pages) under another page of the same subject, or back to the
 * top level (`newParentId = null`). It goes last among its new siblings.
 */
export async function movePage(pageId: string, newParentId: string | null) {
  const user = await requireUser();
  const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
  await requireFolderRole(page.folderId, user.id, FolderRole.EDITOR);
  if (page.parentId === newParentId) return;

  if (newParentId) {
    if (newParentId === pageId) throw new Error("A page can't be moved inside itself.");
    const pages = await prisma.page.findMany({
      where: { folderId: page.folderId },
      select: { id: true, parentId: true },
    });
    const target = pages.find((p) => p.id === newParentId);
    if (!target) throw new Error("That page isn't in this subject.");
    // Walk up from the target: reaching the moved page means it would end up inside itself.
    const parentOf = new Map(pages.map((p) => [p.id, p.parentId]));
    for (let cur: string | null = newParentId, hops = 0; cur && hops < 256; cur = parentOf.get(cur) ?? null, hops++) {
      if (cur === pageId) throw new Error("A page can't be moved inside one of its own sub-pages.");
    }
  }

  const maxOrder = await prisma.page.aggregate({
    where: { folderId: page.folderId, parentId: newParentId },
    _max: { order: true },
  });
  await prisma.page.update({
    where: { id: pageId },
    data: { parentId: newParentId, order: (maxOrder._max.order ?? -1) + 1, updatedById: user.id },
  });
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
