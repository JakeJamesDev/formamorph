// Generic folder-tree machinery shared by the editor's Traits and Entities tabs (see traitTree.ts /
// entityGroupTree.ts, which bind these to their own types). A tree is two flat arrays: groups (nestable via
// `parentId`) and leaves (each in a group via `groupId`), with sibling order on `order`. Everything here is
// pure and never mutates its inputs. The dnd-kit "sortable tree" recipe drives drag: one flat list where the
// horizontal pointer offset during a drag decides drop depth (and thus parent); leaves can't be parents.

import { arrayMove } from '@dnd-kit/sortable';
import { randomUUID } from "@/lib/uuid";
import { clamp } from "@/lib/utils";
import { remintPlaceholdersDeep } from "@/lib/placeholders";

/** A nestable folder. `parentId` null = top-level. */
export interface TreeGroup { id: string; name: string; parentId: string | null; order?: number }
/** A leaf living in a group via `groupId` (null/absent = ungrouped). */
export interface TreeLeaf { id: string; name: string; groupId?: string | null; order?: number }

export type GroupTreeNode<G extends TreeGroup, L extends TreeLeaf> =
  | { kind: 'group'; id: string; group: G; children: GroupTreeNode<G, L>[] }
  | { kind: 'leaf'; id: string; leaf: L };

export interface FlatTreeNode<G extends TreeGroup, L extends TreeLeaf> {
  id: string;
  kind: 'group' | 'leaf';
  parentId: string | null;
  depth: number;
  group?: G;
  leaf?: L;
}

/**
 * Effective parent of a raw `parentId`/`groupId`: null (top-level) if the reference is null/absent OR points
 * at a group id that doesn't exist. Orphan-referenced items surface at the root rather than vanishing — a
 * dangling reference (missing `entityGroups`, deleted group) must never make an item unreachable.
 */
function effectiveParent(ref: string | null | undefined, knownGroupIds: ReadonlySet<string>): string | null {
  return ref != null && knownGroupIds.has(ref) ? ref : null;
}

/** Direct children (subgroups + leaves) of `parentId`, ordered by `order` (falling back to array index). */
function childrenOf<G extends TreeGroup, L extends TreeLeaf>(
  groups: readonly G[], leaves: readonly L[], parentId: string | null, knownGroupIds: ReadonlySet<string>,
): GroupTreeNode<G, L>[] {
  const entries: { node: GroupTreeNode<G, L>; sort: number }[] = [];
  groups.forEach((g, i) => {
    if (effectiveParent(g.parentId, knownGroupIds) === parentId) {
      entries.push({ node: { kind: 'group', id: g.id, group: g, children: [] }, sort: g.order ?? i });
    }
  });
  leaves.forEach((l, i) => {
    if (effectiveParent(l.groupId, knownGroupIds) === parentId) {
      entries.push({ node: { kind: 'leaf', id: l.id, leaf: l }, sort: l.order ?? i });
    }
  });
  return entries.sort((a, b) => a.sort - b.sort).map((e) => e.node);
}

/** Build the full ordered tree of top-level nodes, each group carrying its recursive children. */
export function buildTree<G extends TreeGroup, L extends TreeLeaf>(groups: readonly G[], leaves: readonly L[]): GroupTreeNode<G, L>[] {
  const knownGroupIds = new Set(groups.map((g) => g.id));
  const build = (parentId: string | null): GroupTreeNode<G, L>[] =>
    childrenOf(groups, leaves, parentId, knownGroupIds).map((node) =>
      node.kind === 'group' ? { ...node, children: build(node.id) } : node,
    );
  return build(null);
}

/** True if `candidateId` is `ancestorId` itself or nested anywhere beneath it — guards illegal moves. */
export function isDescendantGroup<G extends TreeGroup>(groups: G[], ancestorId: string, candidateId: string): boolean {
  const byId = new Map(groups.map((g) => [g.id, g]));
  let cur: string | null | undefined = candidateId;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = byId.get(cur)?.parentId ?? null;
  }
  return false;
}

