import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPageForUser } from "@/lib/data/pages";
import { roleAtLeast } from "@/lib/permissions";
import { FolderRole } from "@/generated/prisma/enums";
import { PageEditorClient } from "@/components/page-editor-client";
import type { Block } from "@blocknote/core";

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

  return (
    <div className="flex flex-1 flex-col">
      <PageEditorClient
        pageId={page.id}
        initialTitle={page.title}
        initialContent={(page.content as Block[]) ?? []}
        editable={editable}
        initialFullWidth={page.fullWidth}
        initialSmallText={page.smallText}
      />
    </div>
  );
}
