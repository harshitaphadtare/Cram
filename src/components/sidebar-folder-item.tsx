"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, FileText, Loader2, Plus, Users } from "lucide-react";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { createPage } from "@/app/actions/pages";
import { folderDotClass } from "@/lib/folder-colors";
import { cn } from "@/lib/utils";
import type { VisibleFolder } from "@/lib/data/folders";
import { buildPageTree, pageAncestors, type PageNode } from "@/lib/page-tree";

/**
 * A folder row that expands in place to list its pages (Notion's page tree). Hovering the row swaps
 * the colour dot for a disclosure chevron; the folder you're inside opens automatically.
 */
export function SidebarFolderItem({ folder }: { folder: VisibleFolder }) {
  const pathname = usePathname();
  const router = useRouter();
  const href = `/app/folders/${folder.id}`;
  const inside = pathname.startsWith(href);
  // null = follow the route (open while you're inside the folder); true/false = user's choice.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? inside;
  const [creating, startCreating] = useTransition();
  const canEdit = folder.role !== "VIEWER";
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
        className="pl-7 group-data-[collapsible=icon]:pl-2!"
        render={
          <Link href={href}>
            <span className="truncate">{folder.name}</span>
            {folder.role !== "OWNER" && (
              <Users className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
            )}
          </Link>
        }
      />

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

function PageTreeList({
  nodes,
  folderId,
  canEdit,
  openPath,
}: {
  nodes: PageNode<SidebarPage>[];
  folderId: string;
  canEdit: boolean;
  openPath: Set<string>;
}) {
  return (
    <ul className="flex flex-col gap-px py-px">
      {nodes.map((node) => (
        <PageTreeItem key={node.page.id} node={node} folderId={folderId} canEdit={canEdit} openPath={openPath} />
      ))}
    </ul>
  );
}

/** One page in the sidebar tree: link, expand arrow when it has sub-pages, "+" for a new sub-page. */
function PageTreeItem({
  node,
  folderId,
  canEdit,
  openPath,
}: {
  node: PageNode<SidebarPage>;
  folderId: string;
  canEdit: boolean;
  openPath: Set<string>;
}) {
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
      <div className="group/page relative">
        <Link
          href={pageHref}
          style={{ paddingLeft: indent }}
          className={cn(
            "flex h-7 items-center gap-2 rounded-md pr-8 text-sm transition-colors",
            active
              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <FileText className={cn("size-3.5 shrink-0 opacity-70", hasChildren && "group-hover/page:opacity-0")} />
          <span className="truncate">{page.title || "Untitled"}</span>
        </Link>

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
        <PageTreeList nodes={children} folderId={folderId} canEdit={canEdit} openPath={openPath} />
      )}
    </li>
  );
}