/**
 * Deep-duplicate a leaf or a whole group subtree, inserting the copy immediately after the original within
 * the same parent/group. Groups bring all nested subgroups + leaves, each with a fresh id and remapped parent
 * links; only the top copied item's name gets a " (Copy)" suffix. Sibling `order`s of the affected parent are
 * renormalized so the copy reliably follows the original. Never mutates inputs; a missing id is a no-op
 * (returns the same arrays + the id unchanged).
 */
export function duplicateNode<G extends TreeGroup, L extends TreeLeaf>(
  groups: G[], leaves: L[], id: string,
): { groups: G[]; leaves: L[]; newId: string } {
  const isGroup = groups.some((g) => g.id === id);
  const isLeaf = leaves.some((l) => l.id === id);
  if (!isGroup && !isLeaf) return { groups, leaves, newId: id };

  // Subtree membership: the group + all descendant groups, and every leaf inside any of them.
  const subtreeGroupIds = new Set<string>();
  if (isGroup) {
    const collect = (gid: string) => {
      subtreeGroupIds.add(gid);
      groups.filter((g) => (g.parentId ?? null) === gid).forEach((c) => collect(c.id));
    };
    collect(id);
  }
  const subtreeLeafIds = isGroup
    ? leaves.filter((l) => l.groupId && subtreeGroupIds.has(l.groupId)).map((l) => l.id)
    : [id];

  const idMap = new Map<string, string>();
  subtreeGroupIds.forEach((gid) => idMap.set(gid, randomUUID()));
  subtreeLeafIds.forEach((lid) => idMap.set(lid, randomUUID()));
  const newId = idMap.get(id)!;
  const rootParent = isGroup
    ? groups.find((g) => g.id === id)!.parentId ?? null
    : leaves.find((l) => l.id === id)!.groupId ?? null;

  // One mint map across the whole subtree: placements the source shared internally stay shared with each
  // other in the copy, but a Unique chip never keeps the source's roll.
  const minted = new Map<string, string>();
  const clonedGroups: G[] = [...subtreeGroupIds].map((gid) => {
    const copy = remintPlaceholdersDeep(structuredClone(groups.find((g) => g.id === gid)!), minted);
    copy.id = idMap.get(gid)!;
    copy.parentId = gid === id ? rootParent : idMap.get(copy.parentId!)!; // root keeps parent; rest remap
    return copy;
  });
  const clonedLeaves: L[] = subtreeLeafIds.map((lid) => {
    const copy = remintPlaceholdersDeep(structuredClone(leaves.find((l) => l.id === lid)!), minted);
    copy.id = idMap.get(lid)!;
    copy.groupId = isGroup ? idMap.get(copy.groupId!)! : rootParent;
    return copy;
  });

  const root = isGroup
    ? clonedGroups.find((g) => g.id === newId)!
    : clonedLeaves.find((l) => l.id === newId)!;
  root.name = `${root.name} (Copy)`;

  // Don't mutate inputs: shallow-copy existing rows, append the clones.
  const g2 = groups.map((g) => ({ ...g })).concat(clonedGroups);
  const l2 = leaves.map((l) => ({ ...l })).concat(clonedLeaves);

  // Place the copy right after the original among its siblings, then renormalize that parent's order
  // (handles worlds whose items have no explicit `order`, where array index would misplace the copy).
  const seq = childrenOf(groups, leaves, rootParent, new Set(groups.map((g) => g.id))).map((n) => n.id);
  seq.splice(seq.indexOf(id) + 1, 0, newId);
  seq.forEach((sid, i) => {
    const g = g2.find((x) => x.id === sid);
    if (g) { g.order = i; return; }
    const l = l2.find((x) => x.id === sid);
    if (l) l.order = i;
  });

  return { groups: g2, leaves: l2, newId };
}

/** Depth-first flatten of the tree, tagging each node with its parent and indentation depth. */
export function flattenTree<G extends TreeGroup, L extends TreeLeaf>(tree: GroupTreeNode<G, L>[]): FlatTreeNode<G, L>[] {
  const out: FlatTreeNode<G, L>[] = [];
  const walk = (nodes: GroupTreeNode<G, L>[], parentId: string | null, depth: number) => {
    for (const node of nodes) {
      if (node.kind === 'group') {
        out.push({ id: node.id, kind: 'group', parentId, depth, group: node.group });
        walk(node.children, node.id, depth + 1);
      } else {
        out.push({ id: node.id, kind: 'leaf', parentId, depth, leaf: node.leaf });
      }
    }
  };
  walk(tree, null, 0);
  return out;
}

