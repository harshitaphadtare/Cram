"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Headphones, Loader2, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildSpeechChunks, type SpeechChunk } from "@/lib/speech-chunks";
import { cn } from "@/lib/utils";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const READING_CLASS = "cram-reading";

type Status = "loading" | "playing" | "paused" | "done";

function blockElement(id: string) {
  return document.querySelector<HTMLElement>(`.bn-block-outer[data-id="${CSS.escape(id)}"]`);
}

/**
 * "Listen to this page": reads the notes aloud in a calm Gemini voice, section by section,
 * highlighting and following the section being read. The next section is fetched while the
 * current one plays, so there's no gap between them.
 */
export function ListenPlayer({ pageId, getBlocks }: { pageId: string; getBlocks: () => unknown[] }) {
  const [chunks, setChunks] = useState<SpeechChunk[] | null>(null);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [speed, setSpeed] = useState(1);
  const [fraction, setFraction] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urls = useRef(new Map<number, Promise<string>>());
  const runRef = useRef(0);
  const speedRef = useRef(speed);

  useEffect(() => {
    speedRef.current = speed;
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const clipUrl = useCallback(
    (list: SpeechChunk[], i: number) => {
      let url = urls.current.get(i);
      if (!url) {
        url = fetch("/api/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId, text: list[i].text }),
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
        url.catch(() => urls.current.delete(i));
        urls.current.set(i, url);
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
      audio.pause();
      setIndex(i);
      setFraction(0);
      setStatus("loading");
      try {
        const url = await clipUrl(list, i);
        if (run !== runRef.current) return; // skipped elsewhere meanwhile
        audio.src = url;
        audio.playbackRate = speedRef.current;
        await audio.play();
        setStatus("playing");
        if (i + 1 < list.length) void clipUrl(list, i + 1).catch(() => {});
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
    urls.current.clear();
    audioRef.current ??= new Audio();
    setChunks(list);
    void playChunk(list, 0);
  }

  const stop = useCallback(() => {
    runRef.current++;
    audioRef.current?.pause();
    setChunks(null);
  }, []);

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

  const overall = chunks ? Math.min(1, (index + fraction) / chunks.length) : 0;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={chunks ? stop : start}
        className={cn("shrink-0 gap-1.5 text-muted-foreground", chunks && "text-primary")}
        aria-label={chunks ? "Stop listening" : "Listen to this page"}
      >
        <Headphones />
        {chunks ? "Listening" : "Listen"}
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
                    disabled={status === "loading"}
                  >
                    {status === "loading" ? (
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
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {status === "loading" ? "Preparing audio…" : `Section ${index + 1} of ${chunks.length}`}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-12 shrink-0 text-xs tabular-nums"
                  aria-label="Playback speed"
                  onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}
                >
                  {speed}×
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Close player" onClick={stop}>
                  <X />
                </Button>
              </div>
              <div className="h-1 bg-muted">
                <div
                  className="h-full bg-primary transition-[width] duration-300 ease-linear"
                  style={{ width: `${overall * 100}%` }}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
