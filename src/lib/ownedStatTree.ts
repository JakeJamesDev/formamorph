// The Stats tab's one tree: the world's stats with a node for each entity that owns a stat, a stat group or a stat
// Link, and the drops that move them across owners, on the owner-tree engine. A stat id may repeat across owners,
// so an entity's rows take row ids of their own (`entity/id`), and a drop maps them back.

import type { Entity, Stat, StatGroup, StatLink } from '@/types';
import type { FlatTreeNode } from './groupTree';
import type { HeldReason } from './heldReasons';
import {
  applyOwnerTreeDrop, buildOwnerTree, ownerTreeDropProjection, ownerTreeRows, withEntityLists,
  type OwnerRowIds, type OwnerTree, type OwnerTreeDrop, type OwnerTreeDropRules, type OwnerTreeDropState, type OwnerTreeSource,
} from './ownerTree';
import { statsInTreeOrder } from './statGroupTree';
import {
  entityStatRows, resolvedEntityStatTree, statHeldReason, statOriginalOf, type LinkedStatRow,
} from './statLinks';
import { blueprintsSubtreeIds } from './blueprintGroups';
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

/** A row a stat link draws, with the entity it draws in. */
export type StatLinkRow = LinkedStatRow & { entityId: string };

/** The Stats tab's one tree as flat group and stat lists. An entity node is a group whose id is the entity's. */
export interface OwnedStatTree {
  groups: StatGroup[];
  stats: Stat[];
  /** Entity node id → the entity it draws. */
  entityNodes: Map<string, Entity>;
  /** Entity row id → its entity's id. World rows are absent. */
  ownerOf: Map<string, string>;
  /** Row id → the link that draws it. */
  linkRows: Map<string, StatLinkRow>;
  /** Entity row id → what it draws. World rows are absent. */
  owned: Map<string, OwnedStatRow>;
}

/** The row id an entity's stat, group or link takes in the one tree. */
export const ownedStatRowId = (entityId: string, id: string): string => `${entityId}/${id}`;

const statRowIds: OwnerRowIds = { rowId: ownedStatRowId, itemId: (entityId, rowId) => rowId.slice(entityId.length + 1) };

/** Whether the entity owns a stat, a stat group or a stat Link, which is what gives it a node in the Stats tree. */
export const ownsStats = (entity: Entity): boolean =>
  (entity.stats?.length ?? 0) + (entity.statGroups?.length ?? 0) + (entity.statLinks?.length ?? 0) > 0;

type StatWorldLists = Pick<StatReaderWorld, 'stats' | 'statGroups'>;
type StatOwnerTree = OwnerTree<StatGroup, Stat, StatLinkRow>;

/** The owner-tree source for owned stats: `entity/id` row ids, links expanded as play reads them. */
export function statTreeSource(
  world: StatWorldLists, entities: readonly Entity[], { emptySystemNodes = true } = {},
): OwnerTreeSource<StatGroup, Stat, StatLinkRow> {
  return {
    groups: world.statGroups, leaves: world.stats,
    entities: entities.filter((e) => ownsStats(e) || (emptySystemNodes && !!e.customPersona)),
    placement: (e) => e.statPlacement,
    rowIds: statRowIds,
    nodeGroup: (e, parentId, order) => ({ id: e.id, name: e.name, parentId, order }),
    pushRows: (tree, entity) => {
      const rows = entityStatRows(world, entity);
      const rowGroupIds = new Set(rows.groups.map((g) => g.id));
      const rowId = (id: string) => ownedStatRowId(entity.id, id);
      const parent = (ref: string | null | undefined) => (ref != null && rowGroupIds.has(ref) ? rowId(ref) : entity.id);
      const mark = (id: string) => {
        tree.ownerOf.set(rowId(id), entity.id);
        const linked = rows.linked.get(id);
        if (linked) tree.linkRows.set(rowId(id), { ...linked, entityId: entity.id });
      };
      for (const g of rows.groups) {
        tree.groups.push({ ...g, id: rowId(g.id), parentId: parent(g.parentId) });
        mark(g.id);
      }
      for (const s of rows.stats) {
        tree.leaves.push({ ...s, id: rowId(s.id), groupId: parent(s.groupId) });
        mark(s.id);
      }
    },
  };
}

