// Pure helpers for the trait folder tree (groups + traits, nestable via parentId/groupId). The editor
// and selection screen build/walk the tree from the two flat arrays kept on the world.

import type { Trait, TraitGroup } from '@/types';

export type TraitTreeNode =
  | { kind: 'group'; id: string; group: TraitGroup; children: TraitTreeNode[] }
  | { kind: 'trait'; id: string; trait: Trait };

/** Direct children (subgroups + traits) of `parentId`, ordered by `order` (falling back to array index). */
function childrenOf(groups: TraitGroup[], traits: Trait[], parentId: string | null): TraitTreeNode[] {
  const entries: { node: TraitTreeNode; sort: number }[] = [];
  groups.forEach((g, i) => {
    if ((g.parentId ?? null) === parentId) {
      entries.push({ node: { kind: 'group', id: g.id, group: g, children: [] }, sort: g.order ?? i });
    }
  });
  traits.forEach((t, i) => {
    if ((t.groupId ?? null) === parentId) {
      entries.push({ node: { kind: 'trait', id: t.id, trait: t }, sort: t.order ?? i });
    }
  });
  return entries.sort((a, b) => a.sort - b.sort).map((e) => e.node);
}

/** Build the full ordered tree of top-level nodes, each group carrying its recursive children. */
export function buildTraitTree(groups: TraitGroup[], traits: Trait[]): TraitTreeNode[] {
  const build = (parentId: string | null): TraitTreeNode[] =>
    childrenOf(groups, traits, parentId).map((node) =>
      node.kind === 'group' ? { ...node, children: build(node.id) } : node,
    );
  return build(null);
}

/** True if `candidateId` is `ancestorId` itself or nested anywhere beneath it — guards illegal moves. */
export function isDescendantGroup(groups: TraitGroup[], ancestorId: string, candidateId: string): boolean {
  const byId = new Map(groups.map((g) => [g.id, g]));
  let cur: string | null | undefined = candidateId;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = byId.get(cur)?.parentId ?? null;
  }
  return false;
}

/**
 * Build the trait block sent to the AI: ungrouped selected traits first (bare lines), then each group
 * (depth-first) that has ≥1 selected trait, emitting `Group:` + its AI description (if non-blank) above
 * its selected traits. A trait's blank AI description falls back to just its name. Empty → ''.
 */
export function buildTraitContext(selectedIds: Iterable<string>, traits: Trait[], groups: TraitGroup[]): string {
  const sel = new Set(selectedIds);
  const traitLine = (t: Trait) =>
    t.aiDescription?.trim() ? `${t.name}: ${t.aiDescription.trim()}` : t.name;
  const selectedIn = (groupId: string | null) =>
    traits
      .filter((t) => (t.groupId ?? null) === groupId && sel.has(t.id))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const lines: string[] = [];
  for (const t of selectedIn(null)) lines.push(traitLine(t));

  const walk = (nodes: TraitTreeNode[], depth: number) => {
    for (const node of nodes) {
      if (node.kind !== 'group') continue;
      const groupTraits = selectedIn(node.id);
      const indent = '  '.repeat(depth);
      if (groupTraits.length) {
        lines.push(`${indent}${node.group.name}:`);
        if (node.group.aiDescription?.trim()) lines.push(`${indent}  ${node.group.aiDescription.trim()}`);
        for (const t of groupTraits) lines.push(`${indent}  - ${traitLine(t)}`);
      }
      walk(node.children, depth + 1);
    }
  };
  walk(buildTraitTree(groups, traits), 0);
  return lines.join('\n');
}

/**
 * Deep-duplicate a trait or a whole group subtree, inserting the copy immediately after the original
 * within the same parent/group. Groups bring all nested subgroups + traits, each with a fresh id and
 * remapped parent links; only the top copied item's name gets a " (Copy)" suffix. Sibling `order`s of
 * the affected parent are renormalized so the copy reliably follows the original. Never mutates inputs;
 * a missing id is a no-op (returns the same arrays + the id unchanged).
 */
export function duplicateTraitNode(
  groups: TraitGroup[], traits: Trait[], id: string,
): { groups: TraitGroup[]; traits: Trait[]; newId: string } {
  const isGroup = groups.some((g) => g.id === id);
  const isTrait = traits.some((t) => t.id === id);
  if (!isGroup && !isTrait) return { groups, traits, newId: id };

  // Subtree membership: the group + all descendant groups, and every trait inside any of them.
  const subtreeGroupIds = new Set<string>();
  if (isGroup) {
    const collect = (gid: string) => {
      subtreeGroupIds.add(gid);
      groups.filter((g) => (g.parentId ?? null) === gid).forEach((c) => collect(c.id));
    };
    collect(id);
  }
  const subtreeTraitIds = isGroup
    ? traits.filter((t) => t.groupId && subtreeGroupIds.has(t.groupId)).map((t) => t.id)
    : [id];

  const idMap = new Map<string, string>();
  subtreeGroupIds.forEach((gid) => idMap.set(gid, crypto.randomUUID()));
  subtreeTraitIds.forEach((tid) => idMap.set(tid, crypto.randomUUID()));
  const newId = idMap.get(id)!;
  const rootParent = isGroup
    ? groups.find((g) => g.id === id)!.parentId ?? null
    : traits.find((t) => t.id === id)!.groupId ?? null;

  const clonedGroups: TraitGroup[] = [...subtreeGroupIds].map((gid) => {
    const copy = structuredClone(groups.find((g) => g.id === gid)!);
    copy.id = idMap.get(gid)!;
    copy.parentId = gid === id ? rootParent : idMap.get(copy.parentId!)!; // root keeps parent; rest remap
    return copy;
  });
  const clonedTraits: Trait[] = subtreeTraitIds.map((tid) => {
    const copy = structuredClone(traits.find((t) => t.id === tid)!);
    copy.id = idMap.get(tid)!;
    copy.groupId = isGroup ? idMap.get(copy.groupId!)! : rootParent;
    return copy;
  });

  const root = isGroup
    ? clonedGroups.find((g) => g.id === newId)!
    : clonedTraits.find((t) => t.id === newId)!;
  root.name = `${root.name} (Copy)`;

  // Don't mutate inputs: shallow-copy existing rows, append the clones.
  const g2 = groups.map((g) => ({ ...g })).concat(clonedGroups);
  const t2 = traits.map((t) => ({ ...t })).concat(clonedTraits);

  // Place the copy right after the original among its siblings, then renormalize that parent's order
  // (handles worlds whose items have no explicit `order`, where array index would misplace the copy).
  const seq = childrenOf(groups, traits, rootParent).map((n) => n.id);
  seq.splice(seq.indexOf(id) + 1, 0, newId);
  seq.forEach((sid, i) => {
    const g = g2.find((x) => x.id === sid);
    if (g) { g.order = i; return; }
    const t = t2.find((x) => x.id === sid);
    if (t) t.order = i;
  });

  return { groups: g2, traits: t2, newId };
}

