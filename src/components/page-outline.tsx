"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { Block } from "@blocknote/core";
import { cn } from "@/lib/utils";

export interface OutlineHeading {
  id: string;
  level: number;
  text: string;
}

function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (typeof item !== "object" || item === null) return "";
      if ("text" in item && typeof item.text === "string") return item.text;
      if ("content" in item) return inlineText(item.content);
      return "";
    })
    .join("");
}

/** Every heading in the document, in reading order (including ones nested inside other blocks). */
export function extractHeadings(blocks: Block[]): OutlineHeading[] {
  const out: OutlineHeading[] = [];
  const walk = (list: Block[]) => {
    for (const block of list) {
      if (block.type === "heading") {
        const text = inlineText(block.content).trim();
        if (text) out.push({ id: block.id, level: Number(block.props.level) || 1, text });
      }
      if (block.children?.length) walk(block.children);
    }
  };
  walk(blocks);
  return out;
}

function headingElement(id: string) {
  return document.querySelector<HTMLElement>(`.bn-block-outer[data-id="${CSS.escape(id)}"]`);
}

const noopSubscribe = () => () => {};

// Dash widths and list indents per nesting depth (deeper levels share the last style).
const DASH_WIDTH = ["w-5", "w-3.5", "w-2.5"];
const LIST_INDENT = ["pl-2", "pl-5", "pl-8"];

/** A slim rail of dashes pinned to the right edge — one per heading, sized by level, with the
 * section you're reading highlighted. Hovering expands it into a clickable, indented outline. */
export function PageOutline({ headings }: { headings: OutlineHeading[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // The active heading is the last one whose top has scrolled past the reading line.
        const readingLine = window.innerHeight * 0.25;
        let current = headings[0].id;
        for (const h of headings) {
          const el = headingElement(h.id);
          if (el && el.getBoundingClientRect().top <= readingLine) current = h.id;
        }
        setActiveId(current);
      });
    };
    update();
    // Capture phase so this sees scrolls from whichever ancestor actually scrolls.
    document.addEventListener("scroll", update, { capture: true, passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", update, { capture: true });
      window.removeEventListener("resize", update);
    };
  }, [headings]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const inBrowser = useSyncExternalStore(noopSubscribe, () => true, () => false);

  if (headings.length < 2 || !inBrowser) return null;

  // Depth is relative to the shallowest heading, so a page that only uses H2/H3 isn't all indented.
  const minLevel = Math.min(...headings.map((h) => h.level));
  const depth = (level: number) => Math.min(level - minLevel, 2);

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };
  const jumpTo = (id: string) => {
    headingElement(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  };

  // Portalled to <body>: the page transition wrapper animates with a transform, and a transformed
  // ancestor turns `position: fixed` into "scrolls with the content" — the outline would only be
  // visible at the top of the page.
  return createPortal(
    <nav
      aria-label="Page outline"
      className="fixed top-32 right-4 z-20 hidden xl:block"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <div
        className={cn(
          "flex flex-col items-end gap-2 py-2 pr-1 pl-4 transition-opacity duration-150",
          open && "pointer-events-none opacity-0",
        )}
      >
        {headings.map((h) => (
          <span
            key={h.id}
            className={cn(
              "h-0.5 rounded-full transition-colors",
              DASH_WIDTH[depth(h.level)],
              h.id === activeId ? "bg-foreground" : "bg-muted-foreground/35",
            )}
          />
        ))}
      </div>

      {open && (
        <div className="absolute top-0 right-0 w-72 animate-in fade-in-0 slide-in-from-right-1 duration-150">
          <ul className="max-h-[65vh] overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-lg shadow-black/10">
            {headings.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => jumpTo(h.id)}
                  className={cn(
                    "block w-full truncate rounded-md py-1 pr-2 text-left text-[0.8125rem] leading-5 transition-colors hover:bg-accent",
                    LIST_INDENT[depth(h.level)],
                    h.id === activeId
                      ? "font-medium text-primary"
                      : depth(h.level) === 0
                        ? "text-foreground/90"
                        : "text-muted-foreground hover:text-foreground",
                  )}
                  title={h.text}
                >
                  {h.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>,
    document.body,
  );
}
