import "server-only";
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_TTS_VOICE, type TtsVoice } from "@/lib/tts-voices";
import { withModelFallback } from "@/lib/gemini-router";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!, httpOptions: { timeout: 40_000 } });

/**
 * Speech models, routed like the quiz models (lib/gemini-router.ts): free-tier limits are per
 * model (3 requests/min, a small daily quota), and when one is exhausted the others usually aren't
 * — checked directly: the original model was out of quota while three others answered. All accept
 * the same prebuilt voices, so a section sounds the same whichever model reads it.
 */
export const TTS_MODELS = [
  "gemini-3.8-flash-tts",
  "gemini-3.8-flash-lite-tts",
  "gemini-2.5-flash-preview-tts",
  "gemini-3.1-flash-tts-preview",
  "gemini-2.5-pro-preview-tts",
];

/**
 * Part of every cached clip's name. Kept at the original model's name on purpose: clips are
 * interchangeable across models, and this keeps every clip already cached playable for free.
 */
export const TTS_CACHE_NAMESPACE = "gemini-3.1-flash-tts-preview";

const STYLE_PROMPT =
  "Read the following study notes aloud in a calm, warm and unhurried voice, like a patient tutor. " +
  "Pause briefly between sections. Read only the notes:";

/** Wraps raw 16-bit little-endian PCM in a WAV header so browsers can play it. */
function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // audio format: PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * 2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Speaks `text` in the given voice (calm by default) and returns a playable WAV file. */
export async function synthesizeSpeech(text: string, voice: TtsVoice = DEFAULT_TTS_VOICE): Promise<Buffer> {
  const response = await withModelFallback(
    (model, abortSignal) =>
      ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: `${STYLE_PROMPT}\n\n${text}` }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          abortSignal,
        },
      }),
    // The listener is waiting, so don't try for as long as a quiz would.
    { models: TTS_MODELS, deadlineMs: 35_000 },
  );

  const audio = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!audio?.data) throw new Error("The voice service returned no audio.");
  const bytes = Buffer.from(audio.data, "base64");

  // Newer models return a finished WAV file; older ones raw PCM ("audio/L16;codec=pcm;rate=24000").
  if (/wav/i.test(audio.mimeType ?? "") || bytes.subarray(0, 4).toString("ascii") === "RIFF") return bytes;
  const rate = Number(/rate=(\d+)/.exec(audio.mimeType ?? "")?.[1]) || 24000;
  return pcmToWav(bytes, rate);
}
