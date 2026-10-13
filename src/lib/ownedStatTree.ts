// The Stats tab's one tree: the world's stats with a node for each entity that owns a stat, a stat group or a stat
// Link, and the drops that move them across owners. A stat id may repeat across owners, so an entity's rows take
// row ids of their own (`entity/id`), and a drop maps them back.

import type { Entity, Stat, StatGroup, StatLink, TreePlacement } from '@/types';
import {
  applyDrop, buildTree, flattenTree, getDropProjection, isDescendantGroup, nodeDropWrites, projectionPastBlocked,
  removeChildrenOf, type FlatTreeNode,
} from './groupTree';
import type { HeldReason } from './heldReasons';
import { nodePlacement } from './traitTree';
import { statsInTreeOrder } from './statGroupTree';
import {
  entityStatRows, resolvedEntityStatTree, statBlueprintsSubtreeIds, statHeldReason, statOriginalOf, type LinkedStatRow,
} from './statLinks';
import { brokenStatReader, statReaderOutsideBlueprints, type StatReader, type StatReaderWorld } from './statMoveReaders';
import { randomUUID } from './uuid';

export type FlatStatRow = FlatTreeNode<StatGroup, Stat>;

/** A row of an entity's part of the tree. */
export interface OwnedStatRow {
  entityId: string;
  /** The id in the entity's own Stats tab tree: its stat, group or link, or a linked group's original. */
  id: string;
  /** Set when a link brings the row. */
  linked?: LinkedStatRow;
}

/** The Stats tab's one tree as flat group and stat lists. An entity node is a group whose id is the entity's. */
export interface OwnedStatTree {
  groups: StatGroup[];
  stats: Stat[];
  /** Entity node id → the entity it draws. */
  entityNodes: Map<string, Entity>;
  /** Entity row id → what it draws. World rows are absent. */
  owned: Map<string, OwnedStatRow>;
}

/** The row id an entity's stat, group or link takes in the one tree. */
export const ownedStatRowId = (entityId: string, id: string): string => `${entityId}/${id}`;

/** Whether the entity owns a stat, a stat group or a stat Link, which is what gives it a node in the Stats tree. */
export const ownsStats = (entity: Entity): boolean =>
  (entity.stats?.length ?? 0) + (entity.statGroups?.length ?? 0) + (entity.statLinks?.length ?? 0) > 0;

/** The world stat groups an entity node can sit in: every one outside Blueprints. */
export function statPlaceableGroupIds(groups: readonly StatGroup[]): Set<string> {
  const inBlueprints = statBlueprintsSubtreeIds(groups);
  return new Set(groups.filter((g) => !inBlueprints.has(g.id)).map((g) => g.id));
}

/** The entity node's place in the Stats tree; see {@link nodePlacement}. */
export const effectiveStatPlacement = (entity: Entity, placeableIds: ReadonlySet<string>): TreePlacement | null =>
  nodePlacement(entity.statPlacement, entity, placeableIds);

/** The world's stats, with a node for each entity that owns a stat, a stat group or a stat Link. A node sits where
 *  its placement puts it; an unplaced node goes to the end of the top level, in entity order. Each entity's rows
 *  are its Stats tab's, links expanded. `emptySystemNodes` off hides an empty Custom Persona entity. */
