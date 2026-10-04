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
  pages: { id: string; title: string; parentId: string | null; icon: string | null }[];
  role: FolderRole;
}

/**
 * Folders the user can see: ones they own, plus ones shared with them. Cached per request, since
 * both the app layout (sidebar) and pages like the dashboard need it.
 */
export const listVisibleFolders = cache(async (userId: string): Promise<VisibleFolder[]> => {
  const [folders, user] = await Promise.all([
    prisma.folder.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: {
        pages: { select: { id: true, title: true, parentId: true, icon: true }, orderBy: { order: "asc" } },
        members: { where: { userId }, select: { role: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { folderOrder: true } }),
  ]);

  // The user's own drag-and-drop order; folders not in it (new or newly shared) go last, oldest first.
  const rank = new Map((user?.folderOrder ?? []).map((id, i) => [id, i]));
  folders.sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));

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
