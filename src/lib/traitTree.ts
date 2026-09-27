// The trait folder tree (groups + traits, nestable via parentId/groupId) — a binding of the generic groupTree
// machinery to Trait/TraitGroup, plus the trait-only `buildTraitContext` that renders the selected traits into
// the block sent to the AI. The editor and selection screen build/walk the tree from the two flat world arrays.

import {
  buildTree, flattenTree, getDropProjection, applyDrop, duplicateNode,
  removeChildrenOf as removeChildrenOfGeneric, isDescendantGroup as isDescendantGroupGeneric,
  type GroupTreeNode, type FlatTreeNode,
} from './groupTree';
import type { Entity, Trait, TraitGroup, TraitPlacement } from '@/types';
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

/** The world's Templates group, when the author added one. */
export const templatesGroup = (groups: readonly TraitGroup[]): TraitGroup | undefined =>
  groups.find((g) => g.system === 'templates');

/** Templates and every world group below it. Empty when the world has no Templates group. */
export function templatesSubtreeIds(groups: readonly TraitGroup[]): Set<string> {
  const ids = new Set<string>();
  const templates = templatesGroup(groups);
  if (!templates) return ids;
  ids.add(templates.id);
  for (let grew = true; grew;) {
    grew = false;
    for (const g of groups) if (g.parentId && ids.has(g.parentId) && !ids.has(g.id)) { ids.add(g.id); grew = true; }
  }
  return ids;
}

/** The world groups an entity node can sit in: every one outside Templates. */
export function placeableGroupIds(groups: readonly TraitGroup[]): Set<string> {
  const inTemplates = templatesSubtreeIds(groups);
  return new Set(groups.filter((g) => !inTemplates.has(g.id)).map((g) => g.id));
}

/** The entity node's placement when its group is a world group outside Templates; a gone, foreign or Templates
 *  group reads as none. */
export function effectivePlacement(entity: Entity, placeableIds: ReadonlySet<string>): TraitPlacement | null {
  const p = entity.traitPlacement;
  return p && (p.groupId === null || placeableIds.has(p.groupId)) ? p : null;
}

type WorldTraitLists = { traits: readonly Trait[]; traitGroups: readonly TraitGroup[] };

/** The world's traits, with a node for each entity that owns a trait or a group. A node sits where its
 *  placement puts it; an unplaced node goes to the end of the top level, in entity order. Library entities
 *  (a persona or an added entity) come last at the top level, in the order given. */
