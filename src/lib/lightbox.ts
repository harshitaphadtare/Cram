/**
 * Notion-style zoom view for diagrams and images: the content opens over a dimmed backdrop, fitted
 * to the screen, and can be zoomed (wheel / pinch / buttons) and dragged around. Esc, the close
 * button or a click on the backdrop closes it. Plain DOM so it works from BlockNote's own DOM
 * (Mermaid previews, image blocks) as well as from React.
 */

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;

const ICONS = {
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  fit: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
};

function iconButton(name: keyof typeof ICONS, label: string) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cram-lightbox-button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  return button;
}

/** Natural size of what's being shown, used to fit it to the screen. */
function naturalSize(source: SVGSVGElement | HTMLImageElement) {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth || source.width, height: source.naturalHeight || source.height };
  }
  const box = source.viewBox?.baseVal;
  if (box && box.width && box.height) return { width: box.width, height: box.height };
  const rect = source.getBoundingClientRect();
  return { width: rect.width || 800, height: rect.height || 600 };
}

let open = false;

export function openLightbox(source: SVGSVGElement | HTMLImageElement, label = "Diagram") {
  if (open) return;
  open = true;
  const previousFocus = document.activeElement as HTMLElement | null;

  const overlay = document.createElement("div");
  overlay.className = "cram-lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", `${label} (zoomed)`);

  const stage = document.createElement("div");
  stage.className = "cram-lightbox-stage";

  // A copy, so the page's own diagram/image is untouched.
  const content = source.cloneNode(true) as SVGSVGElement | HTMLImageElement;
  content.removeAttribute("style");
  content.removeAttribute("width");
  content.removeAttribute("height");
  content.classList.add("cram-lightbox-content");
  // Mermaid ids are referenced by the SVG's own <style>; the clone keeps them, which is fine as
  // the original's styles are identical.
  stage.append(content);

  const toolbar = document.createElement("div");
  toolbar.className = "cram-lightbox-toolbar";
  const zoomOut = iconButton("minus", "Zoom out");
  const zoomLabel = document.createElement("span");
  zoomLabel.className = "cram-lightbox-zoom";
  const zoomIn = iconButton("plus", "Zoom in");
  const fitButton = iconButton("fit", "Fit to screen");
  const closeButton = iconButton("close", "Close");
  toolbar.append(zoomOut, zoomLabel, zoomIn, fitButton, closeButton);

  overlay.append(stage, toolbar);
  document.body.append(overlay);
  document.documentElement.style.overflow = "hidden";

  const natural = naturalSize(source);
  let fitScale = 1;
  let scale = 1;
  let x = 0;
  let y = 0;

  const apply = () => {
    content.style.width = `${natural.width}px`;
    content.style.height = `${natural.height}px`;
    content.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    zoomLabel.textContent = `${Math.round((scale / fitScale) * 100)}%`;
  };

  const fit = () => {
    const pad = window.innerWidth < 640 ? 16 : 64;
    fitScale = Math.min(
      (window.innerWidth - pad * 2) / natural.width,
      (window.innerHeight - pad * 2 - 56) / natural.height,
      // Small images aren't blown up past 2× their size.
      source instanceof HTMLImageElement ? 2 : 3,
    );
    scale = fitScale;
    x = 0;
    y = 0;
    apply();
  };

  /** Zoom by `factor`, keeping the point under (cx, cy) still. */
  const zoomAt = (factor: number, cx = window.innerWidth / 2, cy = window.innerHeight / 2) => {
    const next = Math.min(Math.max(scale * factor, fitScale * MIN_ZOOM), fitScale * MAX_ZOOM);
    const ratio = next / scale;
    const ox = cx - window.innerWidth / 2;
    const oy = cy - window.innerHeight / 2;
    x = ox - (ox - x) * ratio;
    y = oy - (oy - y) * ratio;
    scale = next;
    apply();
  };

  // Drag to pan; pinch (two pointers) to zoom.
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0;
  let moved = false;
  stage.addEventListener("pointerdown", (e) => {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  stage.addEventListener("pointermove", (e) => {
    const last = pointers.get(e.pointerId);
    if (!last) return;
    const current = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, current);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance) zoomAt(distance / pinchDistance, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinchDistance = distance;
    } else {
      x += current.x - last.x;
      y += current.y - last.y;
      if (Math.abs(current.x - last.x) + Math.abs(current.y - last.y) > 1) moved = true;
      apply();
    }
    stage.classList.add("is-dragging");
  });
  const endPointer = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDistance = 0;
    if (pointers.size === 0) stage.classList.remove("is-dragging");
  };
  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);

  stage.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      // Trackpad pinch arrives as ctrl+wheel with small deltas; a mouse wheel as larger steps.
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
      zoomAt(factor, e.clientX, e.clientY);
    },
    { passive: false },
  );
  stage.addEventListener("dblclick", (e) => {
    if (e.target === content || content.contains(e.target as Node)) zoomAt(2, e.clientX, e.clientY);
  });

  // Clicking the backdrop (not the content, and not at the end of a drag) closes.
  stage.addEventListener("click", (e) => {
    if (!moved && !content.contains(e.target as Node)) close();
  });

  zoomIn.addEventListener("click", () => zoomAt(1.25));
  zoomOut.addEventListener("click", () => zoomAt(0.8));
  fitButton.addEventListener("click", fit);
  closeButton.addEventListener("click", () => close());

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (e.key === "+" || e.key === "=") zoomAt(1.25);
    else if (e.key === "-") zoomAt(0.8);
    else if (e.key === "0") fit();
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", fit);

  function close() {
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", fit);
    overlay.classList.add("is-closing");
    document.documentElement.style.overflow = "";
    setTimeout(() => {
      overlay.remove();
      open = false;
      previousFocus?.focus?.();
    }, 140);
  }

  fit();
  closeButton.focus();
}
