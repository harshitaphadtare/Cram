"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarCheck2,
  History,
  House,
  Plus,
  Timer,
  Trophy,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/nav-user";
import { CramLogo } from "@/components/cram-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { NewFolderDialog } from "@/components/new-folder-dialog";
import { SidebarFolderItem, type FolderDropPosition } from "@/components/sidebar-folder-item";
import { reorderFolders } from "@/app/actions/folders";
import { SearchTrigger } from "@/components/command-palette";
import type { VisibleFolder } from "@/lib/data/folders";

const NAV_ITEMS = [
  { href: "/app", label: "Home", icon: House },
  { href: "/app/planner", label: "Planner", icon: CalendarCheck2 },
  { href: "/app/pomodoro", label: "Pomodoro", icon: Timer, tour: "pomodoro" },
  { href: "/app/quizzes", label: "Quiz history", icon: History },
  { href: "/app/progress", label: "Progress", icon: Trophy },
];

export function AppSidebar({
  folders,
  user,
}: {
  folders: VisibleFolder[];
  user: { name: string | null; email: string; avatarUrl: string | null };
}) {
  const pathname = usePathname();

  // Folder order, changed optimistically on drop and saved in the background. Resets to the
  // server's order whenever the set of folders changes (one added, deleted or shared).
  const serverIds = folders.map((f) => f.id);
  const serverKey = serverIds.join(",");
  const [order, setOrder] = useState(serverIds);
  const [lastServerKey, setLastServerKey] = useState(serverKey);
  if (serverKey !== lastServerKey) {
    setLastServerKey(serverKey);
    setOrder(serverIds);
  }
  const byId = new Map(folders.map((f) => [f.id, f]));
  const orderedFolders = order.map((id) => byId.get(id)).filter((f): f is VisibleFolder => !!f);

  function reorder(draggedId: string, targetId: string, pos: FolderDropPosition) {
    const next = order.filter((id) => id !== draggedId);
    const at = next.indexOf(targetId);
    if (at === -1) return;
    next.splice(pos === "before" ? at : at + 1, 0, draggedId);
    if (next.join(",") === order.join(",")) return;
    const previous = order;
    setOrder(next);
    reorderFolders(next).catch(() => {
      setOrder(previous);
      toast.error("Couldn't save the new folder order.");
    });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between px-1 pt-1 group-data-[collapsible=icon]:justify-center">
          <Link href="/app" className="rounded-md px-1 py-1 text-sidebar-accent-foreground">
            <CramLogo size="sm" className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
          </Link>
          <div className="group-data-[collapsible=icon]:hidden flex items-center gap-1">
            <ThemeToggle />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              <SidebarMenuItem>
                <SearchTrigger />
              </SidebarMenuItem>
              {NAV_ITEMS.map((item) => {
                const active =
                  item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href} data-tour={"tour" in item ? item.tour : undefined}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={
                        <Link href={item.href}>
                          <item.icon className="text-sidebar-foreground/80" />
                          <span>{item.label}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-3" data-tour="folders">
          <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/60">
            Folders
          </SidebarGroupLabel>
          <NewFolderDialog>
            <SidebarGroupAction title="New folder" className="text-sidebar-foreground/60">
              <Plus />
            </SidebarGroupAction>
          </NewFolderDialog>
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              {folders.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                  No folders yet — create one to get started.
                </p>
              )}
              {orderedFolders.map((folder) => (
                <SidebarFolderItem key={folder.id} folder={folder} onReorder={reorder} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser name={user.name} email={user.email} avatarUrl={user.avatarUrl} />
      </SidebarFooter>
    </Sidebar>
  );
}
