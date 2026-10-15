// Generic folder-tree machinery shared by the editor's Traits and Entities tabs (see traitTree.ts /
// entityGroupTree.ts, which bind these to their own types). A tree is two flat arrays: groups (nestable via
// `parentId`) and leaves (each in a group via `groupId`), with sibling order on `order`. Everything here is
// pure and never mutates its inputs. The dnd-kit "sortable tree" recipe drives drag: one flat list where the
// horizontal pointer offset during a drag decides drop depth (and thus parent); leaves can't be parents.

import { ancestors, parentLookup } from "@/lib/ancestors";
import { randomUUID } from "@/lib/uuid";
import { knownParent, planTreeDrop, projectDrop, removeCollapsedRows } from "@/lib/treeProjection";
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

/** Direct children (subgroups + leaves) of `parentId`, ordered by `order` (falling back to array index). */
function childrenOf<G extends TreeGroup, L extends TreeLeaf>(
  groups: readonly G[], leaves: readonly L[], parentId: string | null, knownGroupIds: ReadonlySet<string>,
): GroupTreeNode<G, L>[] {
  const entries: { node: GroupTreeNode<G, L>; sort: number }[] = [];
  groups.forEach((g, i) => {
    if (knownParent(g.parentId, knownGroupIds) === parentId) {
      entries.push({ node: { kind: 'group', id: g.id, group: g, children: [] }, sort: g.order ?? i });
    }
  });
  leaves.forEach((l, i) => {
    if (knownParent(l.groupId, knownGroupIds) === parentId) {
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

/** Whether the AI reads a group's name and description. */
export const headingReachesAi = (group: { aiVisible?: boolean }): boolean => group.aiVisible !== false;

/** The tree as the AI reads it: a group whose heading the AI can't see gives its slot to its children. */
export function aiVisibleTree<G extends TreeGroup & { aiVisible?: boolean }, L extends TreeLeaf>(
  nodes: GroupTreeNode<G, L>[],
): GroupTreeNode<G, L>[] {
  return nodes.flatMap((node) => {
    if (node.kind === 'leaf') return [node];
    const children = aiVisibleTree(node.children);
    return headingReachesAi(node.group) ? [{ ...node, children }] : children;
  });
}

/** True if `candidateId` is `ancestorId` itself or nested anywhere beneath it — guards illegal moves. */
export function isDescendantGroup<G extends TreeGroup>(groups: G[], ancestorId: string, candidateId: string): boolean {
  return candidateId === ancestorId
    || ancestors(candidateId, parentLookup(groups, (g) => g.parentId)).includes(ancestorId);
}

const findGroupNode = <G extends TreeGroup, L extends TreeLeaf>(
  nodes: GroupTreeNode<G, L>[], id: string,
): Extract<GroupTreeNode<G, L>, { kind: 'group' }> | undefined => {
  for (const node of nodes) {
    if (node.kind !== 'group') continue;
    if (node.id === id) return node;
    const inner = findGroupNode(node.children, id);
    if (inner) return inner;
  }
  return undefined;
};

/** How a tree's leaves take a new group. `orderLeaves: false` is for a tree whose leaves have no `order` (their
 *  array order is the sibling order): only the groups are renumbered. `placeLeaf` writes a leaf's new group
 *  where absence, not null, means ungrouped. */
export interface PromoteOptions<L extends TreeLeaf> {
  orderLeaves?: boolean;
  placeLeaf?: (leaf: L, groupId: string | null) => L;
}

/**
 * Delete a group. Its subgroups and leaves move up to its parent, into the slot the group held, and the
 * parent's items are renumbered from there. Leaves come back in the order they went in. Unchanged inputs keep
 * identity: a missing id returns both arrays as given.
 */
export function removeGroupPromotingChildren<G extends TreeGroup, L extends TreeLeaf>(
  groups: G[], leaves: L[], id: string, { orderLeaves = true, placeLeaf }: PromoteOptions<L> = {},
): { groups: G[]; leaves: L[] } {
  const doomed = groups.find((g) => g.id === id);
  if (!doomed) return { groups, leaves };
  const tree = buildTree(groups, leaves);
  const above = doomed.parentId === null ? undefined : findGroupNode(tree, doomed.parentId);
  const siblings = above ? above.children : tree;
  const parentId = above ? above.id : null;
  const slots = siblings
    .flatMap((node) => (node.id === id && node.kind === 'group' ? node.children : [node]))
    .filter((node) => orderLeaves || node.kind === 'group');
  const orderOf = new Map(slots.map((node, i) => [node.id, i]));
  const nextGroups = groups.filter((g) => g.id !== id).map((g) => (orderOf.has(g.id) ? { ...g, parentId, order: orderOf.get(g.id) } : g));
  const nextLeaves = leaves.map((leaf) => {
    if (orderLeaves) return orderOf.has(leaf.id) ? { ...leaf, groupId: parentId, order: orderOf.get(leaf.id) } : leaf;
    if (leaf.groupId !== id) return leaf;
    return placeLeaf ? placeLeaf(leaf, parentId) : { ...leaf, groupId: parentId };
  });
  return { groups: nextGroups, leaves: nextLeaves };
}

/**
 * Deep-duplicate a leaf or a whole group subtree, inserting the copy immediately after the original within
 * the same parent/group. Groups bring all nested subgroups + leaves, each with a fresh id and remapped parent
 * links; only the top copied item's name gets a " (Copy)" suffix. Sibling `order`s of the affected parent are
 * renormalized so the copy reliably follows the original. Never mutates inputs; a missing id is a no-op
 * (returns the same arrays + the id unchanged). `idMap` maps each copied id to its copy's.
 */
export function duplicateNode<G extends TreeGroup, L extends TreeLeaf>(
  groups: G[], leaves: L[], id: string,
): { groups: G[]; leaves: L[]; newId: string; idMap: ReadonlyMap<string, string> } {
  const isGroup = groups.some((g) => g.id === id);
  const isLeaf = leaves.some((l) => l.id === id);
  if (!isGroup && !isLeaf) return { groups, leaves, newId: id, idMap: new Map() };

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

  return { groups: g2, leaves: l2, newId, idMap };
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
  return removeCollapsedRows(items, ids);
}

/** Projected drop `{depth, parentId}` for the active row. Only a group can take children. */
export function getDropProjection<G extends TreeGroup, L extends TreeLeaf>(
  items: FlatTreeNode<G, L>[], activeId: string, overId: string,
  dragOffset: number, indentationWidth: number,
): { depth: number; parentId: string | null } {
  return projectDrop(items, activeId, overId, dragOffset, indentationWidth, (row) => row.kind === 'group');
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
  const plan = planTreeDrop(flattenTree(buildTree(groups, leaves)), collapsedIds, activeId, overId, dragOffset, indentationWidth, {
    canParent: (row) => row.kind === 'group',
    refuses: (active, parent) => active.kind === 'group' && parent !== null && isDescendantGroup(groups, active.id, parent.id),
  });
  if (!plan) return { groups, leaves };

  const g2 = groups.map((g) => ({ ...g }));
  const l2 = leaves.map((l) => ({ ...l }));
  const byGroup = new Map(g2.map((g) => [g.id, g]));
  const byLeaf = new Map(l2.map((l) => [l.id, l]));
  const orderByParent = new Map<string, number>();
  for (const item of plan.moved) {
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

/** The projection walked up out of every blocked parent, then replayed at that depth so the rows below agree.
 *  Null when they would hold the row where it can't be. */
export function projectionPastBlocked<G extends TreeGroup, L extends TreeLeaf>(
  items: FlatTreeNode<G, L>[], active: FlatTreeNode<G, L>, overId: string, projection: { depth: number; parentId: string | null },
  blocked: (id: string) => boolean, indentationWidth: number,
): { depth: number; parentId: string | null } | null {
  const parentOf = new Map(items.map((i) => [i.id, i.parentId]));
  let { depth, parentId } = projection;
  while (parentId !== null && blocked(parentId)) {
    parentId = parentOf.get(parentId) ?? null;
    depth -= 1;
  }
  const replayed = depth === projection.depth
    ? projection
    : getDropProjection(items, active.id, overId, (depth - active.depth) * indentationWidth, indentationWidth);
  return replayed.depth === depth && replayed.parentId === parentId ? replayed : null;
}

/**
 * What a drop in a tree with entity nodes writes: every owner (an entity's id, null for the world) whose item
 * moved or changed owner, and the nodes that store where they landed. Unplaced nodes still ending the top level
 * in `unplacedIds` order stay unplaced. A pinned node's entity is among the touched owners.
 */
export function nodeDropWrites<G extends TreeGroup, L extends TreeLeaf>(
  before: { groups: readonly G[]; leaves: readonly L[] }, after: { groups: readonly G[]; leaves: readonly L[] },
  nodeIds: ReadonlySet<string>, unplacedIds: readonly string[],
  ownerBefore: (id: string) => string | null, ownerAfter: (id: string) => string | null,
): { touched: Set<string | null>; pinned: Set<string> } {
  const spot = (parent: string | null | undefined, order: number | undefined) => `${parent ?? ''}|${order ?? ''}`;
  const spotBefore = new Map([
    ...before.groups.map((g) => [g.id, spot(g.parentId, g.order)] as const),
    ...before.leaves.map((l) => [l.id, spot(l.groupId, l.order)] as const),
  ]);
  const touched = new Set<string | null>();
  const touch = (id: string, parent: string | null | undefined, order: number | undefined) => {
    if (spotBefore.get(id) === spot(parent, order) && ownerBefore(id) === ownerAfter(id)) return;
    touched.add(ownerBefore(id));
    touched.add(ownerAfter(id));
  };
  for (const g of after.groups) if (!nodeIds.has(g.id)) touch(g.id, g.parentId, g.order);
  for (const l of after.leaves) touch(l.id, l.groupId, l.order);

  const rootIds = [...after.groups.filter((g) => g.parentId === null), ...after.leaves.filter((l) => (l.groupId ?? null) === null)]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((item) => item.id);
  const stillUnplaced = new Set<string>();
  for (let i = rootIds.length - 1, j = unplacedIds.length - 1; i >= 0 && j >= 0 && rootIds[i] === unplacedIds[j]; i--, j--) {
    stillUnplaced.add(unplacedIds[j]);
  }
  const groupById = new Map(after.groups.map((g) => [g.id, g]));
  const pinned = new Set([...nodeIds].filter((id) => {
    if (stillUnplaced.has(id)) return false;
    const node = groupById.get(id)!;
    return unplacedIds.includes(id) || spotBefore.get(id) !== spot(node.parentId, node.order);
  }));
  pinned.forEach((id) => touched.add(id));
  return { touched, pinned };
}
