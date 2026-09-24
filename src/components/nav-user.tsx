"use client";

import Link from "next/link";
import { Settings, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { signOut } from "@/app/actions/auth";

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  return source
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function NavUser({
  name,
  email,
  avatarUrl,
}: {
  name: string | null;
  email: string;
  avatarUrl: string | null;
}) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg">
                <Avatar className="size-7 rounded-md">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={name ?? email} />}
                  <AvatarFallback className="rounded-md bg-foreground/10 text-xs font-medium text-foreground">
                    {initials(name, email)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium text-sidebar-accent-foreground">{name ?? "You"}</span>
                  <span className="truncate text-xs text-muted-foreground">{email}</span>
                </div>
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent align="start" side="top" className="w-56">
            <div className="px-1.5 py-1 text-xs text-muted-foreground">Signed in as {email}</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/app/settings" />}>
              <Settings />
              Account settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                void signOut();
              }}
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