export function ownedStatTree(
  world: Pick<StatReaderWorld, 'stats' | 'statGroups'>, entities: readonly Entity[], { emptySystemNodes = true } = {},
): OwnedStatTree {
  const worldGroupIds = new Set(world.statGroups.map((g) => g.id));
  const placeable = statPlaceableGroupIds(world.statGroups);
  const atRoot = (ref: string | null | undefined) => ref == null || !worldGroupIds.has(ref);
  const owning = entities.filter((e) => ownsStats(e) || (emptySystemNodes && !!e.customPersona));
  const rootSorts = [
    ...world.statGroups.map((g, i) => (atRoot(g.parentId) ? g.order ?? i : -1)),
    ...world.stats.map((s, i) => (atRoot(s.groupId) ? s.order ?? i : -1)),
    ...owning.map((e) => effectiveStatPlacement(e, placeable)).map((p) => (p?.groupId === null ? p.order : -1)),
  ];
  const firstNodeOrder = Math.max(-1, ...rootSorts) + 1;

  const groups = [...world.statGroups];
  const stats = [...world.stats];
  const entityNodes = new Map<string, Entity>();
  const owned = new Map<string, OwnedStatRow>();
  let unplaced = 0;
  for (const entity of owning) {
    entityNodes.set(entity.id, entity);
    const placement = effectiveStatPlacement(entity, placeable);
    groups.push({
      id: entity.id, name: entity.name,
      parentId: placement?.groupId ?? null, order: placement ? placement.order : firstNodeOrder + unplaced++,
    });
    const rows = entityStatRows(world, entity);
    const rowGroupIds = new Set(rows.groups.map((g) => g.id));
    const rowId = (id: string) => ownedStatRowId(entity.id, id);
    const parent = (ref: string | null | undefined) => (ref != null && rowGroupIds.has(ref) ? rowId(ref) : entity.id);
    const mark = (id: string) => {
      const linked = rows.linked.get(id);
      owned.set(rowId(id), { entityId: entity.id, id, ...(linked ? { linked } : {}) });
    };
    for (const g of rows.groups) {
      groups.push({ ...g, id: rowId(g.id), parentId: parent(g.parentId) });
      mark(g.id);
    }
    for (const s of rows.stats) {
      stats.push({ ...s, id: rowId(s.id), groupId: parent(s.groupId) });
      mark(s.id);
    }
  }
  return { groups, stats, entityNodes, owned };
}

/** The one tree's visible rows, with collapsed groups' children hidden. */
export const ownedStatRows = (tree: OwnedStatTree, collapsedIds: Iterable<string>): FlatStatRow[] =>
  removeChildrenOf(flattenTree(buildTree(tree.groups, tree.stats)), collapsedIds);

/** Whether the row is an entity node, or a world group with one anywhere below it. */
const carriesEntityNode = (tree: OwnedStatTree, id: string): boolean =>
  [...tree.entityNodes.keys()].some((nodeId) => isDescendantGroup(tree.groups, id, nodeId));

/** The entity whose tree a parent row is in; null for the world. */
const ownerOfParent = (tree: OwnedStatTree, parentId: string | null): string | null =>
  (parentId === null ? null : tree.entityNodes.has(parentId) ? parentId : tree.owned.get(parentId)?.entityId ?? null);

/** The rows at or below `id`, as a parent walk finds them. */
function rowsBelow(tree: Pick<OwnedStatTree, 'groups' | 'stats'>, id: string): Set<string> {
  const parentOf = new Map<string, string | null>([
    ...tree.groups.map((g) => [g.id, g.parentId] as const),
    ...tree.stats.map((s) => [s.id, s.groupId ?? null] as const),
  ]);
  const below = new Set<string>();
  for (const rowId of parentOf.keys()) {
    for (let at: string | null | undefined = rowId; at; at = parentOf.get(at)) {
      if (at === id) { below.add(rowId); break; }
    }
  }
  return below;
}

/** The link roots a dragged row carries: itself when it is one, and every one below it. */
const linksCarried = (tree: OwnedStatTree, id: string): OwnedStatRow[] =>
  [...rowsBelow(tree, id)].flatMap((rowId) => {
    const row = tree.owned.get(rowId);
    return row?.linked?.root ? [row] : [];
  });

/**
 * Where a drag in the one tree would land. Blueprints stays at the top level. A row that is or holds an entity
 * node stops at the top level or a world group outside Blueprints. Nothing lands inside a linked group. A row
 * carrying a link stays in an entity. Null when the rows below would hold the row where it can't be.
 */
export function getOwnedStatDropProjection(
  tree: OwnedStatTree, items: FlatStatRow[], activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): { depth: number; parentId: string | null } | null {
  const projection = getDropProjection(items, activeId, overId, dragOffset, indentationWidth);
  const active = items.find((i) => i.id === activeId);
  if (!active) return null;
  const inEntity = (id: string) => tree.entityNodes.has(id) || tree.owned.has(id);
  const inBlueprints = statBlueprintsSubtreeIds(tree.groups);
  const blocked = active.group?.system === 'blueprints' ? () => true : carriesEntityNode(tree, activeId)
    ? (id: string) => inEntity(id) || inBlueprints.has(id)
    : (id: string) => !!tree.owned.get(id)?.linked;
  const replayed = projectionPastBlocked(items, active, overId, projection, blocked, indentationWidth);
  if (!replayed) return null;
  if (!tree.entityNodes.has(activeId) && ownerOfParent(tree, replayed.parentId) === null && linksCarried(tree, activeId).length) return null;
  return replayed;
}

