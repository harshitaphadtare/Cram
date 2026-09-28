"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CornerLeftUp, FileText } from "lucide-react";
import { DeletePageButton } from "@/components/delete-page-button";
import { movePage } from "@/app/actions/pages";
import { canNestInto, endPageDrag, getPageDrag, PAGE_DRAG_TYPE, startPageDrag, usePageDrag } from "@/lib/page-drag";
import { cn } from "@/lib/utils";

export interface FolderPageRow {
  id: string;
  title: string;
  parentId: string | null;
  depth: number;
  descendantCount: number;
  /** Rolled-up mastery over the page and the pages inside it; null if never quizzed. */
  mastery: { value: number; due: boolean } | null;
  updatedLabel: string;
}

export function MasteryPill({ value, due }: { value: number; due: boolean }) {
  return (
    <span className="flex items-center gap-2" title={due ? "Due for review" : "Mastery"}>
      <span className="h-1 w-14 overflow-hidden rounded-full bg-muted-foreground/15">
        <span
          className={cn(
            "cram-grow-x block h-full rounded-full",
            value >= 80 ? "bg-chart-3" : value >= 50 ? "bg-gold" : "bg-streak",
          )}
          style={{ width: `${Math.max(4, value)}%` }}
        />
      </span>
      <span className={cn("w-8 text-right text-xs tabular-nums", due ? "text-streak" : "text-muted-foreground")}>
        {value}%
      </span>
    </span>
  );
}

/**
 * The subject's pages as an indented tree. Editors can drag a page onto another to nest it
 * inside, or onto "Move to top level" to take it back out.
 */
export function FolderPageList({
  folderId,
  rows,
  canEdit,
}: {
  folderId: string;
  rows: FolderPageRow[];
  canEdit: boolean;
}) {
  const [over, setOver] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const drag = usePageDrag();
  const titleOf = (id: string) => rows.find((r) => r.id === id)?.title || "Untitled";

  function drop(targetId: string | null) {
    const dragged = getPageDrag();
    endPageDrag();
    setOver(null);
    if (!dragged) return;
    startTransition(async () => {
      try {
        await movePage(dragged.pageId, targetId);
        toast.success(
          targetId
            ? `Moved "${titleOf(dragged.pageId)}" into "${titleOf(targetId)}"`
            : `Moved "${titleOf(dragged.pageId)}" to the top level`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't move the page.");
      }
    });
  }

  const pagesForTree = rows.map((r) => ({ id: r.id, parentId: r.parentId }));
  const showTopZone = canEdit && drag?.folderId === folderId && drag.parentId !== null;

  return (
    <div
      data-tour="folder-pages"
      className={cn("flex flex-col overflow-hidden rounded-xl border bg-card", pending && "opacity-70")}
    >
      {rows.map((row, i) => {
        const isTarget = over === row.id;
        return (
          // DeletePageButton is a sibling of the Link, not nested inside it — a <button> inside an
          // <a> is invalid HTML and browsers bubble clicks through inconsistently.
          <div
            key={row.id}
            draggable={canEdit}
            onDragStart={(e) => startPageDrag(e, row, folderId, pagesForTree)}
            onDragEnd={() => {
              endPageDrag();
              setOver(null);
            }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(PAGE_DRAG_TYPE) || !canNestInto(row.id, folderId)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== row.id) setOver(row.id);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === row.id ? null : o));
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (canNestInto(row.id, folderId)) drop(row.id);
            }}
            className={cn(
              "group flex items-center gap-3 pr-2 transition-colors hover:bg-accent",
              i > 0 && "border-t",
              drag?.pageId === row.id && "opacity-50",
              isTarget && "bg-primary/10 ring-2 ring-primary/60 ring-inset hover:bg-primary/10",
            )}
          >
            <Link
              href={`/app/folders/${folderId}/pages/${row.id}`}
              draggable={false}
              style={{ paddingLeft: 16 + row.depth * 22 }}
              className="flex min-w-0 flex-1 items-center gap-3 py-3"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className={cn("min-w-0 flex-1 truncate text-sm", row.depth === 0 && "font-medium")}>
                {row.title || "Untitled"}
                {row.descendantCount > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {row.descendantCount} {row.descendantCount === 1 ? "page" : "pages"} inside
                  </span>
                )}
              </span>
              {isTarget ? (
                <span className="shrink-0 text-xs font-medium text-primary">Drop to move inside</span>
              ) : (
                <>
                  {row.mastery && <MasteryPill value={row.mastery.value} due={row.mastery.due} />}
                  <span className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground sm:block">
                    {row.updatedLabel}
                  </span>
                </>
              )}
            </Link>
            {canEdit && (
              <div className="opacity-0 transition group-hover:opacity-100">
                <DeletePageButton pageId={row.id} title={row.title} subPageCount={row.descendantCount} />
              </div>
            )}
          </div>
        );
      })}

      {showTopZone && (
        <div
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(PAGE_DRAG_TYPE)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (over !== "__top") setOver("__top");
          }}
          onDragLeave={() => setOver((o) => (o === "__top" ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            drop(null);
          }}
          className={cn(
            "flex items-center justify-center gap-2 border-t border-dashed py-3 text-xs text-muted-foreground transition-colors",
            over === "__top" && "bg-primary/10 text-primary",
          )}
        >
          <CornerLeftUp className="size-3.5" />
          Drop here to move to the top level
        </div>
      )}
    </div>
  );
}
