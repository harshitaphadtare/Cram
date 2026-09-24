/** Extracts plain text from BlockNote block JSON (as stored in Page.content) for feeding to the quiz AI. */

interface InlineContentLike {
  type?: string;
  text?: string;
  content?: InlineContentLike[] | string;
}

interface TableCellLike {
  content?: InlineContentLike[] | string;
}

// A row's cells may be plain inline-content arrays or { content: [...] } wrapper objects
// depending on BlockNote version/source — handle both.
type TableCellEntry = InlineContentLike[] | TableCellLike;

interface TableContentLike {
  type?: "tableContent";
  rows?: { cells?: TableCellEntry[] }[];
}

interface BlockLike {
  type?: string;
  content?: InlineContentLike[] | string | TableContentLike;
  children?: BlockLike[];
  props?: Record<string, unknown>;
}

function inlineToText(content: InlineContentLike[] | string | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((node) => {
      if (typeof node.text === "string") return node.text;
      if (node.content) return inlineToText(node.content);
      return "";
    })
    .join("");
}

function tableToText(table: TableContentLike): string {
  if (!table.rows) return "";
  return table.rows
    .map((row) =>
      (row.cells ?? [])
        .map((cell) => inlineToText(Array.isArray(cell) ? cell : cell.content))
        .join(" | "),
    )
    .join("\n");
}

export function blocksToText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";

  const lines: string[] = [];

  function walk(block: BlockLike) {
    // Table blocks store `content` as { type: "tableContent", rows: [...] } rather than
    // inline content array/string — handle it separately instead of falling into inlineToText.
    if (block.content && typeof block.content === "object" && !Array.isArray(block.content)) {
      const text = tableToText(block.content as TableContentLike);
      if (text.trim()) lines.push(text);
    } else {
      const text = inlineToText(block.content as InlineContentLike[] | string | undefined);
      if (text.trim()) {
        lines.push(block.type === "codeBlock" ? `\`\`\`\n${text}\n\`\`\`` : text);
      }
    }
    block.children?.forEach(walk);
  }

  (blocks as BlockLike[]).forEach(walk);
  return lines.join("\n");
}
