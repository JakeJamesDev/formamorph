// Pure helpers for the location sub-location tree. Unlike traits (a separate `traitGroups` entity), a
// location IS the group: nesting lives on `GameLocation.parentId`, and any location can parent any other.
// Sibling order is the `locations` array order (no separate `order` field). The editor builds/walks the
// tree from the single flat array; a drag rewrites the array so its order encodes the new tree.

import { arrayMove } from '@dnd-kit/sortable';
import { clamp } from "@/lib/utils";
import type { GameLocation } from '@/types';

export interface LocationTreeNode {
  id: string;
  location: GameLocation;
  children: LocationTreeNode[];
}

/** Direct children of `parentId`, in `locations` array order. */
function childrenOf(locations: GameLocation[], parentId: string | null): GameLocation[] {
  return locations.filter((l) => (l.parentId ?? null) === parentId);
}

/** Build the full nested tree of top-level nodes, each carrying its recursive children. */
export function buildLocationTree(locations: GameLocation[]): LocationTreeNode[] {
  const build = (parentId: string | null): LocationTreeNode[] =>
    childrenOf(locations, parentId).map((l) => ({ id: l.id, location: l, children: build(l.id) }));
  return build(null);
}

export interface FlatLocationNode {
  id: string;
  parentId: string | null;
  depth: number;
  location: GameLocation;
}

/** Depth-first flatten, tagging each node with its parent and indentation depth. */
export function flattenLocationTree(tree: LocationTreeNode[]): FlatLocationNode[] {
  const out: FlatLocationNode[] = [];
  const walk = (nodes: LocationTreeNode[], parentId: string | null, depth: number) => {
    for (const node of nodes) {
      out.push({ id: node.id, parentId, depth, location: node.location });
      walk(node.children, node.id, depth + 1);
    }
  };
  walk(tree, null, 0);
  return out;
}

/** Drop every node that descends from any id in `ids` (collapsed nodes, the dragged subtree). */
export function removeCollapsedChildren(items: FlatLocationNode[], ids: Iterable<string>): FlatLocationNode[] {
  const exclude = new Set(ids);
  const out: FlatLocationNode[] = [];
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
export function isDescendantLocation(locations: GameLocation[], ancestorId: string, candidateId: string): boolean {
  const byId = new Map(locations.map((l) => [l.id, l]));
  let cur: string | null | undefined = candidateId;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = byId.get(cur)?.parentId ?? null;
  }
  return false;
}

/** Remove a location, promoting its direct children up to the removed node's own parent (nothing lost). */
export function removeLocationPromotingChildren(locations: GameLocation[], id: string): GameLocation[] {
  const target = locations.find((l) => l.id === id);
  if (!target) return locations;
  const newParent = target.parentId ?? null;
  return locations
    .filter((l) => l.id !== id)
    .map((l) => ((l.parentId ?? null) === id ? { ...l, parentId: newParent } : l));
}

/** Projected drop `{depth, parentId}` for the active row, given the pointer's horizontal drag offset. */
export function getLocationDropProjection(
  items: FlatLocationNode[], activeId: string, overId: string,
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
  // Any location can be a parent, so a row may descend one level past the row above it.
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
 * Resolve a drag into a new `locations` array: project the drop parent from `dragOffset` (using the visible
 * list minus the dragged subtree), re-parent the active node, then rebuild the array in depth-first tree
 * order so array order encodes sibling order. Cyclic moves (into itself/a descendant) and unfound ids are
 * no-ops. Never mutates inputs.
 */
export function applyLocationDrop(
  locations: GameLocation[], collapsedIds: Iterable<string>,
  activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): GameLocation[] {
  const full = flattenLocationTree(buildLocationTree(locations));
  const visible = removeCollapsedChildren(full, [...collapsedIds, activeId]);
  if (!visible.some((i) => i.id === overId) || !visible.some((i) => i.id === activeId)) return locations;

  const { parentId } = getLocationDropProjection(visible, activeId, overId, dragOffset, indentationWidth);
  if (parentId !== null && isDescendantLocation(locations, activeId, parentId)) return locations;

  const activeIndex = full.findIndex((i) => i.id === activeId);
  const overIndex = full.findIndex((i) => i.id === overId);
  if (activeIndex === -1 || overIndex === -1) return locations;

  const reParented = full.map((i) => (i.id === activeId ? { ...i, parentId } : i));
  const sorted = arrayMove(reParented, activeIndex, overIndex);

  // Apply new parentId to shallow-cloned locations and capture each node's sibling order from `sorted`.
  const byId = new Map(locations.map((l) => [l.id, { ...l }]));
  const orderByParent = new Map<string, number>();
  const orderOf = new Map<string, number>();
  for (const item of sorted) {
    const key = item.parentId ?? '\0root';
    const order = orderByParent.get(key) ?? 0;
    orderByParent.set(key, order + 1);
    orderOf.set(item.id, order);
    const loc = byId.get(item.id);
    if (loc) loc.parentId = item.parentId;
  }

  // Rebuild the array depth-first (siblings by captured order) so array position reflects the tree.
  const result: GameLocation[] = [];
  const walk = (parent: string | null) => {
    [...byId.values()]
      .filter((l) => (l.parentId ?? null) === parent)
      .sort((a, b) => (orderOf.get(a.id) ?? 0) - (orderOf.get(b.id) ?? 0))
      .forEach((l) => { result.push(l); walk(l.id); });
  };
  walk(null);
  return result;
}
