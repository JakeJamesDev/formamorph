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

interface Sibling { id: string; kind: 'group' | 'trait' }

/** Ordered direct children (ids + kind) of a parent, by `order` with array-index fallback. */
function orderedSiblings(groups: TraitGroup[], traits: Trait[], parentId: string | null): Sibling[] {
  const entries: { id: string; kind: 'group' | 'trait'; sort: number }[] = [];
  groups.forEach((g, i) => {
    if ((g.parentId ?? null) === parentId) entries.push({ id: g.id, kind: 'group', sort: g.order ?? i });
  });
  traits.forEach((t, i) => {
    if ((t.groupId ?? null) === parentId) entries.push({ id: t.id, kind: 'trait', sort: t.order ?? i });
  });
  return entries.sort((a, b) => a.sort - b.sort).map(({ id, kind }) => ({ id, kind }));
}

/** Write sequential `order` (0..n) onto the given sibling list, mutating the passed arrays. */
function applyOrder(groups: TraitGroup[], traits: Trait[], sibs: Sibling[]) {
  sibs.forEach((s, i) => {
    if (s.kind === 'group') {
      const g = groups.find((x) => x.id === s.id);
      if (g) g.order = i;
    } else {
      const t = traits.find((x) => x.id === s.id);
      if (t) t.order = i;
    }
  });
}

/**
 * Move a trait or group under `newParentId`, inserted before `beforeId` (or appended when null), and
 * reindex the affected sibling lists. Illegal moves (a group into itself or a descendant) are no-ops.
 * Returns new arrays; never mutates the inputs.
 */
export function moveNode(
  groups: TraitGroup[], traits: Trait[], activeId: string,
  newParentId: string | null, beforeId: string | null,
): { groups: TraitGroup[]; traits: Trait[] } {
  const isGroup = groups.some((g) => g.id === activeId);
  if (isGroup && (activeId === newParentId || (newParentId !== null && isDescendantGroup(groups, activeId, newParentId)))) {
    return { groups, traits };
  }
  const g2 = groups.map((g) => ({ ...g }));
  const t2 = traits.map((t) => ({ ...t }));

  const oldParent = isGroup
    ? (g2.find((g) => g.id === activeId)?.parentId ?? null)
    : (t2.find((t) => t.id === activeId)?.groupId ?? null);

  if (isGroup) {
    const a = g2.find((g) => g.id === activeId);
    if (a) a.parentId = newParentId;
  } else {
    const a = t2.find((t) => t.id === activeId);
    if (a) a.groupId = newParentId;
  }

  const dest = orderedSiblings(g2, t2, newParentId).filter((s) => s.id !== activeId);
  const activeSib: Sibling = { id: activeId, kind: isGroup ? 'group' : 'trait' };
  const idx = beforeId ? dest.findIndex((s) => s.id === beforeId) : -1;
  if (idx === -1) dest.push(activeSib);
  else dest.splice(idx, 0, activeSib);
  applyOrder(g2, t2, dest);

  if ((oldParent ?? null) !== (newParentId ?? null)) {
    applyOrder(g2, t2, orderedSiblings(g2, t2, oldParent));
  }
  return { groups: g2, traits: t2 };
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

/** Walk the tree depth-first, yielding every group node (used to order selection-screen tabs). */
export function flattenGroups(tree: TraitTreeNode[]): TraitGroup[] {
  const out: TraitGroup[] = [];
  const visit = (nodes: TraitTreeNode[]) => {
    for (const node of nodes) {
      if (node.kind === 'group') {
        out.push(node.group);
        visit(node.children);
      }
    }
  };
  visit(tree);
  return out;
}
