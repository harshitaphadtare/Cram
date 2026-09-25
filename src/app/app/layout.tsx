import { requireUser } from "@/lib/auth";
import { listVisibleFolders } from "@/lib/data/folders";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { StreakBadge } from "@/components/streak-badge";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { AppTabs } from "@/components/app-tabs";
import { Celebrations } from "@/components/gamification/celebrations";
import { CommandPalette } from "@/components/command-palette";
import { PomodoroProvider } from "@/components/pomodoro/pomodoro-provider";
import { MiniTimer } from "@/components/pomodoro/mini-timer";
import { getTodayWorkSessionCount } from "@/app/actions/pomodoro";
import { SubjectsProvider } from "@/components/subjects";
import { PageTransition } from "@/components/page-transition";
import { ProductTour } from "@/components/product-tour";
import { prisma } from "@/lib/prisma";
import { TimezoneSync } from "@/components/timezone-sync";
import { LinkContextMenu } from "@/components/link-context-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [folders, celebrations, sessionsToday] = await Promise.all([
    listVisibleFolders(user.id),
    prisma.userAchievement.findMany({
      where: { userId: user.id, seen: false },
      select: { id: true, key: true },
      orderBy: { unlockedAt: "asc" },
    }),
    getTodayWorkSessionCount(),
  ]);
  // A real page for the tour's editor step, if the user has any.
  const folderWithPages = folders.find((f) => f.pages.length > 0);
  const pageHref = folderWithPages
    ? `/app/folders/${folderWithPages.id}/pages/${folderWithPages.pages[0].id}`
    : null;
  const breadcrumbFolders = folders.map((f) => ({
    id: f.id,
    name: f.name,
    color: f.color,
    pages: f.pages,
  }));

  return (
    <PomodoroProvider initialSessionsToday={sessionsToday}>
      <TimezoneSync current={user.timezone} />
      <LinkContextMenu />
      <SubjectsProvider subjects={folders.map((f) => ({ id: f.id, name: f.name, color: f.color }))}>
      <SidebarProvider>
        <AppSidebar
          folders={folders}
          user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
        />
        <SidebarInset>
          <header className="sticky top-0 z-10 shrink-0">
            <AppTabs folders={breadcrumbFolders} />
            <div className="flex h-11 items-center justify-between gap-2 bg-background/90 px-3 backdrop-blur">
              <div className="flex min-w-0 items-center gap-1">
                <SidebarTrigger className="text-muted-foreground" />
                <AppBreadcrumb folders={breadcrumbFolders} />
              </div>
              <div className="flex items-center gap-2">
                <MiniTimer />
                <StreakBadge count={user.streakCount} />
              </div>
            </div>
          </header>
          <div className="flex flex-1 flex-col px-4 pt-6 pb-16 md:px-10 md:pt-10">
            <PageTransition>{children}</PageTransition>
          </div>
        </SidebarInset>
        <Celebrations items={celebrations} />
        <CommandPalette folders={breadcrumbFolders} />
        <ProductTour
          show={!user.onboardedAt}
          firstName={user.name?.split(" ")[0] ?? null}
          folderHref={folders[0] ? `/app/folders/${folders[0].id}` : null}
          pageHref={pageHref}
        />
      </SidebarProvider>
      </SubjectsProvider>
    </PomodoroProvider>
  );
}
