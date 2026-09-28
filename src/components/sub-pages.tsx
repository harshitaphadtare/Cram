"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2, Plus } from "lucide-react";
import { createPage } from "@/app/actions/pages";

/**
 * "Pages inside" at the foot of a page (Notion-style): the page's sub-pages, and a button to add
 * one. A page with sub-pages works like a module/section of its subject.
 */
export function SubPages({
  folderId,
  pageId,
  subPages,
  editable,
}: {
  folderId: string;
  pageId: string;
  subPages: { id: string; title: string; childCount: number }[];
  editable: boolean;
}) {
  const router = useRouter();
  const [creating, startCreating] = useTransition();

  function addSubPage() {
    startCreating(async () => {
      try {
        const page = await createPage(folderId, pageId);
        router.push(`/app/folders/${folderId}/pages/${page.id}`);
      } catch {
        toast.error("Couldn't create the page.");
      }
    });
  }

  if (subPages.length === 0 && !editable) return null;

  return (
    <section aria-label="Pages inside this page" className="mt-10 flex flex-col gap-1.5">
      {subPages.length > 0 && (
        <>
          <h2 className="px-1 text-xs font-medium text-muted-foreground">Pages inside</h2>
          <div className="flex flex-col gap-0.5">
            {subPages.map((p) => (
              <Link
                key={p.id}
                href={`/app/folders/${folderId}/pages/${p.id}`}
                className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate underline decoration-border underline-offset-4 group-hover:decoration-foreground">
                  {p.title || "Untitled"}
                </span>
                {p.childCount > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {p.childCount} {p.childCount === 1 ? "page" : "pages"}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
      {editable && (
        <button
          type="button"
          onClick={addSubPage}
          disabled={creating}
          className="flex w-fit items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
        >
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add a page inside
        </button>
      )}
    </section>
  );
}
