"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmojiGlyph, EmojiPicker } from "@/components/emoji-picker";
import { setPageIcon } from "@/app/actions/pages";
import { cn } from "@/lib/utils";

/** A page's icon: its emoji (drawn with Twemoji, like Notion's own emoji set) or the page glyph. */
export function PageIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
  if (icon) return <EmojiGlyph emoji={icon} className={cn("shrink-0", className)} />;
  return <FileText aria-hidden className={cn("shrink-0 text-muted-foreground", className)} strokeWidth={1.75} />;
}

/**
 * Clickable page icon that opens the Notion-style emoji picker. Read-only for viewers.
 * `size` scales both the icon and its hit area.
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

  // Notion's page icon is 78px (64px on phones); list icons match the text.
  const glyph = size === "lg" ? "size-16 sm:size-[78px]" : size === "md" ? "size-[1.125rem]" : "size-4";

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
              size === "lg" ? "p-1" : "p-0.5",
              className,
            )}
          >
            <PageIcon icon={icon} className={glyph} />
          </button>
        }
      />
      <PopoverContent align="start" className="w-[25.5rem] max-w-[calc(100vw-1rem)] overflow-hidden p-0">
        <EmojiPicker onSelect={(emoji) => choose(emoji)} onRemove={icon ? () => choose(null) : undefined} />
      </PopoverContent>
    </Popover>
  );
}
