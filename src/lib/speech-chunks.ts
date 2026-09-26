/**
 * Splits a BlockNote document into short "read aloud" chunks. Each heading starts a new chunk, and
 * long sections are split at block boundaries, so every chunk is quick to synthesize and the
 * player can highlight exactly the blocks being read.
 */

export interface SpeechChunk {
  text: string;
  /** Block ids covered by this chunk, in reading order (for highlighting / scrolling). */
  blockIds: string[];
}

/** Keeps each clip to ~40s of audio, so the first one is ready within a few seconds. */
const MAX_CHUNK_CHARS = 600;

interface InlineLike {
  text?: string;
  content?: InlineLike[] | string;
}

interface BlockLike {
  id: string;
  type: string;
  content?: unknown;
  children?: BlockLike[];
}

function inlineText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return (content as InlineLike[])
    .map((node) => (typeof node.text === "string" ? node.text : inlineText(node.content)))
    .join("");
}

/** Text a listener should hear for one block — code, images and other media are skipped. */
function speakableText(block: BlockLike): string {
  switch (block.type) {
    case "heading":
    case "paragraph":
    case "bulletListItem":
    case "numberedListItem":
    case "checkListItem":
    case "toggleListItem":
    case "quote":
      return inlineText(block.content).replace(/\s+/g, " ").trim();
    default:
      return "";
  }
}

export function buildSpeechChunks(blocks: BlockLike[]): SpeechChunk[] {
  const chunks: SpeechChunk[] = [];
  let current: SpeechChunk | null = null;

  const flush = () => {
    if (current && current.text.trim()) chunks.push(current);
    current = null;
  };

  const visit = (block: BlockLike) => {
    const text = speakableText(block);
    if (text) {
      const isHeading = block.type === "heading";
      if (isHeading || (current && current.text.length + text.length > MAX_CHUNK_CHARS)) flush();
      if (!current) current = { text: "", blockIds: [] };
      // A full stop after headings and list items gives the voice a natural pause.
      const sentence = /[.!?:;]$/.test(text) ? text : `${text}.`;
      current.text += (current.text ? "\n" : "") + sentence;
      current.blockIds.push(block.id);
    }
    // Columns and nested blocks are read in document order.
    block.children?.forEach(visit);
  };

  blocks.forEach(visit);
  flush();
  return chunks;
}
