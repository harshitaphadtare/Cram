"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireFolderRole } from "@/lib/permissions";
import { FolderRole } from "@/generated/prisma/enums";

export async function createFolder(input: { name: string; color: string }) {
  const user = await requireUser();
  const name = input.name.trim();
  if (!name) throw new Error("Folder name is required.");

  const folder = await prisma.folder.create({
    data: { name, color: input.color, ownerId: user.id },
  });

  revalidatePath("/app", "layout");
  return folder;
}

export async function renameFolder(folderId: string, name: string) {
  const user = await requireUser();
  await requireFolderRole(folderId, user.id, FolderRole.EDITOR);

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name is required.");

  await prisma.folder.update({ where: { id: folderId }, data: { name: trimmed } });
  revalidatePath("/app", "layout");
}

export async function updateFolderColor(folderId: string, color: string) {
  const user = await requireUser();
  await requireFolderRole(folderId, user.id, FolderRole.EDITOR);

  await prisma.folder.update({ where: { id: folderId }, data: { color } });
  revalidatePath("/app", "layout");
}

/** Saves the user's own sidebar order of folders (drag and drop). Doesn't affect anyone else. */
export async function reorderFolders(orderedFolderIds: string[]) {
  const user = await requireUser();
  if (!Array.isArray(orderedFolderIds) || orderedFolderIds.some((id) => typeof id !== "string")) {
    throw new Error("Invalid folder order.");
  }
  // Keep only folders this user can actually see, once each.
  const visible = await prisma.folder.findMany({
    where: { id: { in: orderedFolderIds }, OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
    select: { id: true },
  });
  const allowed = new Set(visible.map((f) => f.id));
  const folderOrder = [...new Set(orderedFolderIds)].filter((id) => allowed.has(id));

  await prisma.user.update({ where: { id: user.id }, data: { folderOrder } });
  revalidatePath("/app", "layout");
}

export async function deleteFolder(folderId: string) {
  const user = await requireUser();
  await requireFolderRole(folderId, user.id, FolderRole.OWNER);

  await prisma.folder.delete({ where: { id: folderId } });
  revalidatePath("/app", "layout");
}
