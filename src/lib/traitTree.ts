// The trait folder tree (groups + traits, nestable via parentId/groupId) — a binding of the generic groupTree
// machinery to Trait/TraitGroup, plus the trait-only `buildTraitContext` that renders the selected traits into
// the block sent to the AI. The editor and selection screen build/walk the tree from the two flat world arrays.

import {
  buildTree, flattenTree, getDropProjection, applyDrop, duplicateNode,
  removeChildrenOf as removeChildrenOfGeneric, isDescendantGroup as isDescendantGroupGeneric,
  type GroupTreeNode, type FlatTreeNode,
} from './groupTree';
import type { Entity, Trait, TraitGroup } from '@/types';
import { xmlEscape } from './utils';

export type TraitTreeNode = GroupTreeNode<TraitGroup, Trait>;
export type FlatTraitNode = FlatTreeNode<TraitGroup, Trait>;

/** Build the full ordered tree of top-level nodes, each group carrying its recursive children. */
export const buildTraitTree = (groups: readonly TraitGroup[], traits: readonly Trait[]): TraitTreeNode[] =>
  buildTree(groups, traits);

/** True if `candidateId` is `ancestorId` itself or nested anywhere beneath it — guards illegal moves. */
export const isDescendantGroup = (groups: TraitGroup[], ancestorId: string, candidateId: string): boolean =>
  isDescendantGroupGeneric(groups, ancestorId, candidateId);

/** Depth-first flatten of the tree, tagging each node with its parent and indentation depth. */
export const flattenTraitTree = (tree: TraitTreeNode[]): FlatTraitNode[] => flattenTree(tree);

/** Drop every node that descends from any id in `ids` (collapsed groups, the dragged subtree). */
export const removeChildrenOf = (items: FlatTraitNode[], ids: Iterable<string>): FlatTraitNode[] =>
  removeChildrenOfGeneric(items, ids);

/** Projected drop `{depth, parentId}` for the active row, given the pointer's horizontal drag offset. */
export const getTraitDropProjection = (
  items: FlatTraitNode[], activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): { depth: number; parentId: string | null } =>
  getDropProjection(items, activeId, overId, dragOffset, indentationWidth);

/** Deep-duplicate a trait or a whole group subtree, inserting the copy right after the original. */
export function duplicateTraitNode(
  groups: TraitGroup[], traits: Trait[], id: string,
): { groups: TraitGroup[]; traits: Trait[]; newId: string } {
  const r = duplicateNode(groups, traits, id);
  return { groups: r.groups, traits: r.leaves, newId: r.newId };
}

/** Resolve a drag into new groups/traits arrays (re-parent + reindex). Illegal/unfound moves are no-ops. */
export function applyTraitDrop(
  groups: TraitGroup[], traits: Trait[], collapsedIds: Iterable<string>,
  activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): { groups: TraitGroup[]; traits: Trait[] } {
  const r = applyDrop(groups, traits, collapsedIds, activeId, overId, dragOffset, indentationWidth);
  return { groups: r.groups, traits: r.leaves };
}

/** Whether the entity owns a trait or a group, which is what gives it a node in the Traits tree. */
export const ownsTraits = (entity: Entity): boolean => (entity.traits?.length ?? 0) + (entity.traitGroups?.length ?? 0) > 0;

/** The Traits tab's one tree as flat group and trait lists. An entity node is a group whose id is the
 *  entity's; the entity's own root items sit under it. */
export interface OwnedTraitTree {
  groups: TraitGroup[];
  traits: Trait[];
  /** Entity node id → the entity it draws. */
  entityNodes: Map<string, Entity>;
  /** Owned trait or group id → its entity's id. World items are absent. */
  ownerOf: Map<string, string>;
}

