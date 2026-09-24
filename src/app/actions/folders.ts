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

export async function deleteFolder(folderId: string) {
  const user = await requireUser();
  await requireFolderRole(folderId, user.id, FolderRole.OWNER);

  await prisma.folder.delete({ where: { id: folderId } });
  revalidatePath("/app", "layout");
}
