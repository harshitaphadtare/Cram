"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Link2, PanelTop } from "lucide-react";
import { tabsStore } from "@/lib/tabs-store";
import { appLinkFrom } from "@/components/app-tabs";

interface MenuState {
  href: string;
  x: number;
  y: number;
}

/**
 * Replaces the browser's right-click menu on in-app links, so "Open in new tab" opens one of the
 * app's own tabs instead of a browser tab. Shift+right-click still gets the browser's menu.
 */
export function LinkContextMenu() {
  const router = useRouter();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (e.shiftKey) return;
      const href = appLinkFrom(e.target);
      if (!href) return;
      e.preventDefault();
      setPosition(null);
      setMenu({ href, x: e.clientX, y: e.clientY });
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

  if (!menu) return null;

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
  ];

  return (
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
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:bg-accent"
        >
          <item.icon className="size-4 text-muted-foreground" />
          {item.label}
        </button>
      ))}
    </div>
  );
}
