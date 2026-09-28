"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { EmojiPicker } from "frimousse";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setPageIcon } from "@/app/actions/pages";
import { cn } from "@/lib/utils";

/** A page's icon: its emoji if it has one, otherwise the default page glyph. */
export function PageIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
  if (icon) {
    return (
      <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center leading-none", className)}>
        {icon}
      </span>
    );
  }
  return <FileText aria-hidden className={cn("shrink-0 text-muted-foreground", className)} strokeWidth={1.75} />;
}

/**
 * Clickable page icon that opens a Notion-style emoji picker (search, categories, Remove).
 * Read-only for viewers. `size` scales both the icon and its hit area.
 */
export function PageIconPicker({
  pageId,
  icon: initialIcon,
  editable,
  size = "md",
  className,
}: {
  pageId: string;
  icon: string | null;
  editable: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [icon, setIcon] = useState(initialIcon);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  // Follow updates from elsewhere (e.g. changed in another tab, or after navigation).
  const [seen, setSeen] = useState(initialIcon);
  if (seen !== initialIcon) {
    setSeen(initialIcon);
    setIcon(initialIcon);
  }

  const glyph =
    size === "lg"
      ? "size-[3.25rem] text-[2.75rem]"
      : size === "md"
        ? "size-[1.125rem] text-[1.0625rem]"
        : "size-4 text-[0.9375rem]";

  function choose(next: string | null) {
    const previous = icon;
    setIcon(next);
    setOpen(false);
    startTransition(async () => {
      try {
        await setPageIcon(pageId, next);
      } catch {
        setIcon(previous);
        toast.error("Couldn't change the icon.");
      }
    });
  }

  if (!editable) return <PageIcon icon={icon} className={cn(glyph, className)} />;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={icon ? "Change icon" : "Add an icon"}
            title={icon ? "Change icon" : "Add an icon"}
            onClick={(e) => {
              // Inside links (sidebar, sub-page list): pick an icon instead of navigating.
              e.preventDefault();
              e.stopPropagation();
            }}
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-md transition-colors hover:bg-muted",
              size === "lg" ? "p-1.5" : "p-0.5",
              className,
            )}
          >
            <PageIcon icon={icon} className={glyph} />
          </button>
        }
      />
      <PopoverContent align="start" className="w-[22rem] max-w-[calc(100vw-1rem)] p-0">
        <EmojiPicker.Root
          onEmojiSelect={({ emoji }) => choose(emoji)}
          columns={9}
          className="flex h-80 flex-col"
        >
          <div className="flex items-center gap-2 border-b p-2">
            <EmojiPicker.Search
              autoFocus
              placeholder="Search emoji…"
              className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
            />
            {icon && (
              <button
                type="button"
                onClick={() => choose(null)}
                className="h-8 shrink-0 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Remove
              </button>
            )}
          </div>
          <EmojiPicker.Viewport className="relative flex-1 outline-none">
            <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Loading emoji…
            </EmojiPicker.Loading>
            <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              No emoji found
            </EmojiPicker.Empty>
            <EmojiPicker.List
              className="pb-1.5 select-none"
              components={{
                CategoryHeader: ({ category, ...props }) => (
                  <div
                    className="bg-popover px-3 pt-3 pb-1.5 text-xs font-medium text-muted-foreground"
                    {...props}
                  >
                    {category.label}
                  </div>
                ),
                Row: ({ children, ...props }) => (
                  <div className="scroll-my-1.5 px-1.5" {...props}>
                    {children}
                  </div>
                ),
                Emoji: ({ emoji, ...props }) => (
                  <button
                    className="flex size-9 items-center justify-center rounded-md text-xl data-[active]:bg-accent"
                    {...props}
                  >
                    {emoji.emoji}
                  </button>
                ),
              }}
            />
          </EmojiPicker.Viewport>
        </EmojiPicker.Root>
      </PopoverContent>
    </Popover>
  );
}
