// Generic pure helpers for a flat `{ id, parentId }[]` that encodes a tree: sibling order is the array
// order (no separate `order` field), and a drag rewrites the array so its order carries the new tree. The
// entity-grouping tree uses these; locations have their own equivalent (`locationTree.ts`) and could migrate
// here later. Any node can parent any other; cyclic moves are rejected.

/** Anything with a stable id and an optional parent id. */
export interface TreeItem {
  id: string;
  parentId?: string | null;
}

export interface TreeNode<T extends TreeItem> {
  id: string;
  item: T;
  children: TreeNode<T>[];
}

export interface FlatTreeNode<T extends TreeItem> {
  id: string;
  parentId: string | null;
  depth: number;
  item: T;
}

/** Direct children of `parentId`, in array order. */
function childrenOf<T extends TreeItem>(items: T[], parentId: string | null): T[] {
  return items.filter((i) => (i.parentId ?? null) === parentId);
}

/** Build the full nested tree of top-level nodes, each carrying its recursive children. */
export function buildTree<T extends TreeItem>(items: T[]): TreeNode<T>[] {
  const build = (parentId: string | null): TreeNode<T>[] =>
    childrenOf(items, parentId).map((i) => ({ id: i.id, item: i, children: build(i.id) }));
  return build(null);
}

/** Depth-first flatten, tagging each node with its parent and indentation depth. */
export function flattenTree<T extends TreeItem>(tree: TreeNode<T>[]): FlatTreeNode<T>[] {
  const out: FlatTreeNode<T>[] = [];
  const walk = (nodes: TreeNode<T>[], parentId: string | null, depth: number) => {
    for (const node of nodes) {
      out.push({ id: node.id, parentId, depth, item: node.item });
      walk(node.children, node.id, depth + 1);
    }
  };
  walk(tree, null, 0);
  return out;
}

/** Drop every node that descends from any id in `ids` (collapsed nodes, the dragged subtree). */
export function removeCollapsedChildren<T extends TreeItem>(
  items: FlatTreeNode<T>[],
  ids: Iterable<string>,
): FlatTreeNode<T>[] {
  const exclude = new Set(ids);
  const out: FlatTreeNode<T>[] = [];
  for (const item of items) {
    if (item.parentId !== null && exclude.has(item.parentId)) {
      exclude.add(item.id);
      continue;
    }
    out.push(item);
  }
  return out;
}

/** True if `candidateId` is `ancestorId` itself or nested beneath it — guards illegal (cyclic) moves. */
export function isDescendant<T extends TreeItem>(items: T[], ancestorId: string, candidateId: string): boolean {
  const byId = new Map(items.map((i) => [i.id, i]));
  let cur: string | null | undefined = candidateId;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = byId.get(cur)?.parentId ?? null;
  }
  return false;
}

/** Remove an item, promoting its direct children up to the removed node's own parent (nothing lost). */
export function removePromotingChildren<T extends TreeItem>(items: T[], id: string): T[] {
  const target = items.find((i) => i.id === id);
  if (!target) return items;
  const newParent = target.parentId ?? null;
  return items
    .filter((i) => i.id !== id)
    .map((i) => ((i.parentId ?? null) === id ? { ...i, parentId: newParent } : i));
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** Projected drop `{ depth, parentId }` for the active row, given the pointer's horizontal drag offset. */
export function getDropProjection<T extends TreeItem>(
  items: FlatTreeNode<T>[], activeId: string, overId: string,
  dragOffset: number, indentationWidth: number,
): { depth: number; parentId: string | null } {
  const overIndex = items.findIndex((i) => i.id === overId);
  const activeIndex = items.findIndex((i) => i.id === activeId);
  if (overIndex === -1 || activeIndex === -1) return { depth: 0, parentId: null };

  const activeItem = items[activeIndex];
  const newItems = arrayMove(items, activeIndex, overIndex);
  const prev = newItems[overIndex - 1];
  const next = newItems[overIndex + 1];

  const dragDepth = Math.round(dragOffset / indentationWidth);
  const projectedDepth = activeItem.depth + dragDepth;
  // Any node can be a parent, so a row may descend one level past the row above it.
  const maxDepth = prev ? prev.depth + 1 : 0;
  const minDepth = next ? next.depth : 0;
  const depth = clamp(projectedDepth, minDepth, maxDepth);

  const parentId = (() => {
    if (depth === 0 || !prev) return null;
    if (depth === prev.depth) return prev.parentId;
    if (depth > prev.depth) return prev.id;
    return newItems.slice(0, overIndex).reverse().find((i) => i.depth === depth)?.parentId ?? null;
  })();

  return { depth, parentId };
}

/**
 * Resolve a drag into a new items array: project the drop parent from `dragOffset` (using the visible list
 * minus the dragged subtree), re-parent the active node, then rebuild the array in depth-first tree order so
 * array order encodes sibling order. Cyclic moves (into itself/a descendant) and unfound ids are no-ops.
 * Never mutates inputs.
 */
export function applyDrop<T extends TreeItem>(
  items: T[], collapsedIds: Iterable<string>,
  activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): T[] {
  const full = flattenTree(buildTree(items));
  const visible = removeCollapsedChildren(full, [...collapsedIds, activeId]);
  if (!visible.some((i) => i.id === overId) || !visible.some((i) => i.id === activeId)) return items;

  const { parentId } = getDropProjection(visible, activeId, overId, dragOffset, indentationWidth);
  if (parentId !== null && isDescendant(items, activeId, parentId)) return items;

  const activeIndex = full.findIndex((i) => i.id === activeId);
  const overIndex = full.findIndex((i) => i.id === overId);
  if (activeIndex === -1 || overIndex === -1) return items;

  const reParented = full.map((i) => (i.id === activeId ? { ...i, parentId } : i));
  const sorted = arrayMove(reParented, activeIndex, overIndex);

  // Apply new parentId to shallow-cloned items and capture each node's sibling order from `sorted`.
  const byId = new Map(items.map((i) => [i.id, { ...i }]));
  const orderByParent = new Map<string, number>();
  const orderOf = new Map<string, number>();
  for (const node of sorted) {
    const key = node.parentId ?? '\0root';
    const order = orderByParent.get(key) ?? 0;
    orderByParent.set(key, order + 1);
    orderOf.set(node.id, order);
    const item = byId.get(node.id);
    if (item) item.parentId = node.parentId;
  }

  // Rebuild the array depth-first (siblings by captured order) so array position reflects the tree.
  const result: T[] = [];
  const walk = (parent: string | null) => {
    [...byId.values()]
      .filter((i) => (i.parentId ?? null) === parent)
      .sort((a, b) => (orderOf.get(a.id) ?? 0) - (orderOf.get(b.id) ?? 0))
      .forEach((i) => { result.push(i); walk(i.id); });
  };
  walk(null);
  return result;
}
