import "server-only";
import { prisma } from "@/lib/prisma";
import { getFolderRole, roleAtLeast } from "@/lib/permissions";
import { FolderRole } from "@/generated/prisma/enums";

export async function getFolderForUser(folderId: string, userId: string) {
  const [folder, role] = await Promise.all([
    prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        pages: { orderBy: { order: "asc" } },
        members: { include: { user: true }, orderBy: { createdAt: "asc" } },
        owner: true,
      },
    }),
    getFolderRole(folderId, userId),
  ]);

  if (!folder || !roleAtLeast(role, FolderRole.VIEWER)) return null;
  return { folder, role: role! };
}

export async function getPageForUser(pageId: string, userId: string) {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { folder: true },
  });
  if (!page) return null;

  const role = await getFolderRole(page.folderId, userId);
  if (!roleAtLeast(role, FolderRole.VIEWER)) return null;

  return { page, role: role! };
}

/** This user's mastery per page in a folder (only pages they've been quizzed on). */
export async function getFolderMastery(folderId: string, userId: string) {
  const reviews = await prisma.pageReview.findMany({
    where: { userId, page: { folderId } },
    select: { pageId: true, mastery: true, dueAt: true },
  });
  return new Map(reviews.map((r) => [r.pageId, { mastery: r.mastery, due: r.dueAt <= new Date() }]));
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  weeklyXp: number;
  isYou: boolean;
}

/**
 * Weekly XP among a shared folder's people (owner + members), highest first. People who opted
 * out of leaderboards are hidden from everyone but themselves.
 */
export async function getFolderLeaderboard(
  people: { id: string; name: string | null; email: string; avatarUrl: string | null; showOnLeaderboard: boolean }[],
  viewerId: string,
): Promise<LeaderboardEntry[]> {
  const visible = people.filter((p) => p.showOnLeaderboard || p.id === viewerId);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sums = await prisma.streakLog.groupBy({
    by: ["userId"],
    where: { userId: { in: visible.map((p) => p.id) }, date: { gte: since } },
    _sum: { xp: true },
  });
  const xpBy = new Map(sums.map((s) => [s.userId, s._sum.xp ?? 0]));
  return visible
    .map((p) => ({
      userId: p.id,
      name: p.name?.trim() || p.email.split("@")[0],
      avatarUrl: p.avatarUrl,
      weeklyXp: xpBy.get(p.id) ?? 0,
      isYou: p.id === viewerId,
    }))
    .sort((a, b) => b.weeklyXp - a.weeklyXp);
}
