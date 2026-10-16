// Pure helpers for the location sub-location tree. Unlike traits (a separate `traitGroups` entity), a
// location IS the group: nesting lives on `GameLocation.parentId`, and any location can parent any other.
// Sibling order is the `locations` array order (no separate `order` field). The editor builds/walks the
// tree from the single flat array; a drag rewrites the array so its order encodes the new tree.

import { ancestors, parentLookup } from "@/lib/ancestors";
import { effectiveDestinations } from "@/lib/locationGraph";
import { anyRowCanParent, knownParent, planTreeDrop, projectDrop, removeCollapsedRows } from "@/lib/treeProjection";
import type { Connection, GameLocation } from '@/types';

export interface LocationTreeNode {
  id: string;
  location: GameLocation;
  children: LocationTreeNode[];
}

/** The box a location actually sits in. A parent id pointing at a location that isn't here holds nothing, so
 *  it reads as no parent at all — otherwise the location it names would be nowhere in the tree at all. */
export function holderOf(locations: GameLocation[], location: GameLocation): string | null {
  return knownParent(location.parentId, { has: (id) => locations.some((l) => l.id === id) });
}

/** Build the full nested tree of top-level nodes, each carrying its recursive children. Every location is
 *  filed under its parent in one pass, so a deep world costs one walk rather than one per level. */
export function buildLocationTree(locations: GameLocation[]): LocationTreeNode[] {
  const known = new Set(locations.map((l) => l.id));
  const childrenOf = new Map<string | null, GameLocation[]>();
  for (const location of locations) {
    const parent = knownParent(location.parentId, known);
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), location]);
  }
  const build = (parentId: string | null): LocationTreeNode[] =>
    (childrenOf.get(parentId) ?? []).map((l) => ({ id: l.id, location: l, children: build(l.id) }));
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

/** The whole tree as the rows a list draws: depth-first, each tagged with its indentation depth. */
export function locationRows(locations: GameLocation[]): FlatLocationNode[] {
  return flattenLocationTree(buildLocationTree(locations));
}

/** Drop every node that descends from any id in `ids` (collapsed nodes, the dragged subtree). */
export function removeCollapsedChildren(items: FlatLocationNode[], ids: Iterable<string>): FlatLocationNode[] {
  return removeCollapsedRows(items, ids);
}

/** True if `candidateId` is `ancestorId` itself or nested beneath it — guards illegal (cyclic) moves. */
export function isDescendantLocation(locations: GameLocation[], ancestorId: string, candidateId: string): boolean {
  return candidateId === ancestorId
    || ancestors(candidateId, parentLookup(locations, (l) => l.parentId)).includes(ancestorId);
}

/** Remove a location. Its direct children move up to its parent, into the slot it held: sibling order is the
 *  array order, so they take its place in the array. */
export function removeLocationPromotingChildren(locations: GameLocation[], id: string): GameLocation[] {
  const target = locations.find((l) => l.id === id);
  if (!target) return locations;
  const newParent = target.parentId ?? null;
  const children = locations.filter((l) => l.id !== id && (l.parentId ?? null) === id);
  const promoted = children.map((l) => ({ ...l, parentId: newParent }));
  const kids = new Set(children.map((l) => l.id));
  return locations.flatMap((l) => (l.id === id ? promoted : kids.has(l.id) ? [] : [l]));
}

/** Projected drop `{depth, parentId}` for the active row. Any location can take children. */
export function getLocationDropProjection(
  items: FlatLocationNode[], activeId: string, overId: string,
  dragOffset: number, indentationWidth: number,
): { depth: number; parentId: string | null } {
  return projectDrop(items, activeId, overId, dragOffset, indentationWidth, anyRowCanParent);
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
  const plan = planTreeDrop(locationRows(locations), collapsedIds, activeId, overId, dragOffset, indentationWidth, {
    canParent: anyRowCanParent,
    refuses: (active, parent) => parent !== null && isDescendantLocation(locations, active.id, parent.id),
  });
  if (!plan) return locations;

  // Apply new parentId to shallow-cloned locations and capture each node's sibling order from the move.
  const byId = new Map(locations.map((l) => [l.id, { ...l }]));
  const orderByParent = new Map<string, number>();
  const orderOf = new Map<string, number>();
  for (const item of plan.moved) {
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

/**
 * Which parents a travel list opens closed: every location holding sublocations whose subtree holds neither
 * the player nor anywhere they can reach in one hop. What stays open is the chain of places holding the
 * player plus the ancestry of every effective destination, so a well-wired world opens on its likely trips.
 * A player standing nowhere collapses nothing.
 */
export function defaultCollapsedLocations(
  locations: GameLocation[], connections: Connection[], currentLocationId: string | null,
): Set<string> {
  if (!currentLocationId) return new Set();

  const byId = new Map(locations.map((l) => [l.id, l]));
  const parents = new Set(locations.map((l) => holderOf(locations, l)).filter((id): id is string => id !== null));

  const keep = new Set<string>([currentLocationId, ...effectiveDestinations(currentLocationId, locations, connections).keys()]);
  const parentIdOf = (id: string) => {
    const loc = byId.get(id);
    return loc ? holderOf(locations, loc) : null;
  };
  const expanded = new Set<string>();
  for (const id of keep) {
    expanded.add(id);
    for (const above of ancestors(id, parentIdOf)) expanded.add(above);
  }
  return new Set([...parents].filter((id) => !expanded.has(id)));
}
