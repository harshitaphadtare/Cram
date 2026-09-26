"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Check,
  GripVertical,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings2,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildSpeechChunks, type SpeechChunk } from "@/lib/speech-chunks";
import { DEFAULT_TTS_VOICE, TTS_VOICES, isTtsVoice, type TtsVoice } from "@/lib/tts-voices";
import { cn } from "@/lib/utils";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const READING_STYLE =
  "border-radius: 6px; background: color-mix(in oklab, var(--primary) 10%, transparent); " +
  "box-shadow: -8px 0 0 color-mix(in oklab, var(--primary) 10%, transparent), " +
  "8px 0 0 color-mix(in oklab, var(--primary) 10%, transparent);";
const PREFS_KEY = "cram-read-aloud";

type Status = "loading" | "playing" | "paused" | "done";

interface Prefs {
  voice: TtsVoice;
  speed: number;
}

function loadPrefs(): Prefs {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<Prefs>;
    return {
      voice: isTtsVoice(saved.voice) ? saved.voice : DEFAULT_TTS_VOICE,
      speed: SPEEDS.includes(saved.speed ?? 0) ? saved.speed! : 1,
    };
  } catch {
    return { voice: DEFAULT_TTS_VOICE, speed: 1 };
  }
}

function savePrefs(prefs: Prefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable — preferences just won't be remembered.
  }
}

/** Rough time Gemini needs to voice a chunk (measured ≈ 65 ms per character, plus overhead). */
function estimatedPrepMs(text: string) {
  return 1500 + text.length * 65;
}

function blockElement(id: string) {
  return document.querySelector<HTMLElement>(`.bn-block-outer[data-id="${CSS.escape(id)}"]`);
}

/**
 * "Read aloud": reads the page's notes in a calm Gemini voice, section by section, highlighting and
 * following the section being read. Nothing is generated until the button is pressed. The next
 * section is fetched while the current one plays, so there's no gap between them.
 */
