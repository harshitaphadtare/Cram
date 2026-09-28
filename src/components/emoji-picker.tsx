"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Apple,
  Clock,
  Flag,
  Heart,
  Leaf,
  Lightbulb,
  Plane,
  Search,
  Shuffle,
  Smile,
  Volleyball,
  type LucideIcon,
} from "lucide-react";
import { twemojiFallbackUrl, twemojiUrl } from "@/lib/twemoji";
import { cn } from "@/lib/utils";

/**
 * Notion-style emoji picker: Emoji tab + Remove, a filter box with Random and skin tone, Recent
 * then category sections, and a category bar along the bottom that jumps between sections.
 * Emoji are drawn with Twemoji (see lib/twemoji.ts). The emoji list (emojibase) loads on first
 * open, so pages don't carry it.
 */

interface RawEmoji {
  group?: number;
  hexcode: string;
  label: string;
  order?: number;
  tags?: string[];
  unicode: string;
  skins?: { hexcode: string; unicode: string }[];
}

interface Emoji {
  unicode: string;
  label: string;
  search: string;
  /** Skin-tone variants keyed by tone modifier (1F3FB…1F3FF). */
  skins?: Record<string, string>;
}

interface Section {
  id: string;
  label: string;
  icon: LucideIcon;
  groups?: number[];
}

// Notion's order and grouping (smileys and people together).
const SECTIONS: Section[] = [
  { id: "recent", label: "Recent", icon: Clock },
  { id: "people", label: "People", icon: Smile, groups: [0, 1] },
  { id: "nature", label: "Animals & Nature", icon: Leaf, groups: [3] },
  { id: "food", label: "Food & Drink", icon: Apple, groups: [4] },
  { id: "activity", label: "Activity", icon: Volleyball, groups: [6] },
  { id: "travel", label: "Travel & Places", icon: Plane, groups: [5] },
  { id: "objects", label: "Objects", icon: Lightbulb, groups: [7] },
  { id: "symbols", label: "Symbols", icon: Heart, groups: [8] },
  { id: "flags", label: "Flags", icon: Flag, groups: [9] },
];

const TONES = [
  { id: "", swatch: "✋" },
  { id: "1F3FB", swatch: "✋🏻" },
  { id: "1F3FC", swatch: "✋🏼" },
  { id: "1F3FD", swatch: "✋🏽" },
  { id: "1F3FE", swatch: "✋🏾" },
  { id: "1F3FF", swatch: "✋🏿" },
];

const RECENT_KEY = "cram-recent-emoji";
const TONE_KEY = "cram-emoji-skin-tone";
const MAX_RECENT = 24;

let emojiLoad: Promise<Emoji[]> | null = null;

function loadEmoji(): Promise<Emoji[]> {
  emojiLoad ??= import("emojibase-data/en/compact.json").then((mod) => {
    const raw = (mod.default ?? mod) as unknown as RawEmoji[];
    return raw
      .filter((e) => e.group !== undefined && e.group !== 2) // 2 = bare skin-tone components
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((e) => ({
        unicode: e.unicode,
        label: e.label,
        search: `${e.label} ${(e.tags ?? []).join(" ")}`.toLowerCase(),
        group: e.group,
        skins: e.skins
          ? Object.fromEntries(
              e.skins
                // Single-tone variants only (couples etc. carry two tones).
                .filter((s) => s.hexcode.split("-").filter((part) => /^1F3F[B-F]$/.test(part)).length === 1)
                .map((s) => [s.hexcode.split("-").find((part) => /^1F3F[B-F]$/.test(part))!, s.unicode]),
            )
          : undefined,
      })) as (Emoji & { group: number })[];
  });
  return emojiLoad;
}

