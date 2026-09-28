"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Link2, PanelTop, Trash2 } from "lucide-react";
import { tabsStore } from "@/lib/tabs-store";
import { appLinkFrom } from "@/components/app-tabs";
import { deletePage } from "@/app/actions/pages";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MenuState {
  href: string;
  /** The link's visible text — the page title for page links. */
  label: string;
  x: number;
  y: number;
}

const PAGE_HREF = /^\/app\/folders\/([^/]+)\/pages\/([^/?#]+)/;

/**
 * Replaces the browser's right-click menu on in-app links, so "Open in new tab" opens one of the
 * app's own tabs instead of a browser tab. Shift+right-click still gets the browser's menu.
 */
export function LinkContextMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ folderId: string; pageId: string; title: string } | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (e.shiftKey) return;
      const href = appLinkFrom(e.target);
      if (!href) return;
      e.preventDefault();
      setPosition(null);
      const anchor = (e.target as Element).closest("a");
      setMenu({ href, label: anchor?.textContent?.trim() ?? "", x: e.clientX, y: e.clientY });
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    ref.current?.querySelector("button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [menu]);

  // Keep the menu on screen: flip left/up when it would overflow the viewport edge.
  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const pad = 8;
    const left = menu.x + width + pad > window.innerWidth ? Math.max(pad, menu.x - width) : menu.x;
    const top = menu.y + height + pad > window.innerHeight ? Math.max(pad, menu.y - height) : menu.y;
    setPosition({ left, top });
  }, [menu]);

  function removePage() {
    if (!confirmDelete) return;
    const { folderId, pageId, title } = confirmDelete;
    setConfirmDelete(null);
    deletePage(pageId)
      .then(() => {
        toast.success(`Deleted "${title}"`);
        // Leave the page if it (or a page inside it) was the one open.
        if (pathname.startsWith(`/app/folders/${folderId}/pages/${pageId}`)) router.push(`/app/folders/${folderId}`);
      })
      .catch(() => toast.error("Couldn't delete the page. You may not have edit access."));
  }

  const confirmDialog = (
    <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{confirmDelete?.title}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the page, any pages inside it, and quizzes generated from them. This
            can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={removePage}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (!menu) return confirmDialog;

  const pageMatch = PAGE_HREF.exec(menu.href);

  const run = (action: () => void) => () => {
    setMenu(null);
    action();
  };

  const items = [
    {
      label: "Open in new tab",
      icon: PanelTop,
      action: () => router.push(tabsStore.open(menu.href, true).href),
    },
    {
      label: "Open in new browser tab",
      icon: ExternalLink,
      action: () => window.open(menu.href, "_blank", "noopener"),
    },
    {
      label: "Copy link",
      icon: Link2,
      action: () =>
        navigator.clipboard
          .writeText(new URL(menu.href, window.location.origin).toString())
          .then(() => toast.success("Link copied"))
          .catch(() => toast.error("Couldn't copy the link.")),
    },
    ...(pageMatch
      ? [
          {
            label: "Delete page",
            icon: Trash2,
            destructive: true,
            action: () =>
              setConfirmDelete({ folderId: pageMatch[1], pageId: pageMatch[2], title: menu.label || "Untitled" }),
          },
        ]
      : []),
  ];

  return (
    <>
    {confirmDialog}
    <div
      ref={ref}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        e.preventDefault();
        const buttons = [...(ref.current?.querySelectorAll("button") ?? [])];
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.key === "ArrowDown" ? i + 1 : i - 1;
        buttons[(next + buttons.length) % buttons.length]?.focus();
      }}
      style={position ?? { left: menu.x, top: menu.y, visibility: "hidden" }}
      className="fixed z-[100] min-w-52 rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95 duration-100"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={run(item.action)}
          className={
            "destructive" in item
              ? "mt-1 flex w-full items-center gap-2.5 rounded-md border-t px-2 py-1.5 text-left text-destructive outline-none hover:bg-destructive/10 focus-visible:bg-destructive/10"
              : "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:bg-accent"
          }
        >
          <item.icon className={"destructive" in item ? "size-4" : "size-4 text-muted-foreground"} />
          {item.label}
        </button>
      ))}
    </div>
    </>
  );
}
