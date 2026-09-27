import { createCodeBlockSpec } from "@blocknote/core";
import { createLanguageButton, type LanguageList } from "@/lib/code-block-language-menu";
import { attachMermaidPreview } from "@/lib/mermaid-preview";

type CodeBlockSpec = ReturnType<typeof createCodeBlockSpec>;

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
          onPick: (next) => editor.updateBlock(block.id, { props: { language: next } }),
        });
        if (select?.parentElement) {
          select.parentElement.classList.add("cram-lang-slot");
          select.replaceWith(menu.button);
        }

        const mermaid =
          language === "mermaid" && base.contentDOM
            ? attachMermaidPreview(block, base.dom, base.contentDOM)
            : null;

        return {
          ...base,
          dom: mermaid?.dom ?? base.dom,
          // Our own UI (the picker's open state, the diagram) changes its DOM; the editor must not
          // mistake that for an edit, or it rebuilds the block and throws the UI away mid-use.
          ignoreMutation: (m: MutationRecord | { type: "selection"; target: Node }) =>
            menu.button.contains(m.target) ||
            (mermaid?.isOwnUi(m.target) ?? false) ||
            (base.ignoreMutation?.(m) ?? false),
          destroy: () => {
            menu.destroy();
            mermaid?.destroy();
            base.destroy?.();
          },
        };
      },
    },
  };
}
