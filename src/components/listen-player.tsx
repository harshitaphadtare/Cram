"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Check, Loader2, Pause, Play, Settings2, SkipBack, SkipForward, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildSpeechChunks, type SpeechChunk } from "@/lib/speech-chunks";
import { DEFAULT_TTS_VOICE, TTS_VOICES, isTtsVoice, type TtsVoice } from "@/lib/tts-voices";
import { cn } from "@/lib/utils";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const READING_CLASS = "cram-reading";
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
export function ListenPlayer({ pageId, getBlocks }: { pageId: string; getBlocks: () => unknown[] }) {
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

  // Highlight the section being read and keep it in view.
  useEffect(() => {
    if (!chunks || status === "done") return;
    const els = chunks[index].blockIds.map(blockElement).filter((el): el is HTMLElement => !!el);
    els.forEach((el) => el.classList.add(READING_CLASS));
    els[0]?.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => els.forEach((el) => el.classList.remove(READING_CLASS));
  }, [chunks, index, status]);

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
            role="region"
            aria-label="Read-aloud player"
            className="fixed bottom-5 left-1/2 z-40 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
          >
            <div className="overflow-hidden rounded-2xl border bg-popover/95 text-popover-foreground shadow-xl backdrop-blur">
              <div className="flex items-center gap-2 px-3 py-2.5">
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
                  <Button
                    size="icon"
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
                  style={{ width: `${(loading ? prep : overall) * 100}%` }}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
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
