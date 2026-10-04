"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Loader2, Plus, Users } from "lucide-react";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { createPage } from "@/app/actions/pages";
import { folderDotClass } from "@/lib/folder-colors";
import { cn } from "@/lib/utils";
import type { VisibleFolder } from "@/lib/data/folders";
import { buildPageTree, pageAncestors, type PageNode } from "@/lib/page-tree";
import {
  dropPositionFor,
  endPageDrag,
  getPageDrag,
  PAGE_DRAG_TYPE,
  startPageDrag,
  type DropPosition,
} from "@/lib/page-drag";
import { movePage, placePage } from "@/app/actions/pages";
import { PageIcon } from "@/components/page-icon";

/** Folders are dragged by their row to reorder the sidebar (pages use PAGE_DRAG_TYPE). */
const FOLDER_DRAG_TYPE = "application/x-cram-folder";
// Which folder is being dragged: dragover can't read DataTransfer contents, only its types.
let draggingFolderId: string | null = null;

export type FolderDropPosition = "before" | "after";

/**
 * A folder row that expands in place to list its pages (Notion's page tree). Hovering the row swaps
 * the colour dot for a disclosure chevron; the folder you're inside opens automatically. Drag the
 * row up or down to reorder folders.
 */
export function SidebarFolderItem({
  folder,
  onReorder,
}: {
  folder: VisibleFolder;
  onReorder?: (draggedId: string, targetId: string, pos: FolderDropPosition) => void;
}) {
  const [folderPos, setFolderPos] = useState<FolderDropPosition | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const href = `/app/folders/${folder.id}`;
  const inside = pathname.startsWith(href);
  // null = follow the route (open while you're inside the folder); true/false = user's choice.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? inside;
  const [creating, startCreating] = useTransition();
  const canEdit = folder.role !== "VIEWER";
  const [folderDrop, setFolderDrop] = useState(false);
  // Pages on the way to the one you're viewing start expanded.
  const currentPageId = pathname.startsWith(`${href}/pages/`) ? pathname.split("/")[5] : undefined;
  const openPath = new Set(currentPageId ? pageAncestors(currentPageId, folder.pages).map((p) => p.id) : []);

  function addPage() {
    startCreating(async () => {
      try {
        const page = await createPage(folder.id);
        setToggled(true);
        router.push(`/app/folders/${folder.id}/pages/${page.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't create the page.");
      }
    });
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={pathname === href}
        tooltip={folder.name}
        className={cn(
          "pl-7 group-data-[collapsible=icon]:pl-2!",
          folderDrop && "bg-primary/15 ring-1 ring-primary/60 ring-inset",
        )}
        render={
          <Link
            href={href}
            draggable={!!onReorder}
            onDragStart={(e) => {
              draggingFolderId = folder.id;
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData(FOLDER_DRAG_TYPE, folder.id);
              // Replace the browser's default link drag (it would drag the folder's URL).
              e.dataTransfer.setData("text/plain", folder.name);
            }}
            onDragEnd={() => {
              draggingFolderId = null;
              setFolderPos(null);
            }}
            onDragOver={(e) => {
              // Another folder: drop above or below this one, by which half of the row you're over.
              if (e.dataTransfer.types.includes(FOLDER_DRAG_TYPE)) {
                if (!draggingFolderId || draggingFolderId === folder.id) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const rect = e.currentTarget.getBoundingClientRect();
                setFolderPos(e.clientY < rect.top + rect.height / 2 ? "before" : "after");
                return;
              }
              // Dropping a sub-page on its subject moves it back to the top level.
              const drag = getPageDrag();
              if (!e.dataTransfer.types.includes(PAGE_DRAG_TYPE) || drag?.folderId !== folder.id || !drag.parentId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setFolderDrop(true);
            }}
            onDragLeave={() => {
              setFolderDrop(false);
              setFolderPos(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setFolderDrop(false);
              if (e.dataTransfer.types.includes(FOLDER_DRAG_TYPE)) {
                const dragged = draggingFolderId;
                const pos = folderPos;
                draggingFolderId = null;
                setFolderPos(null);
                if (dragged && pos && dragged !== folder.id) onReorder?.(dragged, folder.id, pos);
                return;
              }
              const drag = getPageDrag();
              if (drag?.folderId === folder.id && drag.parentId) dropPage(null, "inside", folder.pages);
            }}
          >
            <span className="truncate">{folder.name}</span>
            {folder.role !== "OWNER" && (
              <Users className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
            )}
          </Link>
        }
      />

      {/* Where a dragged folder will land: above this row, or below it (and its open pages). */}
      {folderPos && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-1 left-1 z-10 h-0.5 rounded-full bg-primary",
            folderPos === "before" ? "-top-px" : "-bottom-px",
          )}
        />
      )}

      {/* Dot ⇄ chevron, sitting over the row's left padding (a sibling, not inside the link). */}
      <button
        type="button"
        onClick={() => setToggled(!open)}
        aria-label={open ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
        aria-expanded={open}
        className="group/toggle absolute top-[3px] left-1 flex size-6 items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden"
      >
        <span
          className={cn(
            "size-2 rounded-[3px] transition-opacity group-hover/menu-item:opacity-0",
            folderDotClass(folder.color),
          )}
        />
        <ChevronRight
          className={cn(
            "absolute size-3.5 opacity-0 transition-[opacity,transform] group-hover/menu-item:opacity-100",
            open && "rotate-90",
          )}
        />
      </button>

      {canEdit && (
        <button
          type="button"
          onClick={addPage}
          disabled={creating}
          aria-label={`New page in ${folder.name}`}
          title="New page"
          className="absolute top-[3px] right-1 flex size-6 items-center justify-center rounded-md text-sidebar-foreground/60 opacity-0 transition-opacity group-hover/menu-item:opacity-100 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden"
        >
          {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        </button>
      )}

      {/* Always mounted so it can animate: grid rows 0fr ⇄ 1fr gives a smooth height transition. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out group-data-[collapsible=icon]:hidden",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        inert={!open}
      >
        <div className="overflow-hidden">
          {folder.pages.length === 0 ? (
            <p className="py-1 pl-9 text-xs text-sidebar-foreground/50">No pages inside</p>
          ) : (
            <PageTreeList
              nodes={buildPageTree(folder.pages)}
              allPages={folder.pages}
              folderId={folder.id}
              canEdit={canEdit}
              openPath={openPath}
            />
          )}
        </div>
      </div>
    </SidebarMenuItem>
  );
}

type SidebarPage = VisibleFolder["pages"][number];

interface TreeProps {
  allPages: SidebarPage[];
  folderId: string;
  canEdit: boolean;
  openPath: Set<string>;
}

function PageTreeList({ nodes, ...rest }: TreeProps & { nodes: PageNode<SidebarPage>[] }) {
  return (
    <ul className="flex flex-col gap-px py-px">
      {nodes.map((node) => (
        <PageTreeItem key={node.page.id} node={node} {...rest} />
      ))}
    </ul>
  );
}

/**
 * Drops the page being dragged: before/after/inside `targetId`, or back to the subject's top
 * level when `targetId` is null. Reordering shows in place; nesting changes get a confirmation.
 */
function dropPage(targetId: string | null, pos: DropPosition, pages: SidebarPage[]) {
  const dragged = getPageDrag();
  endPageDrag();
  if (!dragged) return;
  const titleOf = (id: string) => pages.find((p) => p.id === id)?.title || "Untitled";
  const done = targetId ? placePage(dragged.pageId, targetId, pos) : movePage(dragged.pageId, null);
  done
    .then(() => {
      if (!targetId) toast.success(`Moved "${titleOf(dragged.pageId)}" to the top level`);
      else if (pos === "inside") toast.success(`Moved "${titleOf(dragged.pageId)}" into "${titleOf(targetId)}"`);
    })
    .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't move the page."));
}

/** One page in the sidebar tree: link, expand arrow when it has sub-pages, "+" for a new sub-page. */
function PageTreeItem({ node, allPages, folderId, canEdit, openPath }: TreeProps & { node: PageNode<SidebarPage> }) {
  const [dropPos, setDropPos] = useState<DropPosition | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { page, depth, children } = node;
  const pageHref = `/app/folders/${folderId}/pages/${page.id}`;
  const active = pathname === pageHref;
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? openPath.has(page.id);
  const [creating, startCreating] = useTransition();
  const hasChildren = children.length > 0;
  // 28px base indent (lines up with the folder's pages), +14px per level.
  const indent = 28 + depth * 14;

  function addSubPage() {
    startCreating(async () => {
      try {
        const created = await createPage(folderId, page.id);
        setToggled(true);
        router.push(`/app/folders/${folderId}/pages/${created.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't create the page.");
      }
    });
  }

  return (
    <li>
      {/* Drag a page onto another to put it inside (and open it so the result is visible). */}
      <div
        className="group/page relative"
        draggable={canEdit}
        onDragStart={(e) => startPageDrag(e, page, folderId, allPages)}
        onDragEnd={() => {
          endPageDrag();
          setDropPos(null);
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(PAGE_DRAG_TYPE)) return;
          const pos = dropPositionFor(e, e.currentTarget, page, folderId);
          if (!pos) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropPos(pos);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropPos(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDropPos(null);
          const pos = dropPositionFor(e, e.currentTarget, page, folderId);
          if (!pos) return;
          if (pos === "inside") setToggled(true);
          dropPage(page.id, pos, allPages);
        }}
      >
        <Link
          href={pageHref}
          draggable={false}
          style={{ paddingLeft: indent }}
          className={cn(
            "flex h-7 items-center gap-2 rounded-md pr-8 text-sm transition-colors",
            active
              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            dropPos === "inside" && "bg-primary/15 ring-1 ring-primary/60 ring-inset",
          )}
        >
          <PageIcon
            icon={page.icon}
            className={cn("size-3.5 text-[0.8125rem] opacity-80", hasChildren && "group-hover/page:opacity-0")}
          />
          <span className="truncate">{page.title || "Untitled"}</span>
        </Link>

        {(dropPos === "before" || dropPos === "after") && (
          <span
            aria-hidden
            style={{ left: indent - 4 }}
            className={cn(
              "pointer-events-none absolute right-1 z-10 h-0.5 rounded-full bg-primary",
              dropPos === "before" ? "-top-px" : "-bottom-px",
            )}
          />
        )}

        {/* Expand arrow sits over the page icon (Notion-style) when there are sub-pages. */}
        {hasChildren && (
          <button
            type="button"
            onClick={() => setToggled(!open)}
            aria-label={open ? `Collapse ${page.title || "Untitled"}` : `Expand ${page.title || "Untitled"}`}
            aria-expanded={open}
            style={{ left: indent - 3 }}
            className={cn(
              "absolute top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              "opacity-0 group-hover/page:opacity-100 focus-visible:opacity-100",
            )}
          >
            <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
          </button>
        )}

        {canEdit && (
          <button
            type="button"
            onClick={addSubPage}
            disabled={creating}
            aria-label={`New page inside ${page.title || "Untitled"}`}
            title="Add a page inside"
            className="absolute top-1/2 right-1 flex size-5 -translate-y-1/2 items-center justify-center rounded text-sidebar-foreground/60 opacity-0 transition-opacity group-hover/page:opacity-100 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:opacity-100"
          >
            {creating ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3.5" />}
          </button>
        )}
      </div>

      {hasChildren && open && (
        <PageTreeList nodes={children} allPages={allPages} folderId={folderId} canEdit={canEdit} openPath={openPath} />
      )}
    </li>
  );
}
