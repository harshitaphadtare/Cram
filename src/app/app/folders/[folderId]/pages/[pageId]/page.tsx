import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPageForUser } from "@/lib/data/pages";
import { prisma } from "@/lib/prisma";
import { roleAtLeast } from "@/lib/permissions";
import { FolderRole } from "@/generated/prisma/enums";
import { PageEditorClient } from "@/components/page-editor-client";
import type { Block } from "@blocknote/core";

// Saving notes schedules a question-bank refresh (lib/question-bank.ts) after the response;
// writing a bank can take ~10–30s when the AI is busy.
export const maxDuration = 60;

export default async function PageDetailPage({
  params,
}: {
  params: Promise<{ folderId: string; pageId: string }>;
}) {
  const { folderId, pageId } = await params;
  const user = await requireUser();
  const result = await getPageForUser(pageId, user.id);
  if (!result || result.page.folderId !== folderId) notFound();

  const { page, role } = result;
  const editable = roleAtLeast(role, FolderRole.EDITOR);
  // The subject's page tree (no content) — for "Pages inside" and "Move to…".
  const folderPages = await prisma.page.findMany({
    where: { folderId },
    select: { id: true, title: true, parentId: true, icon: true },
    orderBy: { order: "asc" },
  });

  return (
    <div className="flex flex-1 flex-col">
      <PageEditorClient
        pageId={page.id}
        initialTitle={page.title}
        initialContent={(page.content as Block[]) ?? []}
        editable={editable}
        initialFullWidth={page.fullWidth}
        initialSmallText={page.smallText}
        folder={{ id: folderId, name: page.folder.name, pages: folderPages }}
        initialIcon={page.icon}
      />
    </div>
  );
}
