"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blocksToText } from "@/lib/blocknote-to-text";

export interface PageSearchResult {
  pageId: string;
  folderId: string;
  title: string;
  /** Text around the first match in the page body, if the match wasn't only in the title. */
  snippet: string | null;
}

const SNIPPET_RADIUS = 60;

function snippetAround(text: string, query: string): string | null {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at === -1) return null;
  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(text.length, at + query.length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
}

/** Full-text search over page titles and bodies, limited to folders the user can see. */
export async function searchPages(query: string): Promise<PageSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const user = await requireUser();
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const rows = await prisma.$queryRaw<
    { id: string; folderId: string; title: string; content: unknown }[]
  >`
    SELECT p.id, p."folderId", p.title, p.content
    FROM pages p
    JOIN folders f ON f.id = p."folderId"
    WHERE (f."ownerId" = ${user.id}
           OR EXISTS (SELECT 1 FROM folder_members m WHERE m."folderId" = f.id AND m."userId" = ${user.id}))
      AND (p.title ILIKE ${pattern} OR p.content::text ILIKE ${pattern})
    ORDER BY (p.title ILIKE ${pattern}) DESC, p."updatedAt" DESC
    LIMIT 20
  `;

  return rows
    .map((r) => {
      const inTitle = r.title.toLowerCase().includes(q.toLowerCase());
      const snippet = snippetAround(blocksToText(r.content), q);
      // content::text also matches JSON keys/attributes — drop hits that weren't in visible text.
      if (!inTitle && !snippet) return null;
      return { pageId: r.id, folderId: r.folderId, title: r.title, snippet: inTitle ? null : snippet };
    })
    .filter((r): r is PageSearchResult => r !== null);
}
