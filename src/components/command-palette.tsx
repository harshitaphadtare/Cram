"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck2,
  CornerDownLeft,
  FileText,
  History,
  House,
  Loader2,
  Search,
  Settings,
  Timer,
  Trophy,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { searchPages, type PageSearchResult } from "@/app/actions/search";
import { tabsStore } from "@/lib/tabs-store";
import { folderDotClass } from "@/lib/folder-colors";
import { cn } from "@/lib/utils";
import type { BreadcrumbFolder } from "@/components/app-breadcrumb";

interface Item {
  id: string;
  href: string;
  label: string;
  hint?: string;
  snippet?: string | null;
  icon: React.ReactNode;
  group: "Go to" | "Folders" | "Pages";
}

const SECTIONS: Item[] = [
  { id: "s-home", href: "/app", label: "Home", icon: <House />, group: "Go to" },
  { id: "s-planner", href: "/app/planner", label: "Planner", icon: <CalendarCheck2 />, group: "Go to" },
  { id: "s-pomodoro", href: "/app/pomodoro", label: "Pomodoro", icon: <Timer />, group: "Go to" },
  { id: "s-quizzes", href: "/app/quizzes", label: "Quiz history", icon: <History />, group: "Go to" },
  { id: "s-progress", href: "/app/progress", label: "Progress", icon: <Trophy />, group: "Go to" },
  { id: "s-settings", href: "/app/settings", label: "Settings", icon: <Settings />, group: "Go to" },
];

// Tiny shared open/closed store, so the sidebar's search button and the keyboard shortcut drive
// the same dialog without prop drilling through server components.
let paletteOpen = false;
const listeners = new Set<() => void>();
export function setPaletteOpen(open: boolean) {
  paletteOpen = open;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const SEARCH_DEBOUNCE_MS = 200;

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Ctrl/Cmd+K: jump to any page, folder or section; searches inside page text too. */
export function CommandPalette({ folders }: { folders: BreadcrumbFolder[] }) {
  const open = useSyncExternalStore(subscribe, () => paletteOpen, () => false);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [remote, setRemote] = useState<{ query: string; results: PageSearchResult[] }>({ query: "", results: [] });
  const listRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounced(query.trim(), SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (debouncedQuery.length < 2) return;
    let cancelled = false;
    searchPages(debouncedQuery)
      .then((results) => !cancelled && setRemote({ query: debouncedQuery, results }))
      .catch(() => !cancelled && setRemote({ query: debouncedQuery, results: [] }));
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const q = query.trim().toLowerCase();
  const searching = q.length >= 2 && remote.query !== query.trim();

  const items = useMemo<Item[]>(() => {
    const folderById = new Map(folders.map((f) => [f.id, f]));
    const pageItem = (folderId: string, pageId: string, title: string, snippet?: string | null): Item => {
      const folder = folderById.get(folderId);
      return {
        id: `p-${pageId}`,
        href: `/app/folders/${folderId}/pages/${pageId}`,
        label: title || "Untitled",
        hint: folder?.name,
        snippet,
        icon: <FileText />,
        group: "Pages",
      };
    };
    const folderItems: Item[] = folders.map((f) => ({
      id: `f-${f.id}`,
      href: `/app/folders/${f.id}`,
      label: f.name,
      hint: `${f.pages.length} ${f.pages.length === 1 ? "page" : "pages"}`,
      icon: <span className={cn("size-2.5 rounded-[3px]", folderDotClass(f.color))} />,
      group: "Folders",
    }));

    if (!q) {
      const recentPages = folders.flatMap((f) => f.pages.slice(0, 3).map((p) => pageItem(f.id, p.id, p.title))).slice(0, 6);
      return [...SECTIONS, ...folderItems, ...recentPages];
    }

    const matches = (s: string) => s.toLowerCase().includes(q);
    const localPages = folders.flatMap((f) =>
      f.pages.filter((p) => matches(p.title || "Untitled")).map((p) => pageItem(f.id, p.id, p.title)),
    );
    const seen = new Set(localPages.map((p) => p.id));
    const contentPages =
      remote.query.toLowerCase() === q
        ? remote.results
            .filter((r) => !seen.has(`p-${r.pageId}`))
            .map((r) => pageItem(r.folderId, r.pageId, r.title, r.snippet))
        : [];

    return [
      ...SECTIONS.filter((s) => matches(s.label)),
      ...folderItems.filter((f) => matches(f.label)),
      ...localPages,
      ...contentPages,
    ];
  }, [folders, q, remote]);

  const clamped = Math.min(selected, Math.max(0, items.length - 1));

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${clamped}"]`)?.scrollIntoView({ block: "nearest" });
  }, [clamped]);

  function close() {
    setPaletteOpen(false);
    setQuery("");
    setSelected(0);
  }

  function go(item: Item, inNewTab: boolean) {
    close();
    if (inNewTab) tabsStore.open(item.href, false);
    else router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((clamped + 1) % Math.max(1, items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((clamped - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === "Enter" && items[clamped]) {
      e.preventDefault();
      go(items[clamped], e.ctrlKey || e.metaKey);
    }
  }

  let lastGroup: string | null = null;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setPaletteOpen(true) : close())}>
      <DialogContent
        showCloseButton={false}
        className="top-[15vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-2.5 border-b px-4">
          {searching ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Search className="size-4 shrink-0 text-muted-foreground" />
          )}
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search pages, folders and notes…"
            className="h-12 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[min(60vh,420px)] overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              {searching ? "Searching your notes…" : `No results for “${query.trim()}”`}
            </p>
          ) : (
            items.map((item, i) => {
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              return (
                <div key={item.id}>
                  {header && (
                    <p className="px-2.5 pt-2.5 pb-1 text-[0.6875rem] font-medium text-muted-foreground">{header}</p>
                  )}
                  <button
                    type="button"
                    data-index={i}
                    onMouseMove={() => clamped !== i && setSelected(i)}
                    onClick={(e) => go(item, e.ctrlKey || e.metaKey)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left",
                      i === clamped && "bg-accent",
                    )}
                  >
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-4">
                      {item.icon}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm">{item.label}</span>
                        {item.hint && <span className="shrink-0 truncate text-xs text-muted-foreground">{item.hint}</span>}
                      </span>
                      {item.snippet && (
                        <span className="line-clamp-1 text-xs text-muted-foreground">{item.snippet}</span>
                      )}
                    </span>
                    {i === clamped && <CornerDownLeft className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t px-4 py-2 text-[0.6875rem] text-muted-foreground">
          <span>↑↓ to navigate</span>
          <span>↵ to open</span>
          <span>Ctrl+↵ in new tab</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Sidebar trigger styled like Notion's "Search" row, showing the shortcut. */
export function SearchTrigger() {
  return (
    <button
      type="button"
      onClick={() => setPaletteOpen(true)}
      data-tour="search"
      className="flex h-[1.875rem] w-full items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
    >
      <Search className="size-4 shrink-0 text-sidebar-foreground/80" />
      <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Search</span>
      <kbd className="rounded border border-sidebar-border px-1 text-[0.625rem] text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
        Ctrl K
      </kbd>
    </button>
  );
}
