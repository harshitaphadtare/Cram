"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { SidebarFolderItem } from "@/components/sidebar-folder-item";
import { SearchTrigger } from "@/components/command-palette";
import type { VisibleFolder } from "@/lib/data/folders";

const NAV_ITEMS = [
  { href: "/app", label: "Home", icon: House },
  { href: "/app/planner", label: "Planner", icon: CalendarCheck2 },
  { href: "/app/pomodoro", label: "Pomodoro", icon: Timer },
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
                  <SidebarMenuItem key={item.href}>
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

        <SidebarGroup className="mt-3">
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
              {folders.map((folder) => (
                <SidebarFolderItem key={folder.id} folder={folder} />
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