/** Drop every node that descends from any id in `ids` (collapsed groups, the dragged subtree). */
export function removeChildrenOf<G extends TreeGroup, L extends TreeLeaf>(
  items: FlatTreeNode<G, L>[], ids: Iterable<string>,
): FlatTreeNode<G, L>[] {
  const exclude = new Set(ids);
  const out: FlatTreeNode<G, L>[] = [];
  for (const item of items) {
    if (item.parentId !== null && exclude.has(item.parentId)) {
      if (item.kind === 'group') exclude.add(item.id);
      continue;
    }
    out.push(item);
  }
  return out;
}

/** Projected drop `{depth, parentId}` for the active row, given the pointer's horizontal drag offset. */
export function getDropProjection<G extends TreeGroup, L extends TreeLeaf>(
  items: FlatTreeNode<G, L>[], activeId: string, overId: string,
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
  // A leaf can't be a parent, so you can only descend a level past a group.
  const maxDepth = prev ? prev.depth + (prev.kind === 'group' ? 1 : 0) : 0;
  const minDepth = next ? next.depth : 0;
  const depth = clamp(projectedDepth, minDepth, maxDepth);

  const parentId = (() => {
    if (depth === 0 || !prev) return null;
    if (depth === prev.depth) return prev.parentId;
    if (depth > prev.depth) return prev.id; // prev is a group (maxDepth cap guarantees it)
    return newItems.slice(0, overIndex).reverse().find((i) => i.depth === depth)?.parentId ?? null;
  })();

  return { depth, parentId };
}

/**
 * Resolve a drag into new groups/leaves arrays. Projects the drop parent from `dragOffset` (using the visible
 * list, minus the dragged subtree), then re-parents and reindexes order across the full tree. Illegal moves
 * (a group into itself or a descendant) and unfound ids are no-ops. Never mutates inputs.
 */
export function applyDrop<G extends TreeGroup, L extends TreeLeaf>(
  groups: G[], leaves: L[], collapsedIds: Iterable<string>,
  activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): { groups: G[]; leaves: L[] } {
  const full = flattenTree(buildTree(groups, leaves));
  const visible = removeChildrenOf(full, [...collapsedIds, activeId]);
  // The drop target must be a visible row; dropping onto the dragged subtree (or a hidden row) is a no-op.
  if (!visible.some((i) => i.id === overId) || !visible.some((i) => i.id === activeId)) {
    return { groups, leaves };
  }
  const { parentId } = getDropProjection(visible, activeId, overId, dragOffset, indentationWidth);

  const isGroup = groups.some((g) => g.id === activeId);
  if (isGroup && parentId !== null && isDescendantGroup(groups, activeId, parentId)) {
    return { groups, leaves };
  }

  const activeIndex = full.findIndex((i) => i.id === activeId);
  const overIndex = full.findIndex((i) => i.id === overId);
  if (activeIndex === -1 || overIndex === -1) return { groups, leaves };

  const reParented = full.map((i) => (i.id === activeId ? { ...i, parentId } : i));
  const sorted = arrayMove(reParented, activeIndex, overIndex);

  const g2 = groups.map((g) => ({ ...g }));
  const l2 = leaves.map((l) => ({ ...l }));
  const byGroup = new Map(g2.map((g) => [g.id, g]));
  const byLeaf = new Map(l2.map((l) => [l.id, l]));
  const orderByParent = new Map<string, number>();
  for (const item of sorted) {
    const key = item.parentId ?? '\0root';
    const order = orderByParent.get(key) ?? 0;
    orderByParent.set(key, order + 1);
    if (item.kind === 'group') {
      const g = byGroup.get(item.id);
      if (g) { g.parentId = item.parentId; g.order = order; }
    } else {
      const l = byLeaf.get(item.id);
      if (l) { l.groupId = item.parentId; l.order = order; }
    }
  }
  return { groups: g2, leaves: l2 };
}