/** Why a drop was refused. `owner` is the entity's name; null for the world. */
export type StatDropRefusal =
  /** The destination already holds the stat or group `name` by id. */
  | { reason: 'duplicate'; name: string; owner: string | null }
  /** The entity `owner` can't take a link, for the reason Link Stat gives. */
  | { reason: 'held'; owner: string; held: HeldReason }
  /** Something reads the stat `name` on its owner, and the move would take it away. */
  | { reason: 'read'; name: string; owner: string | null; reader: StatReader }
  /** A world stat `name` would join Blueprints while something outside reads it. */
  | { reason: 'into-blueprints'; name: string; reader: StatReader }
  /** A Blueprints item would leave Blueprints while the `bearers` link it or something in it. */
  | { reason: 'blueprint-linked'; name: string; bearers: string[] }
  /** The Custom Persona entity's node left the top level. */
  | { reason: 'root'; name: string };

/** What a drop in the one tree writes: the world's lists when they changed, and every entity that changed. */
export type OwnedStatDrop =
  | { kind: 'moved'; world?: { stats: Stat[]; groups: StatGroup[] }; entities: Entity[]; rowIds: ReadonlyMap<string, string> }
  | { kind: 'refused'; refusal: StatDropRefusal };

export interface OwnedStatDropOptions {
  /** Whether a Blueprint row dropped into an entity links it. Off, the drop does nothing. */
  createLinks?: boolean;
  emptySystemNodes?: boolean;
  newLinkId?: () => string;
}

/**
 * Resolve a drag in the one tree. A Blueprint row dropped into an entity links it there, refused as Link Stat
 * refuses. A stat or group may change owner and keeps every id, refused when its destination already holds an id
 * it brings, or when a trait row or stat code reads one of its stats where it was. A link stays inside entities.
 * An entity node moves like a group, among world items only, and the Custom Persona entity's node at the top
 * level only. `rowIds` maps the dragged row's old id to its new one. Null = nothing to write.
 */
