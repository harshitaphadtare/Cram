"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { CalendarCheck2, FileText, History, House, Settings, Timer, Trophy } from "lucide-react";
import { folderDotClass } from "@/lib/folder-colors";
import { cn } from "@/lib/utils";
import { pageAncestors } from "@/lib/page-tree";

export type BreadcrumbFolder = {
  id: string;
  name: string;
  color: string;
  pages: { id: string; title: string; parentId: string | null }[];
};

interface MenuItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}

interface Crumb {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Sibling destinations shown when hovering the crumb, Notion-style. */
  menu?: MenuItem[];
}

const SECTIONS = [
  { href: "/app", segment: undefined, label: "Home", Icon: House },
  { href: "/app/planner", segment: "planner", label: "Planner", Icon: CalendarCheck2 },
  { href: "/app/pomodoro", segment: "pomodoro", label: "Pomodoro", Icon: Timer },
  { href: "/app/quizzes", segment: "quizzes", label: "Quiz history", Icon: History },
  { href: "/app/progress", segment: "progress", label: "Progress", Icon: Trophy },
] as const;

const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 120;

function FolderDot({ color }: { color: string }) {
  return <span className={cn("mx-[3px] size-2 shrink-0 rounded-[3px]", folderDotClass(color))} />;
}

function buildCrumbs(pathname: string, folders: BreadcrumbFolder[]): Crumb[] {
  const segments = pathname.split("/").filter(Boolean).slice(1); // drop leading "app"
  const section = segments[0] === "quiz" ? "quizzes" : segments[0];

  const crumbs: Crumb[] = [
    {
      href: "/app",
      label: "Home",
      icon: <House className="size-3.5" />,
      menu: SECTIONS.map(({ href, segment, label, Icon }) => ({
        href,
        label,
        icon: <Icon className="size-3.5" />,
        active: segment === section,
      })),
    },
  ];

  if (section === "folders" && segments[1]) {
    const folder = folders.find((f) => f.id === segments[1]);
    if (!folder) return crumbs;

    crumbs.push({
      href: `/app/folders/${folder.id}`,
      label: folder.name,
      icon: <FolderDot color={folder.color} />,
      menu: folders.map((f) => ({
        href: `/app/folders/${f.id}`,
        label: f.name,
        icon: <FolderDot color={f.color} />,
        active: f.id === folder.id,
      })),
    });

    const pageId = segments[2] === "pages" ? segments[3] : undefined;
    const page = pageId ? folder.pages.find((p) => p.id === pageId) : undefined;
    if (page) {
      // One crumb per level of nesting; each crumb's menu lists that level's sibling pages.
      for (const p of [...pageAncestors(page.id, folder.pages), page]) {
        crumbs.push({
          href: `/app/folders/${folder.id}/pages/${p.id}`,
          label: p.title || "Untitled",
          icon: <FileText className="size-3.5" />,
          menu: folder.pages
            .filter((sibling) => sibling.parentId === p.parentId)
            .map((sibling) => ({
              href: `/app/folders/${folder.id}/pages/${sibling.id}`,
              label: sibling.title || "Untitled",
              icon: <FileText className="size-3.5" />,
              active: sibling.id === p.id,
            })),
        });
      }
    }
    return crumbs;
  }

  const current = SECTIONS.find((s) => s.segment && s.segment === section);
  if (current) {
    crumbs.push({ href: current.href, label: current.label, icon: <current.Icon className="size-3.5" /> });
    if (segments[0] === "quiz") {
      crumbs.push({
        href: pathname,
        label: segments[2] === "results" ? "Results" : "Quiz",
        icon: <FileText className="size-3.5" />,
      });
    }
  } else if (section === "settings") {
    crumbs.push({ href: "/app/settings", label: "Settings", icon: <Settings className="size-3.5" /> });
  }

  return crumbs;
}

/** Label + icon for whatever a URL points at — the last breadcrumb. Used for tab titles. */
export function describeLocation(pathname: string, folders: BreadcrumbFolder[]) {
  const crumbs = buildCrumbs(pathname, folders);
  const last = crumbs[crumbs.length - 1];
  return { label: last.label, icon: last.icon };
}

function CrumbLink({ crumb, current }: { crumb: Crumb; current: boolean }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const schedule = (next: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), next ? OPEN_DELAY_MS : CLOSE_DELAY_MS);
  };

  const hasMenu = !!crumb.menu?.length;

  return (
    <div
      className="relative min-w-0"
      onMouseEnter={hasMenu ? () => schedule(true) : undefined}
      onMouseLeave={hasMenu ? () => schedule(false) : undefined}
    >
      <Link
        href={crumb.href}
        aria-current={current ? "page" : undefined}
        onClick={() => setOpen(false)}
        className={cn(
          "flex h-7 min-w-0 max-w-60 items-center gap-1.5 rounded-md px-1.5 transition-colors hover:bg-accent",
          current ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          open && "bg-accent",
        )}
      >
        <span className="flex shrink-0 items-center opacity-80">{crumb.icon}</span>
        <span className="truncate">{crumb.label}</span>
      </Link>

      {hasMenu && open && (
        // pt-1 (not mt-1) keeps the hover area continuous between the crumb and the menu.
        <div className="absolute top-full left-0 z-50 pt-1">
          <div
            role="menu"
            className="max-h-80 w-64 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg shadow-black/10 animate-in fade-in-0 zoom-in-95 duration-100"
          >
            {crumb.menu!.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-accent",
                  item.active ? "bg-accent text-foreground" : "text-foreground/80",
                )}
              >
                <span className="flex shrink-0 items-center text-muted-foreground">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Notion-style location trail for the top bar. Every crumb is a link, and hovering one lists its
 * siblings (sections, folders, or the folder's pages) so you can jump sideways without going back. */
export function AppBreadcrumb({ folders }: { folders: BreadcrumbFolder[] }) {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname, folders);
  // Deeply nested pages: keep Home, the subject and the last two levels; the rest fold into "…"
  // (the folded levels are still reachable from the parent crumb's menu and the sidebar).
  const folded = crumbs.length > 5;
  const shown = folded ? [...crumbs.slice(0, 2), null, ...crumbs.slice(-2)] : crumbs;

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-0.5 text-sm">
      {shown.map((crumb, i) => (
        <Fragment key={crumb ? crumb.href + i : "fold"}>
          {i > 0 && <span className="px-0.5 text-muted-foreground/40">/</span>}
          {crumb ? (
            <CrumbLink crumb={crumb} current={i === shown.length - 1} />
          ) : (
            <span
              className="px-1 text-muted-foreground"
              title={crumbs.slice(2, -2).map((c) => c.label).join(" / ")}
            >
              …
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
