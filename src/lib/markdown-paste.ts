/**
 * Decides whether a paste should be read as Markdown.
 *
 * Notes copied from Notion, Claude, ChatGPT etc. often arrive as rich HTML whose structure is lost
 * (bullets become paragraphs starting with "-", code fences become "```mermaid" text), while the
 * plain-text version of the same clipboard is proper Markdown. BlockNote's own check misses many
 * of these (it needs two adjacent list lines, or a complete fence), so this is broader — but it
 * still prefers the HTML when that has real lists or code blocks.
 */

const MD_LINE = /^\s{0,3}(?:[-*+]\s+\S|\d+[.)]\s+\S|#{1,6}\s+\S|>\s|```|~~~|\|.+\|)/;

export function shouldPasteAsMarkdown(clipboard: DataTransfer | null): string | null {
  if (!clipboard) return null;
  const types = [...clipboard.types];
  // Our own copies and files have better handling already.
  if (types.includes("blocknote/html") || types.includes("Files")) return null;

  const text = clipboard.getData("text/plain");
  if (!text.trim()) return null;

  const lines = text.split(/\r?\n/);
  const mdLines = lines.filter((l) => MD_LINE.test(l)).length;
  const hasFence = /(?:^|\n)\s{0,3}(```|~~~)/.test(text);
  const hasStrongSyntax = /\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)/.test(text);
  const looksMarkdown = hasFence || mdLines >= 2 || (mdLines >= 1 && hasStrongSyntax);
  if (!looksMarkdown) return null;

  // If the HTML already carries real structure, it's the richer source — keep it.
  const html = clipboard.getData("text/html");
  if (html && /<(?:ul|ol|pre|table|h[1-6])[\s>]/i.test(html) && !hasFence) return null;

  return text;
}
