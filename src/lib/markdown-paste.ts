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

  return normalizeMarkdown(text);
}

/**
 * Markdown only treats "- item" as a bullet when a normal space follows the marker. Many apps
 * copy a non-breaking (or other Unicode) space there instead, which silently turns every bullet
 * into a "- item" paragraph. Swap those for normal spaces, and turn "•" bullets into "-".
 */
export function normalizeMarkdown(text: string): string {
  // After the marker, accept the spaces Markdown doesn't count as whitespace — no-break, en/em/
  // thin/narrow no-break, ideographic and zero-width spaces — and rewrite them as one plain space.
  return text
    .replace(/\r\n?/g, "\n")
    .replace(
      /^([ \t\u00a0]*)([-*+\u2022]|\d+[.)])(?:[\u00a0\u2000-\u200b\u202f\u205f\u3000]|[ \t])+/gm,
      (_, lead: string, marker: string) => `${lead.replace(/\u00a0/g, " ")}${marker === "\u2022" ? "-" : marker} `,
    );
}

const BULLET_MARKER = /^\s*[-*•–]\s+/;

/**
 * Some apps (Claude, ChatGPT and others) put bullets on the clipboard as plain paragraphs that
 * start with "- " (<p>- Protecting PII</p>, or several lines in one <p> split by <br>), so they
 * paste as dash-prefixed paragraphs with paragraph spacing. Turns runs of those into real <ul>
 * lists. Returns the fixed HTML, or null if there was nothing to fix.
 */
export function fixDashBulletsInHtml(html: string): string | null {
  if (!html || !/<p[\s>]/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  let changed = false;

  // A <p> holding several "- item" lines separated by <br>: split into one <p> per line first.
  for (const p of [...doc.querySelectorAll("p")]) {
    if (!p.querySelector("br")) continue;
    const parts: Node[][] = [[]];
    for (const node of [...p.childNodes]) {
      if (node.nodeName === "BR") parts.push([]);
      else parts[parts.length - 1].push(node);
    }
    const lines = parts.filter((nodes) => nodes.some((n) => n.textContent?.trim()));
    if (lines.length < 2 || !lines.every((nodes) => BULLET_MARKER.test(nodes.map((n) => n.textContent).join("")))) continue;
    const replacements = lines.map((nodes) => {
      const line = doc.createElement("p");
      line.append(...nodes);
      return line;
    });
    p.replaceWith(...replacements);
    changed = true;
  }

  // Runs of consecutive "- item" paragraphs become one list.
  const isBulletP = (el: Element | null): el is HTMLParagraphElement =>
    !!el && el.tagName === "P" && BULLET_MARKER.test(el.textContent ?? "");
  for (const p of [...doc.querySelectorAll("p")]) {
    if (!p.isConnected || !isBulletP(p) || isBulletP(p.previousElementSibling)) continue;
    const run: HTMLParagraphElement[] = [];
    for (let el: Element | null = p; isBulletP(el); el = el.nextElementSibling) run.push(el);
    const ul = doc.createElement("ul");
    for (const item of run) {
      stripLeadingMarker(item);
      const li = doc.createElement("li");
      li.append(...item.childNodes);
      ul.append(li);
    }
    p.before(ul);
    run.forEach((item) => item.remove());
    changed = true;
  }

  return changed ? doc.body.innerHTML : null;
}

/** Removes the "- " / "• " marker from the first text in an element (it may be inside <span>s). */
function stripLeadingMarker(el: Element) {
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    if (!text.trim()) continue;
    node.textContent = text.replace(BULLET_MARKER, "");
    return;
  }
}
