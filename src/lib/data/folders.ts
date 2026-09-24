import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { FolderRole } from "@/generated/prisma/enums";

export interface VisibleFolder {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  pageCount: number;
  pages: { id: string; title: string }[];
  role: FolderRole;
}

/**
 * Folders the user can see: ones they own, plus ones shared with them. Cached per request, since
 * both the app layout (sidebar) and pages like the dashboard need it.
 */
export const listVisibleFolders = cache(async (userId: string): Promise<VisibleFolder[]> => {
  const folders = await prisma.folder.findMany({
    where: {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    include: {
      pages: { select: { id: true, title: true }, orderBy: { order: "asc" } },
      members: { where: { userId }, select: { role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return folders.map((f) => ({
    id: f.id,
    name: f.name,
    color: f.color,
    icon: f.icon,
    pageCount: f.pages.length,
    pages: f.pages,
    role: f.ownerId === userId ? FolderRole.OWNER : f.members[0]!.role,
  }));
});
