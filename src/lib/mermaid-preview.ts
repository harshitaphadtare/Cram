import { createCodeBlockSpec } from "@blocknote/core";

/**
 * Notion-style Mermaid code blocks: the block shows the rendered diagram, with a toggle to show
 * the editable source. The diagram re-renders as the source is edited.
 *
 * BlockNote 0.55 declares a `createPreview` option for code blocks in its types but doesn't
 * implement it, so this wraps the code block's own render instead.
 *
 * Mermaid is ~1 MB, so it's only loaded the first time a page actually contains a diagram.
 */

type MermaidApi = typeof import("mermaid").default;

let mermaidLoad: Promise<MermaidApi> | null = null;
let initializedTheme: string | null = null;
let renderCount = 0;
/** Rendered SVG per theme + source, so re-renders of unchanged diagrams are instant. */
const svgCache = new Map<string, Promise<string>>();

function loadMermaid() {
  mermaidLoad ??= import("mermaid").then((m) => m.default);
  return mermaidLoad;
}

function currentTheme() {
  return document.documentElement.classList.contains("dark") ? "dark" : "default";
}

async function renderSvg(source: string, theme: string): Promise<string> {
  const mermaid = await loadMermaid();
  if (initializedTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: theme as "dark" | "default",
      fontFamily: "inherit",
      suppressErrorRendering: true,
    });
    initializedTheme = theme;
  }
  const { svg } = await mermaid.render(`cram-mermaid-${++renderCount}`, source);
  return svg;
}

function hint(text: string) {
  const p = document.createElement("p");
  p.className = "cram-mermaid-hint";
  p.textContent = text;
  return p;
}

/**
 * Per-block state that must survive re-renders — BlockNote rebuilds a code block's DOM on every
 * edit, so anything kept on the element itself would reset with each keystroke.
 */
const codeShown = new Map<string, boolean>();
const lastDrawn = new Map<string, Node[]>();
const latestTarget = new Map<string, HTMLElement>();
const pendingDraw = new Map<string, ReturnType<typeof setTimeout>>();

function errorView(err: unknown): Node[] {
  const message = err instanceof Error ? err.message : String(err);
  const title = document.createElement("p");
  title.className = "cram-mermaid-error-title";
  title.textContent = "This diagram has an error — show the code to fix it.";
  const detail = document.createElement("pre");
  detail.className = "cram-mermaid-error";
  detail.textContent = message.split("\n").slice(0, 4).join("\n");
  return [title, detail];
}

/** Draws `source` for block `id` into that block's current preview element. */
function drawDiagram(id: string, source: string) {
  const code = source.trim();
  const show = (nodes: Node[]) => {
    lastDrawn.set(id, nodes);
    latestTarget.get(id)?.replaceChildren(...nodes.map((n) => n.cloneNode(true)));
  };
  if (!code) return show([hint("Empty diagram — show the code to write some Mermaid.")]);

  const theme = currentTheme();
  const key = `${theme}\n${code}`;
  let svg = svgCache.get(key);
  if (!svg) {
    svg = renderSvg(code, theme);
    svg.catch(() => svgCache.delete(key));
    svgCache.set(key, svg);
  }
  svg.then(
    (markup) => {
      const holder = document.createElement("div");
      holder.innerHTML = markup;
      show([...holder.childNodes]);
    },
    (err: unknown) => show(errorView(err)),
  );
}

/** Redraw after typing pauses — half-typed diagrams are usually invalid. */
function scheduleDraw(id: string, source: string, immediate: boolean) {
  clearTimeout(pendingDraw.get(id));
  if (immediate) return drawDiagram(id, source);
  pendingDraw.set(
    id,
    setTimeout(() => drawDiagram(id, source), 450),
  );
}

function blockText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content.map((c) => (typeof c?.text === "string" ? c.text : "")).join("");
}

type CodeBlockSpec = ReturnType<typeof createCodeBlockSpec>;

/** Adds diagram previews for `language === "mermaid"` to a code block spec. */
export function withMermaidPreview(spec: CodeBlockSpec): CodeBlockSpec {
  const baseRender = spec.implementation.render;

  return {
    ...spec,
    implementation: {
      ...spec.implementation,
      render(block, editor) {
        let base: ReturnType<typeof baseRender>;
        try {
          base = baseRender.call(this, block, editor);
        } catch {
          // The language picker throws for a language outside the supported list (e.g. code pasted
          // in with an unusual language tag). Show it as plain text rather than breaking the page.
          base = baseRender.call(this, { ...block, props: { ...block.props, language: "text" } }, editor);
        }
        if (block.props.language !== "mermaid" || !base.contentDOM) return base;

        const wrapper = document.createElement("div");
        wrapper.className = "cram-mermaid-block";
        wrapper.append(base.dom);

        // Everything below is UI around the editable source, not document content.
        const preview = document.createElement("div");
        preview.className = "cram-mermaid-preview";
        preview.contentEditable = "false";

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "cram-mermaid-toggle";
        const diagram = document.createElement("div");
        diagram.className = "cram-mermaid";
        preview.append(toggle, diagram);
        wrapper.append(preview);

        // The editor fills the code element after render, so read the code from the block itself.
        const code = blockText(block.content);
        const id = block.id;

        // Diagram only by default; code shown for empty blocks. The choice sticks across re-renders.
        const applyToggle = () => {
          const showCode = codeShown.get(id) ?? !code.trim();
          wrapper.classList.toggle("is-collapsed", !showCode);
          toggle.textContent = showCode ? "Hide code" : "Show code";
        };
        toggle.addEventListener("mousedown", (e) => e.preventDefault()); // keep editor focus/selection
        toggle.addEventListener("click", () => {
          codeShown.set(id, !(codeShown.get(id) ?? !blockText(block.content).trim()));
          applyToggle();
        });
        applyToggle();

        // Show the last drawing straight away (no flicker), then redraw if the code changed.
        latestTarget.set(id, diagram);
        const previous = lastDrawn.get(id);
        if (previous) diagram.replaceChildren(...previous.map((n) => n.cloneNode(true)));
        else diagram.replaceChildren(hint("Drawing diagram…"));
        const cached = svgCache.has(`${currentTheme()}\n${code.trim()}`);
        scheduleDraw(id, code, !previous || cached);

        // Edits don't always rebuild the block, so also redraw when its code text changes.
        const source = base.contentDOM;
        const observer = new MutationObserver(() => scheduleDraw(id, source.textContent ?? "", false));
        observer.observe(source, { characterData: true, childList: true, subtree: true });

        return {
          ...base,
          dom: wrapper,
          // Clicks in the diagram/toggle must not be treated as edits by the editor.
          ignoreMutation: (m: MutationRecord | { type: "selection"; target: Node }) =>
            preview.contains(m.target),
          destroy: () => {
            observer.disconnect();
            if (latestTarget.get(id) === diagram) latestTarget.delete(id);
            base.destroy?.();
          },
        };
      },
    },
  };
}
