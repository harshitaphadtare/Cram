/** Gemini prebuilt voices offered for read-aloud, calmest first. Shared by the player and the API. */
export const TTS_VOICES = [
  { id: "Sulafat", label: "Sulafat", description: "Warm and calm" },
  { id: "Achernar", label: "Achernar", description: "Soft" },
  { id: "Vindemiatrix", label: "Vindemiatrix", description: "Gentle" },
  { id: "Kore", label: "Kore", description: "Clear and steady" },
  { id: "Charon", label: "Charon", description: "Deep and informative" },
  { id: "Puck", label: "Puck", description: "Bright and upbeat" },
] as const;

export type TtsVoice = (typeof TTS_VOICES)[number]["id"];

export const DEFAULT_TTS_VOICE: TtsVoice = "Sulafat";

export function isTtsVoice(value: unknown): value is TtsVoice {
  return TTS_VOICES.some((v) => v.id === value);
}
