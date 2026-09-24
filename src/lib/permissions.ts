import "server-only";
import { prisma } from "@/lib/prisma";
import { FolderRole } from "@/generated/prisma/enums";

const ROLE_RANK: Record<FolderRole, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
  OWNER: 3,
};

export type EffectiveRole = FolderRole | null;

/** Resolves a user's effective role on a folder: OWNER if they own it, else their FolderMember role, else null. */
export async function getFolderRole(folderId: string, userId: string): Promise<EffectiveRole> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { ownerId: true },
  });
  if (!folder) return null;
  if (folder.ownerId === userId) return FolderRole.OWNER;

  const member = await prisma.folderMember.findUnique({
    where: { folderId_userId: { folderId, userId } },
    select: { role: true },
  });
  return member?.role ?? null;
}

export function roleAtLeast(role: EffectiveRole, minimum: FolderRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Throws if the user doesn't have at least `minimum` access on the folder. Returns the resolved role otherwise. */
export async function requireFolderRole(
  folderId: string,
  userId: string,
  minimum: FolderRole,
): Promise<FolderRole> {
  const role = await getFolderRole(folderId, userId);
  if (!roleAtLeast(role, minimum)) {
    throw new Error("You don't have permission to do that.");
  }
  return role!;
}
