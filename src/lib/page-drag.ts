"use client";

import { useSyncExternalStore } from "react";
import { pageDescendantIds, type TreePageInput } from "@/lib/page-tree";

/**
 * Drag a page onto another page to nest it (sidebar and subject page). The drag is tracked here
 * rather than in the DataTransfer, because drop targets need to know what's being dragged during
 * `dragover` (browsers hide DataTransfer contents until the drop) to decide whether to light up.
 */

export const PAGE_DRAG_TYPE = "application/x-cram-page";

interface PageDrag {
  pageId: string;
  folderId: string;
  parentId: string | null;
  /** The page and its sub-pages: dropping onto any of these would nest a page inside itself. */
  blocked: Set<string>;
}

let current: PageDrag | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function startPageDrag(
  e: React.DragEvent,
  page: { id: string; title: string; parentId: string | null },
  folderId: string,
  pages: TreePageInput[],
) {
  current = {
    pageId: page.id,
    folderId,
    parentId: page.parentId,
    blocked: new Set([page.id, ...pageDescendantIds(page.id, pages)]),
  };
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData(PAGE_DRAG_TYPE, page.id);
  // Replace the browser's default link drag (it would drag the page's URL).
  e.dataTransfer.setData("text/plain", page.title || "Untitled");
  emit();
}

export function endPageDrag() {
  current = null;
  emit();
}

export function getPageDrag() {
  return current;
}

/** Whether the page being dragged may be nested inside `targetId` (same subject, not itself). */
export function canNestInto(targetId: string, folderId: string) {
  return !!current && current.folderId === folderId && !current.blocked.has(targetId) && current.parentId !== targetId;
}

/** The current drag, for components that render drop zones only while dragging. */
export function usePageDrag() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}