export function ownedTraitTree(
  world: WorldTraitLists, entities: readonly Entity[], library: readonly Entity[] = [],
): OwnedTraitTree {
  const worldGroupIds = new Set(world.traitGroups.map((g) => g.id));
  const placeable = placeableGroupIds(world.traitGroups);
  const atRoot = (ref: string | null | undefined) => ref == null || !worldGroupIds.has(ref);
  const owning = entities.filter(ownsTraits);
  const rootSorts = [
    ...world.traitGroups.map((g, i) => (atRoot(g.parentId) ? g.order ?? i : -1)),
    ...world.traits.map((t, i) => (atRoot(t.groupId) ? t.order ?? i : -1)),
    ...owning.map((e) => effectivePlacement(e, placeable)).map((p) => (p?.groupId === null ? p.order : -1)),
  ];
  const firstNodeOrder = Math.max(-1, ...rootSorts) + 1;

  const groups = [...world.traitGroups];
  const traits = [...world.traits];
  const entityNodes = new Map<string, Entity>();
  const ownerOf = new Map<string, string>();
  let unplaced = 0;
  const libraryIds = new Set(library.map((e) => e.id));
  [...owning, ...library.filter(ownsTraits)].forEach((entity) => {
    entityNodes.set(entity.id, entity);
    const placement = libraryIds.has(entity.id) ? null : effectivePlacement(entity, placeable);
    groups.push({
      id: entity.id, name: entity.name,
      parentId: placement?.groupId ?? null, order: placement ? placement.order : firstNodeOrder + unplaced++,
    });
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

/** A drop into an entity refused because `offender`, inside the dragged `name`, has stat effects. */
export interface TraitDropRefusal {
  name: string;
  kind: 'trait' | 'group';
  offender: string;
  /** The name of the entity the item stays with; null = the world. */
  owner: string | null;
}

/** What a drop in the one tree writes: the world's lists when they changed, and every entity that changed. */
export type OwnedTraitDrop =
  | { kind: 'moved'; world?: { traits: Trait[]; groups: TraitGroup[] }; entities: Entity[] }
  | { kind: 'refused'; refusal: TraitDropRefusal };

const hasStatEffects = (t: Trait): boolean => t.statChanges.length > 0 || (t.statToggles?.length ?? 0) > 0;

/** The one tree's visible rows, with collapsed groups' children hidden. */
export const ownedTraitRows = (tree: OwnedTraitTree, collapsedIds: Iterable<string>): FlatTraitNode[] =>
  removeChildrenOf(flattenTraitTree(buildTraitTree(tree.groups, tree.traits)), collapsedIds);

/** Whether the row is an entity node, or a world group with one anywhere below it. */
const carriesEntityNode = (tree: OwnedTraitTree, id: string): boolean =>
  [...tree.entityNodes.keys()].some((nodeId) => isDescendantGroup(tree.groups, id, nodeId));

/**
 * Where a drag in the one tree would land. A row that is or holds an entity node stops at the top level
 * or a world group. Null when the rows below would hold it inside an owner.
 */
export function getOwnedTraitDropProjection(
  tree: OwnedTraitTree, items: FlatTraitNode[], activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): { depth: number; parentId: string | null } | null {
  const projection = getDropProjection(items, activeId, overId, dragOffset, indentationWidth);
  if (!carriesEntityNode(tree, activeId)) return projection;
  const active = items.find((i) => i.id === activeId);
  if (!active) return null;
  const parentOf = new Map(items.map((i) => [i.id, i.parentId]));
  let { depth, parentId } = projection;
  while (parentId !== null && (tree.entityNodes.has(parentId) || tree.ownerOf.has(parentId))) {
    parentId = parentOf.get(parentId) ?? null;
    depth -= 1;
  }
  const replayed = getDropProjection(items, activeId, overId, (depth - active.depth) * indentationWidth, indentationWidth);
  return replayed.depth === depth && replayed.parentId === parentId ? replayed : null;
}

/**
 * Resolve a drag in the one tree. A trait or group may change owner and keeps its id, unless a trait it
 * carries into an entity has stat effects. An entity node moves like a group, among world items only.
 * Null = nothing to write.
 */
export function applyOwnedTraitDrop(
  world: WorldTraitLists, entities: readonly Entity[],
  collapsedIds: Iterable<string>, activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): OwnedTraitDrop | null {
  const tree = ownedTraitTree(world, entities);
  const collapsed = [...collapsedIds];
  const rows = ownedTraitRows(tree, [...collapsed, activeId]);
  const projection = getOwnedTraitDropProjection(tree, rows, activeId, overId, dragOffset, indentationWidth);
  const activeRow = rows.find((r) => r.id === activeId);
  if (!projection || !activeRow) return null;
  // The drop replays the projection's depth, which for an entity node may sit left of the pointer.
  const offset = (projection.depth - activeRow.depth) * indentationWidth;
  const dropped = applyDrop(tree.groups, tree.traits, collapsed, activeId, overId, offset, indentationWidth);
  if (dropped.groups === tree.groups && dropped.leaves === tree.traits) return null;

  const groupById = new Map(dropped.groups.map((g) => [g.id, g]));
  const ownerAt = (parent: string | null | undefined): string | null => {
    let at = parent ?? null;
    while (at && !tree.entityNodes.has(at)) at = groupById.get(at)?.parentId ?? null;
    return at;
  };

  // The dragged item with everything below it.
  const subtree = new Set([activeId]);
  for (let grew = true; grew;) {
    grew = false;
    for (const g of dropped.groups) if (g.parentId && subtree.has(g.parentId) && !subtree.has(g.id)) { subtree.add(g.id); grew = true; }
  }
  const leavesBelow = dropped.leaves.filter((t) => subtree.has(t.id) || (t.groupId != null && subtree.has(t.groupId)));
  leavesBelow.forEach((t) => subtree.add(t.id));

  const isNode = tree.entityNodes.has(activeId);
  const from = tree.ownerOf.get(activeId) ?? null;
  const movedGroup = groupById.get(activeId);
  const movedItem = movedGroup ?? dropped.leaves.find((t) => t.id === activeId)!;
  const to = isNode ? null : ownerAt(movedGroup ? movedGroup.parentId : (movedItem as Trait).groupId);
  if (!isNode && from !== to && to !== null) {
    const offender = flattenTraitTree(buildTraitTree(dropped.groups, leavesBelow)).find((n) => n.leaf && hasStatEffects(n.leaf));
    if (offender) {
      return {
        kind: 'refused',
        refusal: {
          name: movedItem.name, kind: movedGroup ? 'group' : 'trait', offender: offender.leaf!.name,
          owner: from ? tree.entityNodes.get(from)!.name : null,
        },
      };
    }
  }

  const ownerBefore = (id: string) => tree.ownerOf.get(id) ?? null;
  const ownerAfter = (id: string) => (subtree.has(id) && from !== to ? to : ownerBefore(id));
  const spot = (parent: string | null | undefined, order: number | undefined) => `${parent ?? ''}|${order ?? ''}`;
  const spotBefore = new Map([
    ...tree.groups.map((g) => [g.id, spot(g.parentId, g.order)] as const),
    ...tree.traits.map((t) => [t.id, spot(t.groupId, t.order)] as const),
  ]);
  const touched = new Set<string | null>();
  const touchOwners = (id: string, parent: string | null | undefined, order: number | undefined) => {
    if (spotBefore.get(id) === spot(parent, order) && ownerBefore(id) === ownerAfter(id)) return;
    touched.add(ownerBefore(id));
    touched.add(ownerAfter(id));
  };
  for (const g of dropped.groups) if (!tree.entityNodes.has(g.id)) touchOwners(g.id, g.parentId, g.order);
  for (const t of dropped.leaves) touchOwners(t.id, t.groupId, t.order);

  // Unplaced nodes still ending the top level in entity order stay unplaced; the rest store where they landed.
  const placeable = placeableGroupIds(world.traitGroups);
  const unplaced = [...tree.entityNodes.values()].filter((e) => !effectivePlacement(e, placeable)).map((e) => e.id);
  const rootIds = [...dropped.groups.filter((g) => g.parentId === null), ...dropped.leaves.filter((t) => (t.groupId ?? null) === null)]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((item) => item.id);
  const stillUnplaced = new Set<string>();
  for (let i = rootIds.length - 1, j = unplaced.length - 1; i >= 0 && j >= 0 && rootIds[i] === unplaced[j]; i--, j--) {
    stillUnplaced.add(unplaced[j]);
  }
  const pinned = new Set([...tree.entityNodes.keys()].filter((id) => {
    if (stillUnplaced.has(id)) return false;
    const node = groupById.get(id)!;
    return unplaced.includes(id) || spotBefore.get(id) !== spot(node.parentId, node.order);
  }));
  pinned.forEach((id) => touched.add(id));
  if (!touched.size) return null;

  const worldGroups = dropped.groups.filter((g) => !tree.entityNodes.has(g.id) && ownerAfter(g.id) === null);
  const entitiesOut = [...tree.entityNodes.values()].filter((e) => touched.has(e.id)).map((entity): Entity => {
    // The entity node's id stands for the entity's root, which its own lists store as null.
    const fromNode = (parent: string | null | undefined) => (parent === entity.id ? null : parent ?? null);
    const traits = dropped.leaves.filter((t) => ownerAfter(t.id) === entity.id).map((t) => ({ ...t, groupId: fromNode(t.groupId) }));
    const groups = dropped.groups
      .filter((g) => !tree.entityNodes.has(g.id) && ownerAfter(g.id) === entity.id)
      .map((g) => ({ ...g, parentId: fromNode(g.parentId) }));
    const node = groupById.get(entity.id)!;
    const { traits: _t, traitGroups: _g, ...rest } = entity;
    return {
      ...rest,
      ...(traits.length ? { traits } : {}),
      ...(groups.length ? { traitGroups: groups } : {}),
      ...(pinned.has(entity.id) ? { traitPlacement: { groupId: node.parentId, order: node.order ?? 0 } } : {}),
    };
  });
  return {
    kind: 'moved',
    ...(touched.has(null) ? { world: { traits: dropped.leaves.filter((t) => ownerAfter(t.id) === null), groups: worldGroups } } : {}),
    entities: entitiesOut,
  };
}

/** The selected traits directly in one group (null: ungrouped), in authored order. */
const selectedTraitsIn = (traits: Trait[], sel: ReadonlySet<string>, groupId: string | null): Trait[] =>
  traits
    .filter((t) => (t.groupId ?? null) === groupId && sel.has(t.id))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/** The selected traits in the order `buildTraitContext` renders them: ungrouped first, then group by group. */
export function traitsInContextOrder(selectedIds: Iterable<string>, traits: Trait[], groups: TraitGroup[]): Trait[] {
  const sel = new Set(selectedIds);
  const selectedIn = (groupId: string | null) => selectedTraitsIn(traits, sel, groupId);
  const walk = (nodes: TraitTreeNode[]): Trait[] =>
    nodes.flatMap((node) => (node.kind === 'group' ? [...selectedIn(node.id), ...walk(node.children)] : []));
  return [...selectedIn(null), ...walk(buildTraitTree(groups, traits))];
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
  const selectedIn = (groupId: string | null) => selectedTraitsIn(traits, sel, groupId);

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
  const selectedIn = (groupId: string | null) => selectedTraitsIn(traits, sel, groupId);

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