export function applyOwnedStatDrop(
  world: StatReaderWorld, collapsedIds: Iterable<string>,
  activeId: string, overId: string, dragOffset: number, indentationWidth: number,
  { createLinks = true, emptySystemNodes = true, newLinkId = randomUUID }: OwnedStatDropOptions = {},
): OwnedStatDrop | null {
  const { entities } = world;
  const tree = ownedStatTree(world, entities, { emptySystemNodes });
  const collapsed = [...collapsedIds];
  const rows = ownedStatRows(tree, [...collapsed, activeId]);
  const projection = getOwnedStatDropProjection(tree, rows, activeId, overId, dragOffset, indentationWidth);
  const activeRow = rows.find((r) => r.id === activeId);
  if (!projection || !activeRow) return null;
  // The drop replays the projection's depth, which for an entity node may sit left of the pointer.
  const offset = (projection.depth - activeRow.depth) * indentationWidth;
  const dropped = applyDrop(tree.groups, tree.stats, collapsed, activeId, overId, offset, indentationWidth);
  if (dropped.groups === tree.groups && dropped.leaves === tree.stats) return null;

  const groupById = new Map(dropped.groups.map((g) => [g.id, g]));
  const ownerAt = (parent: string | null | undefined): string | null => {
    let at = parent ?? null;
    while (at && !tree.entityNodes.has(at)) at = groupById.get(at)?.parentId ?? null;
    return at;
  };
  const subtree = rowsBelow({ groups: dropped.groups, stats: dropped.leaves }, activeId);
  const isNode = tree.entityNodes.has(activeId);
  const from = tree.owned.get(activeId)?.entityId ?? null;
  const movedGroup = groupById.get(activeId);
  const parentAfter = movedGroup ? movedGroup.parentId : dropped.leaves.find((s) => s.id === activeId)?.groupId ?? null;
  const to = isNode ? null : ownerAt(parentAfter);
  const nodeEntity = isNode ? tree.entityNodes.get(activeId)! : null;
  if (nodeEntity?.customPersona && parentAfter !== null) return refused({ reason: 'root', name: nodeEntity.name });

  const entityById = new Map(entities.map((e) => [e.id, e]));
  const nameOf = (owner: string | null) => (owner === null ? null : entityById.get(owner)?.name ?? '');
  const realId = (rowId: string) => tree.owned.get(rowId)?.id ?? rowId;
  const unprefix = <T extends string | null | undefined>(ref: T): T | string => (ref == null ? ref : realId(ref));
  const ownerBefore = (rowId: string) => tree.owned.get(rowId)?.entityId ?? null;
  const ownerAfter = (rowId: string) => (subtree.has(rowId) && from !== to ? to : ownerBefore(rowId));
  const linkedRow = (rowId: string) => tree.owned.get(rowId)?.linked;

  const placeOf = (rowId: string, entityId: string) => {
    const item = groupById.get(rowId) ?? dropped.leaves.find((s) => s.id === rowId)!;
    const parent = 'parentId' in item ? item.parentId : item.groupId ?? null;
    return { groupId: parent === entityId ? null : unprefix(parent) ?? null, order: item.order ?? 0 };
  };
  /** The entity's own lists and links as the drop leaves them, with each row under `ownerOf`. `added` joins its
   *  links at the dragged row's place. */
  const writeEntity = (entity: Entity, ownerOf: (rowId: string) => string | null, placement?: TreePlacement, added?: StatLink): Entity => {
    const mine = (rowId: string) => ownerOf(rowId) === entity.id;
    const own = (rowId: string) => mine(rowId) && !linkedRow(rowId) && !tree.entityNodes.has(rowId);
    const fromNode = (parent: string | null | undefined) => (parent === entity.id ? null : unprefix(parent) ?? null);
    const groups = dropped.groups.filter((g) => own(g.id)).map((g) => ({ ...g, id: realId(g.id), parentId: fromNode(g.parentId) }));
    const stats = statsInTreeOrder(groups, dropped.leaves.filter((s) => own(s.id)).map((s) => ({ ...s, id: realId(s.id), groupId: fromNode(s.groupId) })));
    const links = [...tree.owned].filter(([rowId, row]) => row.linked?.root && mine(rowId))
      .map(([rowId, row]) => ({ ...row.linked!.link, ...placeOf(rowId, entity.id) }));
    if (added) links.push({ ...added, ...placeOf(activeId, entity.id) });
    const { stats: _s, statGroups: _g, statLinks: _l, ...rest } = entity;
    return {
      ...rest,
      ...(stats.length ? { stats } : {}),
      ...(groups.length ? { statGroups: groups } : {}),
      ...(links.length ? { statLinks: links } : {}),
      ...(placement ? { statPlacement: placement } : {}),
    };
  };
  const rowIdAfter = (owner: string | null) => (owner === null ? realId(activeId) : ownedStatRowId(owner, realId(activeId)));

  // A Blueprint row dropped into an entity links it there; the original stays where it is.
  const original = !isNode && from === null ? statOriginalOf(world, activeId) : null;
  if (original && to !== null) {
    if (!createLinks) return null;
    const target = entityById.get(to)!;
    const held = statHeldReason(world, target, activeId);
    if (held) return refused({ reason: 'held', owner: target.name, held });
    const link: StatLink = { id: newLinkId(), originalId: activeId, kind: original.kind, originalName: original.item.name, groupId: null, order: 0 };
    return { kind: 'moved', entities: [writeEntity(target, ownerBefore, undefined, link)], rowIds: new Map([[activeId, ownedStatRowId(to, link.id)]]) };
  }
  // A linked Blueprint stays in Blueprints, so every link points into it.
  if (original) {
    const leaves = parentAfter == null || !statBlueprintsSubtreeIds(dropped.groups).has(parentAfter);
    const bearers = leaves ? entities.filter((e) => e.statLinks?.some((l) => subtree.has(l.originalId))).map((e) => e.name) : [];
    if (bearers.length) return refused({ reason: 'blueprint-linked', name: original.item.name, bearers });
  }
  // A world stat that joins Blueprints stops being a player stat, so nothing outside may read it.
  if (!isNode && from === null && !original && parentAfter != null && statBlueprintsSubtreeIds(dropped.groups).has(parentAfter)) {
    const read = statReaderOutsideBlueprints(world, world.stats.filter((s) => subtree.has(s.id)));
    if (read) return refused({ reason: 'into-blueprints', name: read.stat.name, reader: read.reader });
  }
  if (!isNode && from !== to) {
    const refusal = crossOwnerRefusal([...subtree].filter((id) => !tree.entityNodes.has(id)));
    if (refusal) return refused(refusal);
  }

  const placeable = statPlaceableGroupIds(world.statGroups);
  const unplaced = [...tree.entityNodes.values()].filter((e) => !effectiveStatPlacement(e, placeable)).map((e) => e.id);
  const { touched, pinned } = nodeDropWrites(
    { groups: tree.groups, leaves: tree.stats }, { groups: dropped.groups, leaves: dropped.leaves },
    new Set(tree.entityNodes.keys()), unplaced, ownerBefore, ownerAfter,
  );
  if (!touched.size) return null;

  const worldOwned = (rowId: string) => ownerAfter(rowId) === null && !tree.entityNodes.has(rowId);
  const worldGroups = dropped.groups.filter((g) => worldOwned(g.id)).map((g) => ({ ...g, id: realId(g.id), parentId: unprefix(g.parentId) ?? null }));
  const worldStats = statsInTreeOrder(worldGroups, dropped.leaves.filter((s) => worldOwned(s.id))
    .map((s) => ({ ...s, id: realId(s.id), ...(s.groupId !== undefined ? { groupId: unprefix(s.groupId) } : {}) })));
  const entitiesOut = [...tree.entityNodes.values()].filter((e) => touched.has(e.id)).map((entity) => {
    const node = groupById.get(entity.id)!;
    return writeEntity(entity, ownerAfter, pinned.has(entity.id) ? { groupId: node.parentId, order: node.order ?? 0 } : undefined);
  });
  return {
    kind: 'moved',
    ...(touched.has(null) ? { world: { stats: worldStats, groups: worldGroups } } : {}),
    entities: entitiesOut,
    rowIds: new Map([[activeId, isNode ? activeId : rowIdAfter(ownerAfter(activeId))]]),
  };

  function refused(refusal: StatDropRefusal): OwnedStatDrop {
    return { kind: 'refused', refusal };
  }
  /** Why the rows moving from `from` to `to` can't, or null when they can. */
  function crossOwnerRefusal(movedRows: string[]): StatDropRefusal | null {
    const destEntity = to === null ? undefined : entityById.get(to);
    // Each link it carries must be one the destination can take.
    for (const rowId of movedRows) {
      const row = linkedRow(rowId);
      const held = row?.root && destEntity && statHeldReason(world, destEntity, row.link.originalId);
      if (held) return { reason: 'held', owner: destEntity.name, held };
    }
    // Own stats and groups keep their ids, so the destination must not hold one.
    const destTree = destEntity ? resolvedEntityStatTree(world, destEntity) : { stats: world.stats, groups: world.statGroups };
    const heldIds = new Set([...destTree.stats.map((s) => s.id), ...destTree.groups.map((g) => g.id)]);
    for (const rowId of movedRows) {
      if (linkedRow(rowId) || !heldIds.has(realId(rowId))) continue;
      const item = tree.groups.find((g) => g.id === rowId) ?? tree.stats.find((s) => s.id === rowId)!;
      return { reason: 'duplicate', name: item.name, owner: nameOf(to) };
    }
    // Every stat that leaves its owner, own or linked, must have nothing there that reads it.
    const sourceEntity = from === null ? undefined : entityById.get(from);
    const sourceTree = sourceEntity ? resolvedEntityStatTree(world, sourceEntity) : { stats: world.stats, linkOf: new Map<string, StatLink>() };
    const movedLinks = new Set(movedRows.flatMap((rowId) => (linkedRow(rowId)?.root ? [linkedRow(rowId)!.link.id] : [])));
    const ownMoved = new Set(movedRows.filter((rowId) => !linkedRow(rowId)).map(realId));
    const moved = sourceTree.stats.filter((s) => ownMoved.has(s.id) || movedLinks.has(sourceTree.linkOf.get(s.id)?.id ?? ''));
    const broken = brokenStatReader(world, from, to, moved);
    return broken && { reason: 'read', name: broken.stat.name, owner: nameOf(from), reader: broken.reader };
  }
}
