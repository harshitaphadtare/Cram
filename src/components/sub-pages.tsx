"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageIconPicker } from "@/components/page-icon";
import { placePage } from "@/app/actions/pages";
import {
  dropPositionFor,
  endPageDrag,
  getPageDrag,
  PAGE_DRAG_TYPE,
  startPageDrag,
  type DropPosition,
} from "@/lib/page-drag";
import { cn } from "@/lib/utils";

interface FolderPage {
  id: string;
  title: string;
  parentId: string | null;
  icon: string | null;
}

/**
 * A page's sub-pages, shown Notion-style as compact page links flowing on from the content
 * (icon + title with a soft underline). Click an icon to pick an emoji; drag links to reorder
 * them or drop one onto another to nest it. New sub-pages come from "Add sub-page" under the title.
 */
export function SubPages({
  folderId,
  pageId,
  pages,
  editable,
}: {
  folderId: string;
  pageId: string;
  /** Every page in the subject (for the tree), including this page's sub-pages. */
  pages: FolderPage[];
  editable: boolean;
}) {
  const subPages = pages.filter((p) => p.parentId === pageId);
  const [over, setOver] = useState<{ id: string; pos: DropPosition } | null>(null);

  if (subPages.length === 0) return null;

  function drop(targetId: string, pos: DropPosition) {
    const dragged = getPageDrag();
    endPageDrag();
    setOver(null);
    if (!dragged) return;
    placePage(dragged.pageId, targetId, pos)
      .then(() => {
        if (pos === "inside") {
          const title = (id: string) => pages.find((p) => p.id === id)?.title || "Untitled";
          toast.success(`Moved "${title(dragged.pageId)}" into "${title(targetId)}"`);
        }
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't move the page."));
  }

  return (
    <nav aria-label="Pages inside this page" className="-mx-1.5 flex flex-col">
      {subPages.map((p) => {
        const childCount = pages.filter((c) => c.parentId === p.id).length;
        const pos = over?.id === p.id ? over.pos : null;
        return (
          <div
            key={p.id}
            className="relative w-fit max-w-full"
            draggable={editable}
            onDragStart={(e) => startPageDrag(e, p, folderId, pages)}
            onDragEnd={() => {
              endPageDrag();
              setOver(null);
            }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(PAGE_DRAG_TYPE)) return;
              const next = dropPositionFor(e, e.currentTarget, p, folderId);
              if (!next) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over?.id !== p.id || over.pos !== next) setOver({ id: p.id, pos: next });
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o?.id === p.id ? null : o));
            }}
            onDrop={(e) => {
              e.preventDefault();
              const next = dropPositionFor(e, e.currentTarget, p, folderId);
              if (next) drop(p.id, next);
            }}
          >
            {(pos === "before" || pos === "after") && (
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-x-1.5 z-10 h-0.5 rounded-full bg-primary",
                  pos === "before" ? "-top-px" : "-bottom-px",
                )}
              />
            )}
            <div
              className={cn(
                "flex items-center gap-1 rounded-md px-1 transition-colors hover:bg-muted",
                pos === "inside" && "bg-primary/10 ring-1 ring-primary/60 ring-inset",
              )}
            >
              <PageIconPicker pageId={p.id} icon={p.icon} editable={editable} size="md" />
              <Link
                href={`/app/folders/${folderId}/pages/${p.id}`}
                draggable={false}
                title={childCount > 0 ? `${childCount} ${childCount === 1 ? "page" : "pages"} inside` : undefined}
                className="group min-w-0 py-1 pr-1"
              >
                <span className="block truncate font-medium underline decoration-foreground/25 decoration-1 underline-offset-[5px] transition-colors group-hover:decoration-foreground/60">
                  {p.title || "Untitled"}
                </span>
              </Link>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
