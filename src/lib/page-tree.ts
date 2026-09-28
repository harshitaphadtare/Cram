/**
 * Helpers for Notion-style nested pages. Pages are stored flat (each with an optional parentId)
 * and turned into a tree where they're shown. Pages whose parent is missing (e.g. not loaded) are
 * treated as top-level so nothing ever disappears.
 */

export interface TreePageInput {
  id: string;
  parentId: string | null;
}

export interface PageNode<T extends TreePageInput> {
  page: T;
  depth: number;
  children: PageNode<T>[];
}

/** Top-level nodes, each with nested children, preserving the input order among siblings. */
export function buildPageTree<T extends TreePageInput>(pages: T[]): PageNode<T>[] {
  const ids = new Set(pages.map((p) => p.id));
  const byParent = new Map<string | null, T[]>();
  for (const page of pages) {
    const parent = page.parentId && ids.has(page.parentId) ? page.parentId : null;
    const list = byParent.get(parent) ?? [];
    list.push(page);
    byParent.set(parent, list);
  }
  const seen = new Set<string>();
  const build = (parent: string | null, depth: number): PageNode<T>[] =>
    (byParent.get(parent) ?? [])
      .filter((p) => !seen.has(p.id) && seen.add(p.id))
      .map((page) => ({ page, depth, children: build(page.id, depth + 1) }));
  return build(null, 0);
}

/** Every node in reading order (parent, then its sub-pages), with its depth. */
export function flattenPageTree<T extends TreePageInput>(nodes: PageNode<T>[]): PageNode<T>[] {
  return nodes.flatMap((n) => [n, ...flattenPageTree(n.children)]);
}

/** The page's ancestors, outermost first (not including the page itself). */
export function pageAncestors<T extends TreePageInput>(pageId: string, pages: T[]): T[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const chain: T[] = [];
  let current = byId.get(pageId)?.parentId ?? null;
  while (current && byId.has(current) && chain.length < 64) {
    const page = byId.get(current)!;
    chain.unshift(page);
    current = page.parentId;
  }
  return chain;
}

/** Ids of every page nested under `pageId` (not including it). */
export function pageDescendantIds<T extends TreePageInput>(pageId: string, pages: T[]): string[] {
  const out: string[] = [];
  const walk = (id: string) => {
    for (const p of pages) {
      if (p.parentId === id && !out.includes(p.id)) {
        out.push(p.id);
        walk(p.id);
      }
    }
  };
  walk(pageId);
  return out;
}
