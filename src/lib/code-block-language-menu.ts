/**
 * Notion-style language picker for code blocks: a small label button that opens a searchable list
 * (type to filter, ↑/↓ to move, Enter to pick, Esc to close). Replaces BlockNote's native
 * <select>, which can't be styled. Plain DOM because code blocks are rendered outside React.
 */

export type LanguageList = Record<string, { name: string; aliases?: readonly string[] }>;

const CHEVRON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const CHECK =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

/** Only one menu is open at a time across the page. */
let closeOpenMenu: (() => void) | null = null;

export function createLanguageButton(options: {
  languages: LanguageList;
  current: string;
  editable: boolean;
  onPick: (language: string) => void;
}): { button: HTMLButtonElement; destroy: () => void } {
  const { languages, current, editable, onPick } = options;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cram-lang-button";
  button.disabled = !editable;
  button.setAttribute("aria-haspopup", "listbox");
  button.innerHTML = `<span></span>${CHEVRON}`;
  button.firstElementChild!.textContent = languages[current]?.name ?? current;

  let close: (() => void) | null = null;

  // Keep the editor's selection where it is when the button is pressed.
  button.addEventListener("mousedown", (e) => e.preventDefault());
  button.addEventListener("click", () => {
    if (close) return close();
    close = openMenu(button, languages, current, (lang) => {
      if (lang !== current) onPick(lang);
    }, () => {
      close = null;
      button.setAttribute("aria-expanded", "false");
    });
    button.setAttribute("aria-expanded", "true");
  });

  return { button, destroy: () => close?.() };
}

function openMenu(
  anchor: HTMLElement,
  languages: LanguageList,
  current: string,
  onPick: (language: string) => void,
  onClose: () => void,
): () => void {
  closeOpenMenu?.();

  const entries = Object.entries(languages).map(([id, l]) => ({
    id,
    name: l.name,
    haystack: [id, l.name, ...(l.aliases ?? [])].join(" ").toLowerCase(),
  }));

  const menu = document.createElement("div");
  menu.className = "cram-lang-menu";
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", "Code language");

  const search = document.createElement("input");
  search.className = "cram-lang-search";
  search.placeholder = "Search for a language…";
  search.setAttribute("aria-label", "Search languages");
  search.autocomplete = "off";
  search.spellcheck = false;

  const list = document.createElement("div");
  list.className = "cram-lang-list";
  list.setAttribute("role", "listbox");

  const empty = document.createElement("p");
  empty.className = "cram-lang-empty";
  empty.textContent = "No matching language";

  menu.append(search, list);
  document.body.append(menu);

  let shown = entries;
  let active = Math.max(0, entries.findIndex((e) => e.id === current));

  const render = () => {
    list.replaceChildren();
    if (shown.length === 0) return list.append(empty);
    shown.forEach((entry, i) => {
      const item = document.createElement("div");
      item.className = "cram-lang-item";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(entry.id === current));
      if (i === active) item.dataset.active = "true";
      const label = document.createElement("span");
      label.textContent = entry.name;
      item.append(label);
      if (entry.id === current) item.insertAdjacentHTML("beforeend", CHECK);
      item.addEventListener("mousemove", () => {
        if (active === i) return;
        active = i;
        highlight(false);
      });
      item.addEventListener("mousedown", (e) => e.preventDefault());
      item.addEventListener("click", () => pick(entry.id));
      list.append(item);
    });
  };

  const highlight = (scroll: boolean) => {
    [...list.children].forEach((el, i) => {
      if (i === active) (el as HTMLElement).dataset.active = "true";
      else delete (el as HTMLElement).dataset.active;
    });
    if (scroll) list.children[active]?.scrollIntoView({ block: "nearest" });
  };

  const place = () => {
    const rect = anchor.getBoundingClientRect();
    const height = menu.offsetHeight;
    const below = window.innerHeight - rect.bottom;
    const top = below >= height + 12 || below > rect.top ? rect.bottom + 6 : rect.top - height - 6;
    menu.style.top = `${Math.max(8, top)}px`;
    menu.style.left = `${Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8)}px`;
  };

  function pick(id: string) {
    close();
    onPick(id);
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (shown.length === 0) return;
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
      highlight(true);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (shown[active]) pick(shown[active].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };
  const onInput = () => {
    const q = search.value.trim().toLowerCase();
    shown = q ? entries.filter((e) => e.haystack.includes(q)) : entries;
    active = 0;
    render();
    list.scrollTop = 0;
  };
  const onOutside = (e: PointerEvent) => {
    if (!menu.contains(e.target as Node) && !anchor.contains(e.target as Node)) close();
  };
  // Scrolling the page moves the anchor — follow it rather than leave the menu floating.
  const onScroll = (e: Event) => {
    if (!menu.contains(e.target as Node)) place();
  };

  search.addEventListener("keydown", onKey);
  search.addEventListener("input", onInput);
  document.addEventListener("pointerdown", onOutside, true);
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", place);

  render();
  place();
  highlight(true);
  search.focus();

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener("pointerdown", onOutside, true);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", place);
    menu.remove();
    if (closeOpenMenu === close) closeOpenMenu = null;
    onClose();
  }
  closeOpenMenu = close;
  return close;
}