/** The world's traits, then a node for each entity that owns a trait or a group, at the end of the top level. */
export function ownedTraitTree(
  world: { traits: readonly Trait[]; traitGroups: readonly TraitGroup[] }, entities: readonly Entity[],
): OwnedTraitTree {
  const worldGroupIds = new Set(world.traitGroups.map((g) => g.id));
  const atRoot = (ref: string | null | undefined) => ref == null || !worldGroupIds.has(ref);
  const rootSorts = [
    ...world.traitGroups.map((g, i) => (atRoot(g.parentId) ? g.order ?? i : -1)),
    ...world.traits.map((t, i) => (atRoot(t.groupId) ? t.order ?? i : -1)),
  ];
  const firstNodeOrder = Math.max(-1, ...rootSorts) + 1;

  const groups = [...world.traitGroups];
  const traits = [...world.traits];
  const entityNodes = new Map<string, Entity>();
  const ownerOf = new Map<string, string>();
  entities.filter(ownsTraits).forEach((entity, i) => {
    entityNodes.set(entity.id, entity);
    groups.push({ id: entity.id, name: entity.name, parentId: null, order: firstNodeOrder + i });
    const ownGroupIds = new Set((entity.traitGroups ?? []).map((g) => g.id));
    const parent = (ref: string | null | undefined) => (ref != null && ownGroupIds.has(ref) ? ref : entity.id);
    for (const g of entity.traitGroups ?? []) {
      groups.push({ ...g, parentId: parent(g.parentId) });
      ownerOf.set(g.id, entity.id);
    }
    for (const t of entity.traits ?? []) {
      traits.push({ ...t, groupId: parent(t.groupId) });
      ownerOf.set(t.id, entity.id);
    }
  });
  return { groups, traits, entityNodes, ownerOf };
}

/** What a drop in the one tree writes: the world's lists, or one entity with its own lists. */
export type OwnedTraitDrop =
  | { kind: 'world'; traits: Trait[]; groups: TraitGroup[] }
  | { kind: 'entity'; entity: Entity };

/**
 * Resolve a drag in the one tree. A drop inside one owner reorders and nests as in the world tree. Entity
 * nodes do not move, and a drop that would change an item's owner is refused. Null = nothing to write.
 */
export function applyOwnedTraitDrop(
  world: { traits: readonly Trait[]; traitGroups: readonly TraitGroup[] }, entities: readonly Entity[],
  collapsedIds: Iterable<string>, activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): OwnedTraitDrop | null {
  const tree = ownedTraitTree(world, entities);
  if (tree.entityNodes.has(activeId)) return null;
  const dropped = applyDrop(tree.groups, tree.traits, collapsedIds, activeId, overId, dragOffset, indentationWidth);
  if (dropped.groups === tree.groups && dropped.leaves === tree.traits) return null;

  // Walk up from the moved item to the entity node it now sits under, if any.
  const groupById = new Map(dropped.groups.map((g) => [g.id, g]));
  const moved = groupById.get(activeId) ?? dropped.leaves.find((t) => t.id === activeId);
  let ancestor = moved && ('parentId' in moved ? moved.parentId : moved.groupId);
  while (ancestor && !tree.entityNodes.has(ancestor)) ancestor = groupById.get(ancestor)?.parentId ?? null;
  const ownerId = tree.ownerOf.get(activeId) ?? null;
  if ((ancestor ?? null) !== ownerId) return null;

  if (!ownerId) {
    return {
      kind: 'world',
      traits: dropped.leaves.filter((t) => !tree.ownerOf.has(t.id)),
      groups: dropped.groups.filter((g) => !tree.ownerOf.has(g.id) && !tree.entityNodes.has(g.id)),
    };
  }
  // The entity node's id stands for the entity's root, which its own lists store as null.
  const fromNode = (parent: string | null | undefined) => (parent === ownerId ? null : parent ?? null);
  const entity = tree.entityNodes.get(ownerId)!;
  return {
    kind: 'entity',
    entity: {
      ...entity,
      traits: dropped.leaves.filter((t) => tree.ownerOf.get(t.id) === ownerId).map((t) => ({ ...t, groupId: fromNode(t.groupId) })),
      ...(entity.traitGroups ? {
        traitGroups: dropped.groups.filter((g) => tree.ownerOf.get(g.id) === ownerId).map((g) => ({ ...g, parentId: fromNode(g.parentId) })),
      } : {}),
    },
  };
}