export function ListenPlayer({
  pageId,
  getBlocks,
  anchorRef,
}: {
  pageId: string;
  getBlocks: () => unknown[];
  /** The notes column — the player is centred under it rather than under the whole window. */
  anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const [chunks, setChunks] = useState<SpeechChunk[] | null>(null);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [prefs, setPrefs] = useState<Prefs>({ voice: DEFAULT_TTS_VOICE, speed: 1 });
  const [fraction, setFraction] = useState(0);
  const [prep, setPrep] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urls = useRef(new Map<string, Promise<string>>());
  const runRef = useRef(0);
  const prefsRef = useRef(prefs);
  const [centerX, setCenterX] = useState<number | null>(null);
  const [minimized, setMinimized] = useState(false);
  /** Where the player was dragged to (top-left, px); null = default spot centred under the notes. */
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    prefsRef.current = prefs;
    if (audioRef.current) audioRef.current.playbackRate = prefs.speed;
  }, [prefs]);

  const clipUrl = useCallback(
    (list: SpeechChunk[], i: number, voice: TtsVoice) => {
      const key = `${voice}:${i}`;
      let url = urls.current.get(key);
      if (!url) {
        url = fetch("/api/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId, text: list[i].text, voice }),
        }).then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? "Couldn't generate audio.");
          }
          // Cached clips come back as a URL; if caching failed the audio itself comes back.
          if (res.headers.get("Content-Type")?.startsWith("audio/")) {
            return URL.createObjectURL(await res.blob());
          }
          return ((await res.json()) as { url: string }).url;
        });
        // A failed clip shouldn't stay cached — allow a retry.
        url.catch(() => urls.current.delete(key));
        urls.current.set(key, url);
      }
      return url;
    },
    [pageId],
  );

  const playChunk = useCallback(
    async (list: SpeechChunk[], i: number) => {
      const run = ++runRef.current;
      const audio = audioRef.current;
      if (!audio) return;
      const { voice } = prefsRef.current;
      audio.pause();
      setIndex(i);
      setFraction(0);
      setStatus("loading");
      try {
        const url = await clipUrl(list, i, voice);
        if (run !== runRef.current) return; // skipped elsewhere meanwhile
        audio.src = url;
        audio.playbackRate = prefsRef.current.speed;
        await audio.play();
        setStatus("playing");
        if (i + 1 < list.length) void clipUrl(list, i + 1, voice).catch(() => {});
      } catch (err) {
        if (run !== runRef.current) return;
        setStatus("paused");
        toast.error(err instanceof Error ? err.message : "Couldn't play this section.");
      }
    },
    [clipUrl],
  );

  function start() {
    const list = buildSpeechChunks(getBlocks() as Parameters<typeof buildSpeechChunks>[0]);
    if (list.length === 0) {
      toast.info("There's nothing to read on this page yet.");
      return;
    }
    const loaded = loadPrefs();
    prefsRef.current = loaded;
    setPrefs(loaded);
    audioRef.current ??= new Audio();
    setChunks(list);
    void playChunk(list, 0);
  }

  const stop = useCallback(() => {
    runRef.current++;
    audioRef.current?.pause();
    setChunks(null);
    setMinimized(false);
    setPos(null);
  }, []);

  function updatePrefs(patch: Partial<Prefs>) {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setPrefs(next);
    savePrefs(next);
    // A new voice means new audio: replay the current section in it.
    if (patch.voice && chunks && status !== "done") void playChunk(chunks, index);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!chunks || !audio) return;
    if (status === "done") return void playChunk(chunks, 0);
    if (status === "playing") {
      audio.pause();
      setStatus("paused");
    } else if (status === "paused") {
      if (audio.src) {
        audio.play().then(() => setStatus("playing")).catch(() => void playChunk(chunks, index));
      } else {
        void playChunk(chunks, index);
      }
    }
  }

  // "Preparing audio" progress: an estimate from the section's length that eases towards 95% —
  // enough to show the request is being worked on without pretending to know exactly.
  useEffect(() => {
    if (!chunks || status !== "loading") return;
    const started = Date.now();
    const expected = estimatedPrepMs(chunks[index].text);
    const tick = () => setPrep(0.95 * (1 - Math.exp((-2.2 * (Date.now() - started)) / expected)));
    tick();
    const timer = setInterval(tick, 150);
    return () => {
      clearInterval(timer);
      setPrep(0);
    };
  }, [chunks, index, status]);

  // Audio element events: progress within a clip, and moving on when it finishes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!chunks || !audio) return;
    const onTime = () => setFraction(audio.duration ? audio.currentTime / audio.duration : 0);
    const onEnded = () => {
      if (index + 1 < chunks.length) void playChunk(chunks, index + 1);
      else {
        setStatus("done");
        setFraction(1);
      }
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, [chunks, index, playChunk]);

  // Highlight the section being read. Done with an injected stylesheet keyed by block id rather
  // than classes on the blocks: the editor re-renders its DOM and would wipe added classes.
  useEffect(() => {
    if (!chunks || status === "done") return;
    const style = document.createElement("style");
    style.textContent =
      chunks[index].blockIds
        .map((id) => {
          const sel = `[data-id="${CSS.escape(id)}"]`;
          // Whichever wrapper carries the id, target the block's own text (not nested children).
          return `${sel} > .bn-block-content, ${sel} > .bn-block > .bn-block-content`;
        })
        .join(",\n") + ` { ${READING_STYLE} }`;
    document.head.appendChild(style);
    return () => style.remove();
  }, [chunks, index, status]);

  // Follow along: bring each new section into view (only when the section changes).
  useEffect(() => {
    if (!chunks) return;
    blockElement(chunks[index].blockIds[0])?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [chunks, index]);

  function seekBy(seconds: number) {
    const audio = audioRef.current;
    if (!chunks || !audio || !audio.duration) return;
    const target = audio.currentTime + seconds;
    if (target >= audio.duration && index + 1 < chunks.length) return void playChunk(chunks, index + 1);
    audio.currentTime = Math.min(Math.max(0, target), audio.duration);
    setFraction(audio.currentTime / audio.duration);
  }

  // Dragging: the player can be moved anywhere in the window (kept fully on screen).
  function startDrag(e: React.PointerEvent<HTMLElement>) {
    const panel = panelRef.current;
    if (!panel || e.button !== 0) return;
    e.preventDefault();
    const rect = panel.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    const move = (ev: PointerEvent) => {
      const pad = 8;
      setPos({
        x: Math.min(Math.max(pad, ev.clientX - offsetX), window.innerWidth - rect.width - pad),
        y: Math.min(Math.max(pad, ev.clientY - offsetY), window.innerHeight - rect.height - pad),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Keep a moved player on screen when the window shrinks or it expands from minimized.
  useEffect(() => {
    if (!pos) return;
    const clamp = () => {
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(8, Math.min(pos.x, window.innerWidth - rect.width - 8));
      const y = Math.max(8, Math.min(pos.y, window.innerHeight - rect.height - 8));
      if (x !== pos.x || y !== pos.y) setPos({ x, y });
    };
    const frame = requestAnimationFrame(clamp);
    window.addEventListener("resize", clamp);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", clamp);
    };
  }, [pos, minimized]);

  // Keep the player centred on the notes column as the sidebar opens/closes or the window resizes.
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!chunks || !anchor) return;
    const measure = () => {
      const rect = anchor.getBoundingClientRect();
      setCenterX(rect.left + rect.width / 2);
    };
    measure();
    const observer = new ResizeObserver(measure);
    // The column itself often keeps its width and only shifts, so watch its container too.
    observer.observe(anchor);
    if (anchor.parentElement) observer.observe(anchor.parentElement);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [chunks, anchorRef]);

  // Stop when leaving the page; Escape closes the player.
  useEffect(() => () => stop(), [stop]);
  useEffect(() => {
    if (!chunks) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chunks, stop]);

  const loading = status === "loading";
  const overall = chunks ? Math.min(1, (index + fraction) / chunks.length) : 0;
  const progress = loading ? prep : overall;

  const playButton = chunks && (
    <Button
      size={minimized ? "icon-sm" : "icon"}
      className="rounded-full"
      aria-label={status === "playing" ? "Pause" : "Play"}
      onClick={togglePlay}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="animate-spin" />
      ) : status === "playing" ? (
        <Pause />
      ) : (
        <Play className="translate-x-px" />
      )}
    </Button>
  );

  const transport = (size: "icon-sm" | "icon-xs") => (
    <>
      <Button variant="ghost" size={size} aria-label="Back 5 seconds" disabled={loading} onClick={() => seekBy(-5)}>
        <SeekIcon direction="back" />
      </Button>
      {playButton}
      <Button variant="ghost" size={size} aria-label="Forward 5 seconds" disabled={loading} onClick={() => seekBy(5)}>
        <SeekIcon direction="forward" />
      </Button>
    </>
  );

  const dragHandle = (
    <button
      type="button"
      aria-label="Move player (double-click to reset)"
      title="Drag to move · double-click to reset"
      onPointerDown={startDrag}
      onDoubleClick={() => setPos(null)}
      className="flex h-8 w-4 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical className="size-4" />
    </button>
  );

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={chunks ? stop : start}
        className={cn("shrink-0 gap-1.5", chunks ? "text-primary" : "text-muted-foreground")}
      >
        <Volume2 />
        {chunks ? "Stop reading" : "Read aloud"}
      </Button>

      {chunks &&
        createPortal(
          <div
            ref={panelRef}
            role="region"
            aria-label="Read-aloud player"
            style={pos ? { left: pos.x, top: pos.y } : { left: centerX ?? "50%" }}
            className={cn(
              "fixed z-40 animate-in fade-in-0 duration-200",
              !pos && "bottom-5 -translate-x-1/2 slide-in-from-bottom-2",
              !minimized && "w-[min(36rem,calc(100vw-2rem))]",
            )}
          >
            {minimized ? (
              <div className="relative flex items-center gap-0.5 overflow-hidden rounded-full border bg-popover/95 py-1 pr-1 pl-1 text-popover-foreground shadow-xl backdrop-blur">
                {dragHandle}
                {transport("icon-xs")}
                <span className="min-w-9 px-1 text-center text-xs text-muted-foreground tabular-nums">
                  {loading ? `${Math.round(prep * 100)}%` : `${index + 1}/${chunks.length}`}
                </span>
                <Button variant="ghost" size="icon-xs" aria-label="Expand player" onClick={() => setMinimized(false)}>
                  <Maximize2 />
                </Button>
                <Button variant="ghost" size="icon-xs" aria-label="Close player" onClick={stop}>
                  <X />
                </Button>
                {/* Progress along the bottom edge of the pill. */}
                <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-muted">
                  <div
                    className={cn("h-full bg-primary transition-[width] duration-300", loading && "animate-pulse")}
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border bg-popover/95 text-popover-foreground shadow-xl backdrop-blur">
                <div className="flex items-center gap-1.5 py-2.5 pr-2 pl-1.5">
                  {dragHandle}
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Previous section"
                      disabled={index === 0}
                      onClick={() => void playChunk(chunks, index - 1)}
                    >
                      <SkipBack />
                    </Button>
                    {transport("icon-sm")}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Next section"
                      disabled={index >= chunks.length - 1}
                      onClick={() => void playChunk(chunks, index + 1)}
                    >
                      <SkipForward />
                    </Button>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-1">
                    <span className="truncate text-sm font-medium">
                      {status === "done" ? "Finished" : chunks[index].text.split("\n")[0].replace(/\.$/, "")}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
                      {loading
                        ? `Preparing audio… ${Math.round(prep * 100)}%`
                        : `Section ${index + 1} of ${chunks.length} · ${prefs.speed}×`}
                    </span>
                  </div>

                  <ReadAloudSettings prefs={prefs} onChange={updatePrefs} />
                  <Button variant="ghost" size="icon-sm" aria-label="Minimize player" onClick={() => setMinimized(true)}>
                    <Minimize2 />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Close player" onClick={stop}>
                    <X />
                  </Button>
                </div>

                {/* While preparing: how far along the audio is. While playing: how far through the page. */}
                <div className="h-1 bg-muted">
                  <div
                    className={cn(
                      "h-full transition-[width] ease-linear",
                      loading ? "animate-pulse bg-primary/60 duration-150" : "bg-primary duration-300",
                    )}
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

/** ⟲ / ⟳ with a small "5" inside, like podcast players. */
function SeekIcon({ direction }: { direction: "back" | "forward" }) {
  const Icon = direction === "back" ? RotateCcw : RotateCw;
  return (
    <span className="relative flex items-center justify-center">
      <Icon className="size-[18px]" strokeWidth={1.75} />
      <span className="absolute pt-px text-[7px] leading-none font-bold">5</span>
    </span>
  );
}

function ReadAloudSettings({ prefs, onChange }: { prefs: Prefs; onChange: (patch: Partial<Prefs>) => void }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Read-aloud settings">
            <Settings2 />
          </Button>
        }
      />
      <PopoverContent side="top" align="end" className="w-72 p-3">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Speed</p>
            <div className="grid grid-cols-6 gap-1 rounded-lg bg-muted p-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ speed: s })}
                  className={cn(
                    "rounded-md py-1 text-xs tabular-nums transition-colors",
                    prefs.speed === s
                      ? "bg-background font-medium text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Voice</p>
            <div className="flex flex-col gap-0.5">
              {TTS_VOICES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onChange({ voice: v.id })}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                    prefs.voice === v.id && "bg-accent",
                  )}
                >
                  <span className="flex-1">
                    {v.label}
                    <span className="ml-1.5 text-xs text-muted-foreground">{v.description}</span>
                  </span>
                  {prefs.voice === v.id && <Check className="size-4 text-primary" />}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">A new voice starts from the current section.</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
