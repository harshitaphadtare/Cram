import { createCodeBlockSpec } from "@blocknote/core";
import { createLanguageButton, type LanguageList } from "@/lib/code-block-language-menu";
import { attachMermaidPreview } from "@/lib/mermaid-preview";
import { detectCodeLanguage, isMermaid } from "@/lib/detect-code-language";

type CodeBlockSpec = ReturnType<typeof createCodeBlockSpec>;

/** Blocks whose language the user picked from the menu this session — never auto-detected. */
const chosenByUser = new Set<string>();

/**
 * Builds on BlockNote's code block:
 * - a Notion-style searchable language picker in place of the native <select>;
 * - an unknown language (e.g. from pasted code) falls back to plain text instead of throwing;
 * - Mermaid blocks render their diagram (BlockNote 0.55 declares a `createPreview` option in its
 *   types but doesn't implement it, so the block's render is wrapped instead).
 */
export function enhanceCodeBlock(spec: CodeBlockSpec, languages: LanguageList): CodeBlockSpec {
  const baseRender = spec.implementation.render;

  return {
    ...spec,
    implementation: {
      ...spec.implementation,
      render(block, editor) {
        let base: ReturnType<typeof baseRender>;
        let language = block.props.language;
        try {
          base = baseRender.call(this, block, editor);
        } catch {
          // BlockNote's picker throws for a language outside the supported list.
          language = "text";
          base = baseRender.call(this, { ...block, props: { ...block.props, language } }, editor);
        }

        // Swap the native <select> for our picker, in the same non-editable slot.
        const select = base.dom.querySelector("select");
        const menu = createLanguageButton({
          languages,
          current: language,
          editable: editor.isEditable,
          onPick: (next) => {
            chosenByUser.add(block.id);
            editor.updateBlock(block.id, { props: { language: next } });
          },
        });
        if (select?.parentElement) {
          select.parentElement.classList.add("cram-lang-slot");
          select.replaceWith(menu.button);
        }

        const mermaid =
          language === "mermaid" && base.contentDOM
            ? attachMermaidPreview(block, base.dom, base.contentDOM)
            : null;

        // Code isn't prose: no red spell-check squiggles under identifiers (Notion does the same).
        base.contentDOM?.setAttribute("spellcheck", "false");

        // Notion's "Copy" button: top-right, shown on hover (works in read-only pages too).
        const copy = mermaid ? null : createCopyButton(() => base.contentDOM?.textContent ?? "");
        if (copy) base.dom.appendChild(copy.el);

        return {
          ...base,
          dom: mermaid?.dom ?? base.dom,
          // Our own UI (the picker's open state, the diagram) changes its DOM; the editor must not
          // mistake that for an edit, or it rebuilds the block and throws the UI away mid-use.
          ignoreMutation: (m: MutationRecord | { type: "selection"; target: Node }) =>
            menu.button.contains(m.target) ||
            (copy?.el.contains(m.target) ?? false) ||
            (mermaid?.isOwnUi(m) ?? false) ||
            (base.ignoreMutation?.(m) ?? false),
          destroy: () => {
            menu.destroy();
            copy?.destroy();
            mermaid?.destroy();
            base.destroy?.();
          },
        };
      },
    },
  };
}

const COPY_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

/** A "Copy" button for a code block; shows "Copied" for a moment after a click. */
function createCopyButton(getText: () => string) {
  const el = document.createElement("div");
  el.className = "cram-code-actions";
  el.contentEditable = "false";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cram-code-copy";
  const show = (copied: boolean) => {
    button.innerHTML = `${copied ? CHECK_ICON : COPY_ICON}<span>${copied ? "Copied" : "Copy"}</span>`;
    button.dataset.copied = String(copied);
  };
  show(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  // mousedown would move the editor's cursor into the block; keep focus where it is.
  button.addEventListener("mousedown", (e) => e.preventDefault());
  button.addEventListener("click", () => {
    const text = getText();
    const done = () => {
      show(true);
      clearTimeout(timer);
      timer = setTimeout(() => show(false), 1500);
    };
    // The async clipboard API can be refused (no permission, embedded views); fall back to a
    // hidden textarea + execCommand, which still works there.
    navigator.clipboard
      .writeText(text)
      .then(done)
      .catch(() => {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        area.remove();
        if (ok) done();
      });
  });
  el.appendChild(button);
  return { el, destroy: () => clearTimeout(timer) };
}

interface CodeBlockLike {
  id: string;
  type: string;
  props?: { language?: string };
  content?: unknown;
  children?: CodeBlockLike[];
}

function blockText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content.map((c) => (typeof c?.text === "string" ? c.text : "")).join("");
}

/**
 * Sets the language of code blocks nobody has chosen one for, from their contents:
 * - "Plain Text" blocks (the default for new blocks) get whatever the code looks like;
 * - blocks on the old JavaScript default that clearly hold Mermaid become Mermaid.
 * Returns the updates to apply, so the caller can batch them.
 */
export function detectLanguageUpdates(
  blocks: CodeBlockLike[],
  languages: LanguageList,
): { id: string; language: string }[] {
  const updates: { id: string; language: string }[] = [];
  const walk = (list: CodeBlockLike[]) => {
    for (const b of list) {
      if (b.type === "codeBlock" && !chosenByUser.has(b.id)) {
        const code = blockText(b.content);
        const current = b.props?.language ?? "text";
        const detected =
          current === "text"
            ? detectCodeLanguage(code, languages)
            : current === "javascript" && isMermaid(code)
              ? "mermaid"
              : null;
        if (detected && detected !== current) updates.push({ id: b.id, language: detected });
      }
      if (b.children?.length) walk(b.children);
    }
  };
  walk(blocks);
  return updates;
}