/**
 * Build the trait block sent to the AI: ungrouped selected traits first, then each group (depth-first) that
 * has ≥1 selected trait, emitting the group name + its AI description (if non-blank) above its selected
 * traits. A trait's blank AI description falls back to just its name. Empty → ''.
 *
 * `format` controls the shape (mirrors the Default/Simple presets): `'simple'` is plain labels + indentation
 * (`World:` / `Name: desc`); `'markdown'` is nested bold bullets (`- **World:** desc` / `- **Name:** desc`)
 * a small model parses more cleanly; `'xml'` nests `<trait>`/`<group>` tags. The tree walk + selection are
 * identical; only line shaping differs.
 */
export function buildTraitContext(
  selectedIds: Iterable<string>,
  traits: Trait[],
  groups: TraitGroup[],
  format: 'simple' | 'markdown' | 'xml' = 'simple',
): string {
  const sel = new Set(selectedIds);
  if (format === 'xml') return buildTraitContextXml(sel, traits, groups);
  const md = format === 'markdown';
  const traitLine = (t: Trait) => {
    const name = md ? `**${t.name}:**` : `${t.name}:`;
    const bare = md ? `**${t.name}**` : t.name;
    return t.aiDescription?.trim() ? `${name} ${t.aiDescription.trim()}` : bare;
  };
  const selectedIn = (groupId: string | null) =>
    traits
      .filter((t) => (t.groupId ?? null) === groupId && sel.has(t.id))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const lines: string[] = [];
  for (const t of selectedIn(null)) lines.push(md ? `- ${traitLine(t)}` : traitLine(t));

  const walk = (nodes: TraitTreeNode[], depth: number) => {
    for (const node of nodes) {
      if (node.kind !== 'group') continue;
      const groupTraits = selectedIn(node.id);
      const indent = '  '.repeat(depth);
      const desc = node.group.aiDescription?.trim();
      if (groupTraits.length) {
        if (md) {
          // Bold group name as a bullet, description inlined after it.
          lines.push(`${indent}- **${node.group.name}:**${desc ? ` ${desc}` : ''}`);
          for (const t of groupTraits) lines.push(`${indent}  - ${traitLine(t)}`);
        } else {
          lines.push(`${indent}${node.group.name}:`);
          if (desc) lines.push(`${indent}  ${desc}`);
          for (const t of groupTraits) lines.push(`${indent}  ${traitLine(t)}`);
        }
      }
      walk(node.children, depth + 1);
    }
  };
  walk(buildTraitTree(groups, traits), 0);
  return lines.join('\n');
}

/** XML shape of the trait block: ungrouped `<trait>` first, then each group (with ≥1 selected trait) as a
 *  `<group>` nesting its `<name>`/`<description>`, its traits, and any descendant groups. A group with no
 *  directly-selected trait isn't wrapped but its descendants still surface (mirrors the simple/markdown walk). */
function buildTraitContextXml(sel: Set<string>, traits: Trait[], groups: TraitGroup[]): string {
  const selectedIn = (groupId: string | null) =>
    traits
      .filter((t) => (t.groupId ?? null) === groupId && sel.has(t.id))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const traitXml = (t: Trait, pad: string): string => {
    const desc = t.aiDescription?.trim();
    let inner = `\n${pad}  <name>${xmlEscape(t.name)}</name>`;
    if (desc) inner += `\n${pad}  <description>${xmlEscape(desc)}</description>`;
    return `${pad}<trait>${inner}\n${pad}</trait>`;
  };

  const walk = (nodes: TraitTreeNode[], pad: string): string[] => {
    const out: string[] = [];
    for (const node of nodes) {
      if (node.kind !== 'group') continue;
      const groupTraits = selectedIn(node.id);
      const childBlocks = walk(node.children, groupTraits.length ? `${pad}  ` : pad);
      if (!groupTraits.length) {
        out.push(...childBlocks);
        continue;
      }
      const desc = node.group.aiDescription?.trim();
      let inner = `\n${pad}  <name>${xmlEscape(node.group.name)}</name>`;
      if (desc) inner += `\n${pad}  <description>${xmlEscape(desc)}</description>`;
      for (const t of groupTraits) inner += `\n${traitXml(t, `${pad}  `)}`;
      for (const cb of childBlocks) inner += `\n${cb}`;
      out.push(`${pad}<group>${inner}\n${pad}</group>`);
    }
    return out;
  };

  const lines = selectedIn(null).map((t) => traitXml(t, ''));
  lines.push(...walk(buildTraitTree(groups, traits), ''));
  return lines.join('\n');
}