const fromOwnerTree = ({ leaves, ...rest }: StatOwnerTree): OwnedStatTree => ({
  ...rest,
  stats: leaves,
  owned: new Map([...rest.ownerOf].map(([rowId, entityId]): [string, OwnedStatRow] => {
    const linked = rest.linkRows.get(rowId);
    return [rowId, { entityId, id: statRowIds.itemId(entityId, rowId), ...(linked ? { linked } : {}) }];
  })),
});
const toOwnerTree = ({ stats, owned: _o, ...rest }: OwnedStatTree): StatOwnerTree => ({ ...rest, leaves: stats });

/** The world's stats, with a node for each entity that owns a stat, a stat group or a stat Link. A node sits where
 *  its placement puts it; an unplaced node goes to the end of the top level, in entity order. Each entity's rows
 *  are its Stats tab's, links expanded. `emptySystemNodes` off hides an empty Custom Persona entity. */
export const ownedStatTree = (world: StatWorldLists, entities: readonly Entity[], options: { emptySystemNodes?: boolean } = {}): OwnedStatTree =>
  fromOwnerTree(buildOwnerTree(statTreeSource(world, entities, options)));

/** The one tree's visible rows, with collapsed groups' children hidden. */
export const ownedStatRows = (tree: OwnedStatTree, collapsedIds: Iterable<string>): FlatStatRow[] =>
  ownerTreeRows(toOwnerTree(tree), collapsedIds);

/** Where a drag in the one tree would land; see {@link ownerTreeDropProjection}. */
export const getOwnedStatDropProjection = (
  tree: OwnedStatTree, items: FlatStatRow[], activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): { depth: number; parentId: string | null } | null =>
  ownerTreeDropProjection(toOwnerTree(tree), items, activeId, overId, dragOffset, indentationWidth);

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
  /** A Blueprints item would leave Blueprints while the `owners` link it or something in it. */
  | { reason: 'blueprint-linked'; name: string; owners: string[] }
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
  { emptySystemNodes = true, ...options }: OwnedStatDropOptions = {},
): OwnedStatDrop | null {
  const drop = applyOwnerTreeDrop(
    statTreeSource(world, world.entities, { emptySystemNodes }), statDropRules(world, options),
    collapsedIds, activeId, overId, dragOffset, indentationWidth,
  );
  if (drop?.kind !== 'moved') return drop;
  return {
    kind: 'moved',
    ...(drop.world ? { world: { stats: drop.world.leaves, groups: drop.world.groups } } : {}),
    entities: drop.entities,
    rowIds: new Map([[activeId, drop.rowId]]),
  };
}

type StatDrop = OwnerTreeDrop<StatGroup, Stat, StatDropRefusal>;
const refused = (refusal: StatDropRefusal): StatDrop => ({ kind: 'refused', refusal });

/**
 * The owner-tree drop rules for owned stats. A Blueprint row dropped into an entity links it there; with links
 * off it writes nothing. A linked Blueprint stays in Blueprints. A world stat joins Blueprints only while nothing
 * outside reads it. A row that changes owner is refused for a duplicate id, a link the destination can't take, or
 * a reader it leaves behind. Stats are stored in tree order.
 */
