/**
 * In-app tabs (Notion-style): a tiny external store consumed with useSyncExternalStore.
 * Each tab just remembers the URL it's showing; the router does the actual navigation.
 * Persisted to localStorage so tabs survive reloads — per browser, which is what you'd expect.
 */

export interface AppTab {
  id: string;
  href: string;
}

export interface TabsState {
  tabs: AppTab[];
  activeId: string | null;
}

const STORAGE_KEY = "cram.tabs";
const EMPTY: TabsState = { tabs: [], activeId: null };

let state: TabsState | null = null;
const listeners = new Set<() => void>();

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function load(): TabsState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as TabsState;
    if (!Array.isArray(parsed.tabs)) return EMPTY;
    const tabs = parsed.tabs.filter(
      (t) => typeof t?.id === "string" && typeof t?.href === "string" && t.href.startsWith("/app"),
    );
    const activeId = tabs.some((t) => t.id === parsed.activeId) ? parsed.activeId : (tabs[0]?.id ?? null);
    return { tabs, activeId };
  } catch {
    return EMPTY;
  }
}

function set(next: TabsState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode etc.) — tabs just won't persist.
  }
  listeners.forEach((l) => l());
}

function current(): TabsState {
  if (state === null) state = load();
  return state;
}

export const tabsStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: current,
  getServerSnapshot: () => EMPTY,

  /** Keep the active tab pointed at wherever the router currently is. */
  syncActive(href: string) {
    const s = current();
    const active = s.tabs.find((t) => t.id === s.activeId);
    if (!active) {
      const tab = { id: newId(), href };
      set({ tabs: [...s.tabs, tab], activeId: tab.id });
    } else if (active.href !== href) {
      set({ ...s, tabs: s.tabs.map((t) => (t.id === active.id ? { ...t, href } : t)) });
    }
  },

  /** Adds a tab right after the active one. Returns it so the caller can navigate if focusing. */
  open(href: string, focus: boolean): AppTab {
    const s = current();
    const tab = { id: newId(), href };
    const at = s.tabs.findIndex((t) => t.id === s.activeId);
    const tabs = [...s.tabs];
    tabs.splice(at + 1, 0, tab);
    set({ tabs, activeId: focus ? tab.id : s.activeId });
    return tab;
  },

  activate(id: string): AppTab | undefined {
    const s = current();
    const tab = s.tabs.find((t) => t.id === id);
    if (tab) set({ ...s, activeId: id });
    return tab;
  },

  /** Closes a tab. If it was active, returns the neighbour that becomes active (to navigate to). */
  close(id: string): AppTab | undefined {
    const s = current();
    if (s.tabs.length <= 1) return undefined;
    const index = s.tabs.findIndex((t) => t.id === id);
    if (index === -1) return undefined;
    const tabs = s.tabs.filter((t) => t.id !== id);
    if (s.activeId !== id) {
      set({ ...s, tabs });
      return undefined;
    }
    const next = tabs[Math.min(index, tabs.length - 1)];
    set({ tabs, activeId: next.id });
    return next;
  },
};
