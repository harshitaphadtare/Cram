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

      {open && (
        <ul className="flex flex-col gap-px py-px group-data-[collapsible=icon]:hidden">
          {folder.pages.length === 0 ? (
            <li className="py-1 pl-9 text-xs text-sidebar-foreground/50">No pages inside</li>
          ) : (
            folder.pages.map((page) => {
              const pageHref = `${href}/pages/${page.id}`;
              const active = pathname === pageHref;
              return (
                <li key={page.id}>
                  <Link
                    href={pageHref}
                    className={cn(
                      "flex h-7 items-center gap-2 rounded-md pr-2 pl-7 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <FileText className="size-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{page.title || "Untitled"}</span>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      )}
    </SidebarMenuItem>
  );
}
