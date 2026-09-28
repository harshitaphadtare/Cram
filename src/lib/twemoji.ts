/**
 * Emoji are drawn as Twemoji images (like Notion, which draws its own emoji set) so they look the
 * same on every device instead of switching between Windows/Apple/Android styles.
 * Twemoji graphics © Twitter/X and contributors, CC-BY 4.0 (github.com/jdecked/twemoji).
 */

const TWEMOJI_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@16.0.1/assets/svg/";
const ZWJ = "‍";
const VARIATION_SELECTOR = /️/g;

/** Twemoji's file name for an emoji: its code points in hex, joined with "-". Twemoji drops the
 * U+FE0F variation selector except inside ZWJ sequences (e.g. 👩‍💻), so we do the same. */
export function twemojiUrl(emoji: string): string {
  const text = emoji.includes(ZWJ) ? emoji : emoji.replace(VARIATION_SELECTOR, "");
  return `${TWEMOJI_BASE}${codepoints(text)}.svg`;
}

/** A few ZWJ sequences (e.g. 👁️‍🗨️) are stored without their U+FE0F — the second place to look. */
export function twemojiFallbackUrl(emoji: string): string {
  return `${TWEMOJI_BASE}${codepoints(emoji.replace(VARIATION_SELECTOR, ""))}.svg`;
}

function codepoints(text: string) {
  return [...text].map((ch) => ch.codePointAt(0)!.toString(16)).join("-");
}
