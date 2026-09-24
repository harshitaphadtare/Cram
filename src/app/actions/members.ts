"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireFolderRole } from "@/lib/permissions";
import { FolderRole } from "@/generated/prisma/enums";

export async function inviteMember(folderId: string, email: string, role: FolderRole) {
  const user = await requireUser();
  await requireFolderRole(folderId, user.id, FolderRole.ADMIN);

  if (role === FolderRole.OWNER) throw new Error("Ownership can't be granted this way.");

  const normalizedEmail = email.trim().toLowerCase();
  const invitee = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!invitee) {
    throw new Error(`No Cram account found for ${normalizedEmail}.`);
  }

  const folder = await prisma.folder.findUniqueOrThrow({ where: { id: folderId } });
  if (folder.ownerId === invitee.id) {
    throw new Error("That person already owns this folder.");
  }

  await prisma.folderMember.upsert({
    where: { folderId_userId: { folderId, userId: invitee.id } },
    update: { role },
    create: { folderId, userId: invitee.id, role, invitedById: user.id },
  });

  revalidatePath(`/app/folders/${folderId}`);
}

export async function updateMemberRole(folderId: string, memberUserId: string, role: FolderRole) {
  const user = await requireUser();
  await requireFolderRole(folderId, user.id, FolderRole.ADMIN);

  if (role === FolderRole.OWNER) throw new Error("Ownership can't be granted this way.");

  await prisma.folderMember.update({
    where: { folderId_userId: { folderId, userId: memberUserId } },
    data: { role },
  });

  revalidatePath(`/app/folders/${folderId}`);
}

export async function removeMember(folderId: string, memberUserId: string) {
  const user = await requireUser();
  await requireFolderRole(folderId, user.id, FolderRole.ADMIN);

  await prisma.folderMember.delete({
    where: { folderId_userId: { folderId, userId: memberUserId } },
  });

  revalidatePath(`/app/folders/${folderId}`);
}

export async function leaveFolder(folderId: string) {
  const user = await requireUser();
  await prisma.folderMember.delete({
    where: { folderId_userId: { folderId, userId: user.id } },
  });
  revalidatePath("/app", "layout");
}