function readList(key: string): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function readTone(): string {
  try {
    return window.localStorage.getItem(TONE_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * One emoji drawn as a Twemoji image. If Twemoji has no image for it (brand-new emoji), it falls
 * back to the system glyph — or, with `hideIfMissing` (picker cells), disappears.
 */
export function EmojiGlyph({
  emoji,
  className,
  hideIfMissing = false,
  onMissing,
}: {
  emoji: string;
  className?: string;
  hideIfMissing?: boolean;
  onMissing?: () => void;
}) {
  // 0 = usual file name, 1 = alternative spelling, 2 = no image.
  const [attempt, setAttempt] = useState<{ emoji: string; step: number }>({ emoji, step: 0 });
  const step = attempt.emoji === emoji ? attempt.step : 0;
  if (step === 2) {
    if (hideIfMissing) return null;
    return <span className={cn("inline-flex items-center justify-center leading-none", className)}>{emoji}</span>;
  }
  const src = step === 0 ? twemojiUrl(emoji) : twemojiFallbackUrl(emoji);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny CDN SVGs; next/image adds nothing here
    <img
      src={src}
      alt={emoji}
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => {
        const next = step === 0 && twemojiFallbackUrl(emoji) !== src ? 1 : 2;
        setAttempt({ emoji, step: next });
        if (next === 2) onMissing?.();
      }}
      className={cn("inline-block shrink-0 select-none", className)}
    />
  );
}

export function EmojiPicker({
  onSelect,
  onRemove,
}: {
  onSelect: (emoji: string) => void;
  /** Shown as "Remove" in the header when the page already has an emoji. */
  onRemove?: () => void;
}) {
  const [all, setAll] = useState<(Emoji & { group: number })[] | null>(null);
  const [query, setQuery] = useState("");
  const [tone, setTone] = useState(readTone);
  const [tonesOpen, setTonesOpen] = useState(false);
  const [recent, setRecent] = useState(() => readList(RECENT_KEY));
  // A category jump made while search results are showing waits for the sections to render.
  const pendingJump = useRef<string | null>(null);
  const [active, setActive] = useState(recent.length ? "recent" : "people");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    let cancelled = false;
    loadEmoji().then((list) => !cancelled && setAll(list as (Emoji & { group: number })[]));
    return () => {
      cancelled = true;
    };
  }, []);

  const withTone = (e: Emoji) => (tone && e.skins?.[tone]) || e.unicode;

  const sections = useMemo(() => {
    if (!all) return [];
    return SECTIONS.flatMap((section) => {
      if (section.id === "recent") {
        return recent.length ? [{ ...section, items: recent.map((u) => ({ unicode: u, label: "Recent", search: "" })) }] : [];
      }
      const items = all.filter((e) => section.groups!.includes(e.group));
      return items.length ? [{ ...section, items }] : [];
    });
  }, [all, recent]);

  const q = query.trim().toLowerCase();
  // Name matches before tag matches ("rocket" → 🚀 before astronauts tagged "rocket").
  const results = useMemo(() => {
    if (!all || !q) return [];
    const rank = (e: Emoji) => {
      const label = e.label.toLowerCase();
      if (label === q) return 0;
      if (label.startsWith(q)) return 1;
      return label.split(/[\s:-]+/).some((word) => word.startsWith(q)) ? 2 : 3;
    };
    return all
      .filter((e) => e.search.includes(q))
      .map((e, i) => ({ e, i, r: rank(e) }))
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .map((x) => x.e);
  }, [all, q]);

  const scrollToSection = (id: string) => {
    const el = sectionRefs.current.get(id);
    if (el && scrollRef.current) scrollRef.current.scrollTop = el.offsetTop - 4;
  };
  useEffect(() => {
    if (q || !pendingJump.current) return;
    scrollToSection(pendingJump.current);
    pendingJump.current = null;
  }, [q]);

  function choose(emoji: string) {
    const next = [emoji, ...recent.filter((e) => e !== emoji)].slice(0, MAX_RECENT);
    setRecent(next);
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
    // The picker can stay mounted between openings — start fresh next time, like Notion.
    setQuery("");
    setTonesOpen(false);
    onSelect(emoji);
  }

  function chooseTone(id: string) {
    setTone(id);
    setTonesOpen(false);
    try {
      window.localStorage.setItem(TONE_KEY, id);
    } catch {}
  }

  function random() {
    if (!all?.length) return;
    choose(withTone(all[Math.floor(Math.random() * all.length)]));
  }

  function jumpTo(id: string) {
    setActive(id);
    if (q) {
      pendingJump.current = id;
      setQuery("");
    } else {
      scrollToSection(id);
    }
  }

  // Highlight the section being scrolled through in the bottom bar.
  function onScroll() {
    const top = (scrollRef.current?.scrollTop ?? 0) + 12;
    let current = sections[0]?.id;
    for (const s of sections) {
      const el = sectionRefs.current.get(s.id);
      if (el && el.offsetTop <= top) current = s.id;
    }
    if (current && current !== active) setActive(current);
  }

  const toneSwatch = TONES.find((t) => t.id === tone)?.swatch ?? "✋";

  return (
    <div className="flex h-[26rem] w-full flex-col">
      {/* Tabs row (Notion: Emoji · Icons · Upload … Remove) — just Emoji here. */}
      <div className="flex items-center justify-between border-b px-3">
        <span className="relative py-2.5 text-sm font-medium after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-foreground">
          Emoji
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Remove
          </button>
        )}
      </div>

      {/* Filter · Random · Skin tone */}
      <div className="relative flex items-center gap-1.5 px-2.5 pt-2.5 pb-1.5">
        <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-muted/40 px-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) choose(withTone(results[0]));
            }}
            placeholder="Filter…"
            aria-label="Filter emoji"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <button
          type="button"
          onClick={random}
          title="Random"
          aria-label="Random emoji"
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Shuffle className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setTonesOpen((o) => !o)}
          title="Skin tone"
          aria-label="Choose skin tone"
          aria-expanded={tonesOpen}
          className="flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-muted"
        >
          <EmojiGlyph emoji={toneSwatch} className="size-5" />
        </button>
        {tonesOpen && (
          <div className="absolute top-full right-2.5 z-10 flex gap-0.5 rounded-lg border bg-popover p-1 shadow-lg">
            {TONES.map((t) => (
              <button
                key={t.id || "default"}
                type="button"
                onClick={() => chooseTone(t.id)}
                aria-label={t.id ? `Skin tone ${t.id}` : "Default skin tone"}
                className={cn("flex size-8 items-center justify-center rounded-md hover:bg-muted", tone === t.id && "bg-muted")}
              >
                <EmojiGlyph emoji={t.swatch} className="size-5" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Emoji */}
      <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto px-1.5 pb-2 [scrollbar-width:thin]">
        {!all ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading emoji…</p>
        ) : q ? (
          results.length ? (
            <EmojiSection label="Results" items={results} withTone={withTone} onPick={choose} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">No emoji found</p>
          )
        ) : (
          sections.map((s) => (
            <EmojiSection
              key={s.id}
              ref={(el) => {
                if (el) sectionRefs.current.set(s.id, el);
                else sectionRefs.current.delete(s.id);
              }}
              label={s.label}
              items={s.items}
              // Recent entries already carry the tone they were picked with.
              withTone={s.id === "recent" ? (e) => e.unicode : withTone}
              onPick={choose}
            />
          ))
        )}
      </div>

      {/* Category bar */}
      <div className="flex items-center justify-between border-t px-1.5 py-1">
        {SECTIONS.filter((s) => s.id !== "recent" || recent.length).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => jumpTo(s.id)}
            title={s.label}
            aria-label={s.label}
            className={cn(
              "flex size-8 items-center justify-center rounded-md transition-colors hover:bg-muted",
              active === s.id && !q ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
          >
            <s.icon className="size-[1.125rem]" strokeWidth={1.75} />
          </button>
        ))}
      </div>
    </div>
  );
}

