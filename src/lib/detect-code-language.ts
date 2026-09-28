/**
 * Best-guess language for a code block's contents, so pasting Mermaid (or SQL, Python, …) into a
 * code block picks the right language automatically. Deliberately conservative: it returns null
 * unless there's a clear signal, and callers only apply it to blocks whose language the user
 * hasn't chosen.
 */

const MERMAID_START =
  /^(?:%%[^\n]*\n\s*)*(?:flowchart|graph|sequenceDiagram|classDiagram(?:-v2)?|stateDiagram(?:-v2)?|erDiagram|gantt|pie|journey|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|C4Context|C4Container|C4Component|sankey-beta|xychart-beta|block-beta|packet-beta|architecture-beta|kanban)\b/;

/** Mermaid never parses as any other language, so it may replace the old JavaScript default. */
export function isMermaid(code: string): boolean {
  return MERMAID_START.test(code.trim());
}

const RULES: [language: string, test: (code: string) => boolean][] = [
  ["mermaid", isMermaid],
  [
    "json",
    (c) => {
      const t = c.trim();
      if (!/^[[{]/.test(t)) return false;
      try {
        JSON.parse(t);
        return true;
      } catch {
        return false;
      }
    },
  ],
  ["html", (c) => /^\s*<(?:!doctype|html|head|body|div|span|p|a|ul|ol|section|main|header|form|table)\b/i.test(c) && /<\/\w+>/.test(c)],
  ["sql", (c) => /^\s*(?:select|insert\s+into|update|delete\s+from|create\s+(?:table|index|view|database)|alter\s+table|drop\s+table|with\s+\w+\s+as)\b/i.test(c)],
  ["shellscript", (c) => /^\s*(?:\$\s|#!\/bin\/(?:ba|z)?sh|(?:npm|npx|pnpm|yarn|git|cd|ls|sudo|curl|wget|pip3?|brew|docker|kubectl|mkdir|chmod|export)\s)/m.test(c) && !/[;{}]\s*$/m.test(c)],
  ["python", (c) => /^\s*(?:def\s+\w+\s*\(.*\)\s*:|class\s+\w+(?:\(.*\))?\s*:|from\s+[\w.]+\s+import\s|import\s+[\w.]+\s*$|if\s+__name__\s*==|print\()/m.test(c)],
  ["java", (c) => /\b(?:public|private|protected)\s+(?:static\s+)?(?:final\s+)?(?:class|void|int|String)\b/.test(c) && /;\s*$/m.test(c)],
  ["cpp", (c) => /^\s*#include\s*<\w+(?:\.h)?>/m.test(c) && /\b(?:std::|cout|namespace|template)\b/.test(c)],
  ["c", (c) => /^\s*#include\s*<\w+\.h>/m.test(c)],
  ["rust", (c) => /\bfn\s+\w+\s*\(/.test(c) && /\b(?:let\s+mut|->|impl|pub\s+fn|println!)/.test(c)],
  ["typescript", (c) => /\b(?:interface\s+\w+\s*\{|type\s+\w+\s*=|:\s*(?:string|number|boolean|void)\b|as\s+const\b)/.test(c)],
  ["javascript", (c) => /\b(?:const|let|var)\s+\w+\s*=|\bfunction\s*\w*\s*\(|=>|console\.log\(|require\(|\bimport\s+.+\s+from\s+['"]|export\s+(?:default|const|function)/.test(c)],
  ["css", (c) => /^\s*(?:[.#]?[\w-]+(?:\s*[,>+~]?\s*[.#]?[\w-]+)*|:root|@media[^{]*)\s*\{[^}]*[\w-]+\s*:[^}]*\}/m.test(c)],
  ["yaml", (c) => /^[\w-]+:\s*(?:\S.*)?$/m.test(c) && /^\s+[\w-]+:|^\s*-\s+\S/m.test(c) && !/[{};]/.test(c)],
];

export function detectCodeLanguage(code: string, supported: Record<string, unknown>): string | null {
  if (code.trim().length < 4) return null;
  for (const [language, test] of RULES) {
    if (language in supported && test(code)) return language;
  }
  return null;
}
