"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { tabsStore } from "@/lib/tabs-store";
import { describeLocation, type BreadcrumbFolder } from "@/components/app-breadcrumb";
import { cn } from "@/lib/utils";

/** Finds an in-app link from a click target, or null if the click wasn't on one. */
function appLinkFrom(target: EventTarget | null): string | null {
  const anchor = (target as Element | null)?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank") return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/app")) return null;
  return url.pathname + url.search;
}

/**
 * Notion-style tabs above the breadcrumb. "+" opens a new tab on Home; Ctrl/Cmd+click or
 * middle-click on any in-app link opens it in a background tab.
 */
export function AppTabs({ folders }: { folders: BreadcrumbFolder[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { tabs, activeId } = useSyncExternalStore(
    tabsStore.subscribe,
    tabsStore.getSnapshot,
    tabsStore.getServerSnapshot,
  );

  useEffect(() => {
    tabsStore.syncActive(pathname);
  }, [pathname]);

  useEffect(() => {
    const openInBackground = (e: MouseEvent) => {
      const wantsNewTab = e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey));
      if (!wantsNewTab) return;
      const href = appLinkFrom(e.target);
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      tabsStore.open(href, false);
    };
    document.addEventListener("click", openInBackground, true);
    document.addEventListener("auxclick", openInBackground, true);
    return () => {
      document.removeEventListener("click", openInBackground, true);
      document.removeEventListener("auxclick", openInBackground, true);
    };
  }, []);

  const goTo = (href: string | undefined) => {
    if (href && href !== pathname) router.push(href);
  };

  // Before hydration (and on the server) there's no stored state yet — show the current page.
  const visible = tabs.length > 0 ? tabs : [{ id: "current", href: pathname }];
  const active = activeId ?? "current";

  return (
    <div className="flex h-10 items-end gap-1 overflow-x-auto bg-sidebar px-2 pt-1.5 [scrollbar-width:none]">
      {visible.map((tab) => {
        const { label, icon } = describeLocation(tab.href, folders);
        const isActive = tab.id === active;
        return (
          <div
            key={tab.id}
            className={cn(
              "group relative flex h-full w-52 min-w-24 shrink items-center rounded-t-lg text-sm transition-colors",
              isActive
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
          >
            <button
              type="button"
              onClick={() => goTo(tabsStore.activate(tab.id)?.href)}
              onAuxClick={(e) => {
                if (e.button === 1) goTo(tabsStore.close(tab.id)?.href);
              }}
              className="flex h-full min-w-0 flex-1 items-center gap-2 pr-1 pl-3 text-left"
              title={label}
            >
              <span className="flex shrink-0 items-center opacity-80">{icon}</span>
              <span className="truncate">{label}</span>
            </button>
            {visible.length > 1 && (
              <button
                type="button"
                aria-label={`Close ${label}`}
                onClick={() => goTo(tabsStore.close(tab.id)?.href)}
                className={cn(
                  "mr-1.5 flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground",
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        aria-label="New tab"
        onClick={() => goTo(tabsStore.open("/app", true).href)}
        className="mb-1 ml-0.5 flex size-7 shrink-0 items-center justify-center self-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