function EmojiSection({
  ref,
  label,
  items,
  withTone,
  onPick,
}: {
  ref?: React.Ref<HTMLElement>;
  label: string;
  items: Emoji[];
  withTone: (e: Emoji) => string;
  onPick: (emoji: string) => void;
}) {
  return (
    <section ref={ref} className="[content-visibility:auto] [contain-intrinsic-size:auto_20rem]">
      <h3 className="sticky top-0 z-[1] bg-popover px-1.5 pt-2.5 pb-1.5 text-xs font-medium text-muted-foreground">
        {label}
      </h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(2rem,1fr))]">
        {items.map((e, i) => (
          <EmojiCell key={`${e.unicode}-${i}`} glyph={withTone(e)} label={e.label} onPick={onPick} />
        ))}
      </div>
    </section>
  );
}

/** A picker cell; removed from the grid if Twemoji has no image for the emoji (too new). */
function EmojiCell({ glyph, label, onPick }: { glyph: string; label: string; onPick: (emoji: string) => void }) {
  const [missing, setMissing] = useState<string | null>(null);
  if (missing === glyph) return null;
  return (
    <button
      type="button"
      onClick={() => onPick(glyph)}
      title={label}
      aria-label={label}
      className="flex aspect-square items-center justify-center rounded-md transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      <EmojiGlyph emoji={glyph} className="size-6" hideIfMissing onMissing={() => setMissing(glyph)} />
    </button>
  );
}