export function statDropRules(
  world: StatReaderWorld, { createLinks = true, newLinkId = randomUUID }: Omit<OwnedStatDropOptions, 'emptySystemNodes'> = {},
): OwnerTreeDropRules<StatGroup, Stat, StatLink, StatLinkRow, StatDropRefusal> {
  const { entities } = world;
  const entityById = new Map(entities.map((e) => [e.id, e]));
  const nameOf = (owner: string | null) => (owner === null ? null : entityById.get(owner)?.name ?? '');
  return {
    check: (drop) => {
      const { dropped, activeId, isNode, from, to, parentAfter, subtree, ownerBefore, rowIdIn, writeEntity } = drop;
      // A Blueprint row dropped into an entity links it there; the original stays where it is.
      const original = !isNode && from === null ? statOriginalOf(world, activeId) : null;
      if (original && to !== null) {
        if (!createLinks) return null;
        const target = entityById.get(to)!;
        const held = statHeldReason(world, target, activeId);
        if (held) return refused({ reason: 'held', owner: target.name, held });
        const link: StatLink = { id: newLinkId(), originalId: activeId, kind: original.kind, originalName: original.item.name, groupId: null, order: 0 };
        return { kind: 'moved', entities: [writeEntity(target, ownerBefore, undefined, link)], rowId: rowIdIn(to, link.id) };
      }
      // A linked Blueprint stays in Blueprints, so every link points into it.
      if (original) {
        const leaves = parentAfter == null || !blueprintsSubtreeIds(dropped.groups).has(parentAfter);
        const owners = leaves ? entities.filter((e) => e.statLinks?.some((l) => subtree.has(l.originalId))).map((e) => e.name) : [];
        if (owners.length) return refused({ reason: 'blueprint-linked', name: original.item.name, owners });
      }
      // A world stat that joins Blueprints stops being a global stat, so nothing outside may read it.
      if (!isNode && from === null && !original && parentAfter != null && blueprintsSubtreeIds(dropped.groups).has(parentAfter)) {
        const read = statReaderOutsideBlueprints(world, world.stats.filter((s) => subtree.has(s.id)));
        if (read) return refused({ reason: 'into-blueprints', name: read.stat.name, reader: read.reader });
      }
      if (!isNode && from !== to) {
        const refusal = crossOwnerRefusal(drop);
        if (refusal) return refused(refusal);
      }
      return undefined;
    },
    write: (entity, { groups, leaves, links }, placement) => {
      const written = withEntityLists(entity, { stats: statsInTreeOrder(groups, leaves), statGroups: groups, statLinks: links });
      return placement ? { ...written, statPlacement: placement } : written;
    },
    writeWorld: ({ groups, leaves }) => ({ groups, leaves: statsInTreeOrder(groups, leaves) }),
  };

  /** Why the rows moving from `from` to `to` can't, or null when they can. */
  function crossOwnerRefusal(
    { tree, subtree, from, to, itemId }: Pick<OwnerTreeDropState<StatGroup, Stat, StatLink, StatLinkRow>, 'tree' | 'subtree' | 'from' | 'to' | 'itemId'>,
  ): StatDropRefusal | null {
    const movedRows = [...subtree].filter((id) => !tree.entityNodes.has(id));
    const destEntity = to === null ? undefined : entityById.get(to);
    // Each link it carries must be one the destination can take.
    for (const rowId of movedRows) {
      const row = tree.linkRows.get(rowId);
      const held = row?.root && destEntity && statHeldReason(world, destEntity, row.link.originalId);
      if (held) return { reason: 'held', owner: destEntity.name, held };
    }
    // Own stats and groups keep their ids, so the destination must not hold one.
    const destTree = destEntity ? resolvedEntityStatTree(world, destEntity) : { stats: world.stats, groups: world.statGroups };
    const heldIds = new Set([...destTree.stats.map((s) => s.id), ...destTree.groups.map((g) => g.id)]);
    for (const rowId of movedRows) {
      if (tree.linkRows.has(rowId) || !heldIds.has(itemId(rowId))) continue;
      const item = tree.groups.find((g) => g.id === rowId) ?? tree.leaves.find((s) => s.id === rowId)!;
      return { reason: 'duplicate', name: item.name, owner: nameOf(to) };
    }
    // Every stat that leaves its owner, own or linked, must have nothing there that reads it.
    const sourceEntity = from === null ? undefined : entityById.get(from);
    const sourceTree = sourceEntity ? resolvedEntityStatTree(world, sourceEntity) : { stats: world.stats, linkOf: new Map<string, StatLink>() };
    const movedLinks = new Set(movedRows.flatMap((rowId) => {
      const row = tree.linkRows.get(rowId);
      return row?.root ? [row.link.id] : [];
    }));
    const ownMoved = new Set(movedRows.filter((rowId) => !tree.linkRows.has(rowId)).map(itemId));
    const moved = sourceTree.stats.filter((s) => ownMoved.has(s.id) || movedLinks.has(sourceTree.linkOf.get(s.id)?.id ?? ''));
    const broken = brokenStatReader(world, from, to, moved);
    return broken && { reason: 'read', name: broken.stat.name, owner: nameOf(from), reader: broken.reader };
  }
}
