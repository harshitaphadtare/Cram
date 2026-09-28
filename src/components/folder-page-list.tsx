"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight, CornerLeftUp } from "lucide-react";
import { PageIcon } from "@/components/page-icon";
import { DeletePageButton } from "@/components/delete-page-button";
import { movePage, placePage } from "@/app/actions/pages";
import {
  dropPositionFor,
  endPageDrag,
  getPageDrag,
  PAGE_DRAG_TYPE,
  startPageDrag,
  usePageDrag,
  type DropPosition,
} from "@/lib/page-drag";
import { cn } from "@/lib/utils";

export interface FolderPageRow {
  id: string;
  title: string;
  parentId: string | null;
  icon: string | null;
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
 * Which pages are collapsed, per subject — remembered in localStorage so a folded-up module stays
 * folded. An external store (rather than state) so the server render and first client render
 * agree (everything expanded) and saved state applies right after.
 */
const collapsedKey = (folderId: string) => `cram.collapsed-pages.${folderId}`;
const collapseListeners = new Set<() => void>();
const collapseCache = new Map<string, string>();

function readCollapsed(folderId: string): string {
  if (!collapseCache.has(folderId)) {
    let raw = "[]";
    try {
      raw = window.localStorage.getItem(collapsedKey(folderId)) ?? "[]";
    } catch {}
    collapseCache.set(folderId, raw);
  }
  return collapseCache.get(folderId)!;
}

function writeCollapsed(folderId: string, ids: string[]) {
  const raw = JSON.stringify(ids);
  collapseCache.set(folderId, raw);
  try {
    window.localStorage.setItem(collapsedKey(folderId), raw);
  } catch {}
  collapseListeners.forEach((l) => l());
}

function useCollapsed(folderId: string): Set<string> {
  const raw = useSyncExternalStore(
    (l) => {
      collapseListeners.add(l);
      return () => collapseListeners.delete(l);
    },
    () => readCollapsed(folderId),
    () => "[]",
  );
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

/**
 * The subject's pages as an indented tree. Editors drag a page onto the top/bottom edge of
 * another to place it before/after it, onto the middle to nest it inside, or onto "Move to top
 * level" to take it back out.
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
  const [over, setOver] = useState<{ id: string; pos: DropPosition | "top" } | null>(null);
  const collapsed = useCollapsed(folderId);
  const toggleCollapsed = (id: string) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writeCollapsed(folderId, [...next]);
  };
  // A row is hidden when any page above it is collapsed.
  const parentOf = new Map(rows.map((r) => [r.id, r.parentId]));
  const isHidden = (row: FolderPageRow) => {
    for (let p = row.parentId, hops = 0; p && hops < 64; p = parentOf.get(p) ?? null, hops++) {
      if (collapsed.has(p)) return true;
    }
    return false;
  };
  const visibleRows = rows.filter((r) => !isHidden(r));
  const [pending, startTransition] = useTransition();
  const drag = usePageDrag();
  const titleOf = (id: string) => rows.find((r) => r.id === id)?.title || "Untitled";

  function drop(targetId: string | null, pos: DropPosition) {
    const dragged = getPageDrag();
    endPageDrag();
    setOver(null);
    if (!dragged) return;
    startTransition(async () => {
      try {
        if (targetId) await placePage(dragged.pageId, targetId, pos);
        else await movePage(dragged.pageId, null);
        // Reordering is visible in place; only nesting/un-nesting gets a confirmation.
        if (!targetId) toast.success(`Moved "${titleOf(dragged.pageId)}" to the top level`);
        else if (pos === "inside") toast.success(`Moved "${titleOf(dragged.pageId)}" into "${titleOf(targetId)}"`);
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
      {visibleRows.map((row, i) => {
        const overPos = over?.id === row.id ? over.pos : null;
        const isTarget = overPos === "inside";
        const isCollapsed = collapsed.has(row.id);
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
              if (!e.dataTransfer.types.includes(PAGE_DRAG_TYPE)) return;
              const pos = dropPositionFor(e, e.currentTarget, row, folderId);
              if (!pos) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over?.id !== row.id || over.pos !== pos) setOver({ id: row.id, pos });
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o?.id === row.id ? null : o));
            }}
            onDrop={(e) => {
              e.preventDefault();
              const pos = dropPositionFor(e, e.currentTarget, row, folderId);
              if (pos) drop(row.id, pos);
            }}
            className={cn(
              "group relative flex items-center gap-3 pr-2 transition-colors hover:bg-accent",
              i > 0 && "border-t",
              drag?.pageId === row.id && "opacity-50",
              isTarget && "bg-primary/10 ring-2 ring-primary/60 ring-inset hover:bg-primary/10",
            )}
          >
            {/* Insertion line for "before" / "after" drops, indented to the row's level. */}
            {(overPos === "before" || overPos === "after") && (
              <span
                aria-hidden
                style={{ left: 30 + row.depth * 22 }}
                className={cn(
                  "pointer-events-none absolute right-2 z-20 h-0.5 rounded-full bg-primary",
                  overPos === "before" ? "-top-px" : "-bottom-px",
                )}
              />
            )}
            {row.descendantCount > 0 && (
              <button
                type="button"
                onClick={() => toggleCollapsed(row.id)}
                aria-expanded={!isCollapsed}
                aria-label={`${isCollapsed ? "Show" : "Hide"} pages inside ${row.title || "Untitled"}`}
                title={isCollapsed ? "Show pages inside" : "Hide pages inside"}
                style={{ left: 6 + row.depth * 22 }}
                className="absolute top-1/2 z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className={cn("size-4 transition-transform duration-150", !isCollapsed && "rotate-90")} />
              </button>
            )}
            <Link
              href={`/app/folders/${folderId}/pages/${row.id}`}
              draggable={false}
              style={{ paddingLeft: 34 + row.depth * 22 }}
              className="flex min-w-0 flex-1 items-center gap-3 py-3"
            >
              <PageIcon icon={row.icon} className="size-4 text-[0.9375rem]" />
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
            if (over?.pos !== "top") setOver({ id: "__top", pos: "top" });
          }}
          onDragLeave={() => setOver((o) => (o?.pos === "top" ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            drop(null, "inside");
          }}
          className={cn(
            "flex items-center justify-center gap-2 border-t border-dashed py-3 text-xs text-muted-foreground transition-colors",
            over?.pos === "top" && "bg-primary/10 text-primary",
          )}
        >
          <CornerLeftUp className="size-3.5" />
          Drop here to move to the top level
        </div>
      )}
    </div>
  );
}
