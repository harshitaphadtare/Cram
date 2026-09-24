"use client";

/** Tiny Web Audio beeps — no audio files to ship, just short synthesized tones. */

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedCtx) {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      sharedCtx = new AudioCtx();
    }
    if (sharedCtx.state === "suspended") void sharedCtx.resume();
    return sharedCtx;
  } catch {
    return null;
  }
}

/** @param durationMs tone length in milliseconds. @param delayMs when to start, ms from now. */
function playTone(freq: number, durationMs: number, delayMs = 0, gainPeak = 0.3) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const durationSec = durationMs / 1000;
  const startAt = ctx.currentTime + delayMs / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + durationSec);
  osc.start(startAt);
  osc.stop(startAt + durationSec);
}

/** Soft, quick blip for completing a small action (checking off a task). */
export function playTaskCompleteSound() {
  playTone(880, 120, 0);
  playTone(1320, 180, 90);
}

/** Slightly more energetic double-tone for starting a focus session. */
export function playStartSound() {
  playTone(523.25, 110, 0);
  playTone(659.25, 160, 100);
}

/** Mirror of playStartSound — same two notes, descending instead of ascending, so pause reads as
 * the natural inverse of start. */
export function playPauseSound() {
  playTone(659.25, 110, 0);
  playTone(523.25, 160, 100);
}

/** Longer chime for a timer finishing. */
export function playTimerDoneSound() {
  playTone(880, 900, 0, 0.32);
  playTone(1108.73, 900, 120, 0.28);
}