// ---- Sortable-tree drag projection (editor Traits tab) ------------------------------------------
// Ports the dnd-kit "sortable tree" recipe: a single flat list where the horizontal pointer offset
// during a drag decides the drop depth (and thus the parent). Traits are leaves, so a row may only
// nest under a group.

export interface FlatTraitNode {
  id: string;
  kind: 'group' | 'trait';
  parentId: string | null;
  depth: number;
  group?: TraitGroup;
  trait?: Trait;
}

/** Depth-first flatten of the tree, tagging each node with its parent and indentation depth. */
export function flattenTraitTree(tree: TraitTreeNode[]): FlatTraitNode[] {
  const out: FlatTraitNode[] = [];
  const walk = (nodes: TraitTreeNode[], parentId: string | null, depth: number) => {
    for (const node of nodes) {
      if (node.kind === 'group') {
        out.push({ id: node.id, kind: 'group', parentId, depth, group: node.group });
        walk(node.children, node.id, depth + 1);
      } else {
        out.push({ id: node.id, kind: 'trait', parentId, depth, trait: node.trait });
      }
    }
  };
  walk(tree, null, 0);
  return out;
}

/** Drop every node that descends from any id in `ids` (collapsed groups, the dragged subtree). */
export function removeChildrenOf(items: FlatTraitNode[], ids: Iterable<string>): FlatTraitNode[] {
  const exclude = new Set(ids);
  const out: FlatTraitNode[] = [];
  for (const item of items) {
    if (item.parentId !== null && exclude.has(item.parentId)) {
      if (item.kind === 'group') exclude.add(item.id);
      continue;
    }
    out.push(item);
  }
  return out;
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** Projected drop {depth, parentId} for the active row, given the pointer's horizontal drag offset. */
export function getTraitDropProjection(
  items: FlatTraitNode[], activeId: string, overId: string,
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
  // A trait can't be a parent, so you can only descend a level past a group.
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
 * Resolve a drag into new groups/traits arrays. Projects the drop parent from `dragOffset` (using the
 * visible list, minus the dragged subtree), then re-parents and reindexes order across the full tree.
 * Illegal moves (a group into itself or a descendant) and unfound ids are no-ops. Never mutates inputs.
 */
export function applyTraitDrop(
  groups: TraitGroup[], traits: Trait[], collapsedIds: Iterable<string>,
  activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): { groups: TraitGroup[]; traits: Trait[] } {
  const full = flattenTraitTree(buildTraitTree(groups, traits));
  const visible = removeChildrenOf(full, [...collapsedIds, activeId]);
  // The drop target must be a visible row; dropping onto the dragged subtree (or a hidden row) is a no-op.
  if (!visible.some((i) => i.id === overId) || !visible.some((i) => i.id === activeId)) {
    return { groups, traits };
  }
  const { parentId } = getTraitDropProjection(visible, activeId, overId, dragOffset, indentationWidth);

  const isGroup = groups.some((g) => g.id === activeId);
  if (isGroup && parentId !== null && isDescendantGroup(groups, activeId, parentId)) {
    return { groups, traits };
  }

  const activeIndex = full.findIndex((i) => i.id === activeId);
  const overIndex = full.findIndex((i) => i.id === overId);
  if (activeIndex === -1 || overIndex === -1) return { groups, traits };

  const reParented = full.map((i) => (i.id === activeId ? { ...i, parentId } : i));
  const sorted = arrayMove(reParented, activeIndex, overIndex);

  const g2 = groups.map((g) => ({ ...g }));
  const t2 = traits.map((t) => ({ ...t }));
  const byGroup = new Map(g2.map((g) => [g.id, g]));
  const byTrait = new Map(t2.map((t) => [t.id, t]));
  const orderByParent = new Map<string, number>();
  for (const item of sorted) {
    const key = item.parentId ?? '\0root';
    const order = orderByParent.get(key) ?? 0;
    orderByParent.set(key, order + 1);
    if (item.kind === 'group') {
      const g = byGroup.get(item.id);
      if (g) { g.parentId = item.parentId; g.order = order; }
    } else {
      const t = byTrait.get(item.id);
      if (t) { t.groupId = item.parentId; t.order = order; }
    }
  }
  return { groups: g2, traits: t2 };
}
