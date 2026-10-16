// The trait folder tree (groups + traits, nestable via parentId/groupId) — a binding of the generic groupTree
// machinery to Trait/TraitGroup, plus the trait-only `buildTraitContext` that renders the selected traits into
// the block sent to the AI. The editor and selection screen build/walk the tree from the two flat world arrays.

import {
  buildTree, flattenTree, getDropProjection, applyDrop, duplicateNode, aiVisibleTree, projectionPastBlocked,
  removeChildrenOf as removeChildrenOfGeneric, isDescendantGroup as isDescendantGroupGeneric,
  type GroupTreeNode, type FlatTreeNode,
} from './groupTree';
import type { Entity, StatChange, Trait, TraitGroup, TraitLink } from '@/types';
import { xmlEscape } from './utils';
import { blueprintsGroup, blueprintsSubtreeIds, groupsBelow } from './blueprintGroups';
import { ownsOrLinksTraits, heldReason, makeLink, originalOf, resolveOwners } from './owners';
import type { HeldReason } from './heldReasons';
import {
  applyOwnerTreeDrop, buildOwnerTree, linksCarried, ownerTreeDropProjection, ownerTreeRows, withEntityLists,
  type OwnerTree, type OwnerTreeDrop, type OwnerTreeDropRules, type OwnerTreeSource,
} from './ownerTree';
import { traitReaderOutsideBlueprints, type TraitReader, type TraitReaderWorld } from './traitMoveReaders';
import { randomUUID } from './uuid';

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

/** Where a dragged row would land: its depth and the group it would sit in. */
export type DropProjection = { depth: number; parentId: string | null };

/** Projected drop `{depth, parentId}` for the active row, given the pointer's horizontal drag offset. */
export const getTraitDropProjection = (
  items: FlatTraitNode[], activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): DropProjection =>
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
  /** Owned item or link row id → its entity's id. World items are absent. */
  ownerOf: Map<string, string>;
  /** Row id → the link that draws it: the link's own row, or a row of its original's live subtree. */
  linkRows: Map<string, LinkRow>;
}

/** A row a link draws. `originalId` is the world trait or group the row reads. */
export interface LinkRow {
  entityId: string;
  link: TraitLink;
  originalId: string;
  /** The link's own row, which the author drags, detaches and removes. Subtree rows are read-only. */
  root: boolean;
  /** A library entity's link with no original to read: one read-only row by its stored name. */
  unbound?: boolean;
}

/** The row id of a node in a linked group's subtree. The original's own id already has a world row. */
export const linkRowId = (linkId: string, originalId: string): string => `${linkId}/${originalId}`;

export { blueprintsGroup, blueprintsSubtreeIds, groupsBelow };

/** Every world trait and group inside Blueprints, the group itself left out: the only items a link may point at. */
export function blueprintItemIds(lists: WorldTraitLists): Set<string> {
  const inBlueprints = blueprintsSubtreeIds(lists.traitGroups);
  const ids = new Set(inBlueprints);
  ids.delete(blueprintsGroup(lists.traitGroups)?.id ?? '');
  for (const t of lists.traits) if (t.groupId != null && inBlueprints.has(t.groupId)) ids.add(t.id);
  return ids;
}

/** Whether the world trait or group sits inside Blueprints. */
export const isBlueprintItem = (lists: WorldTraitLists, id: string): boolean => blueprintItemIds(lists).has(id);

/** The world's traits and groups without Blueprints and everything below it: what the root offers the player.
 *  The owner resolver builds global scope's tree from it; the trait runtime falls back to it only for a world
 *  given without owners. */
export function offeredWorldTraits<T extends Trait, G extends TraitGroup>(
  traits: readonly T[], groups: readonly G[],
): { traits: readonly T[]; groups: readonly G[] } {
  const inBlueprints = blueprintsSubtreeIds(groups);
  if (!inBlueprints.size) return { traits, groups };
  return {
    traits: traits.filter((t) => t.groupId == null || !inBlueprints.has(t.groupId)),
    groups: groups.filter((g) => !inBlueprints.has(g.id)),
  };
}

type WorldTraitLists = { traits: readonly Trait[]; traitGroups: readonly TraitGroup[] };

/** Whether a world group holds a trait or a group directly. */
export const groupHoldsItems = (lists: Pick<WorldTraitLists, 'traits' | 'traitGroups'>, groupId: string): boolean =>
  lists.traitGroups.some((g) => g.parentId === groupId) || lists.traits.some((t) => t.groupId === groupId);

/** Whether the editor's tree shows the system node: always in Advanced, and in Basic only when it holds something. */
const showsSystemNode = (holds: boolean, emptySystemNodes: boolean) => holds || emptySystemNodes;

/** The world's traits, with a node for each entity that owns a trait or a group. A node sits where its
 *  placement puts it; an unplaced node goes to the end of the top level, in entity order. Library entities
 *  (a persona or an added entity) come last at the top level, in the order given. Without `links`, the
 *  player's view, Blueprints and everything in it drop out. With `links`, the editor's view, an entity's links
 *  draw too, and an entity with links only gets a node, as does the Custom Persona entity while empty.
 *  `emptySystemNodes` off hides an empty Blueprints group and an empty Custom Persona entity. */
export const ownedTraitTree = (
  lists: WorldTraitLists, entities: readonly Entity[], library: readonly Entity[] = [], options: TraitTreeOptions = {},
): OwnedTraitTree => fromOwnerTree(buildOwnerTree(traitTreeSource(lists, entities, library, options)));

/** Which rows the one tree draws; see {@link ownedTraitTree}. */
export interface TraitTreeOptions { links?: boolean; emptySystemNodes?: boolean }

type TraitOwnerTree = OwnerTree<TraitGroup, Trait, LinkRow>;
const fromOwnerTree = ({ leaves, ...rest }: TraitOwnerTree): OwnedTraitTree => ({ ...rest, traits: leaves });
const toOwnerTree = ({ traits, ...rest }: OwnedTraitTree): TraitOwnerTree => ({ ...rest, leaves: traits });

/** The owner-tree source for owned traits: raw row ids, links drawn only in the editor's view. */
export function traitTreeSource(
  lists: WorldTraitLists, entities: readonly Entity[], library: readonly Entity[] = [],
  { links = false, emptySystemNodes = true }: TraitTreeOptions = {},
): OwnerTreeSource<TraitGroup, Trait, LinkRow> {
  const offered = links ? null : offeredWorldTraits(lists.traits, lists.traitGroups);
  const blueprints = links ? blueprintsGroup(lists.traitGroups) : undefined;
  const hideBlueprints = !!blueprints && !showsSystemNode(groupHoldsItems(lists, blueprints.id), emptySystemNodes);
  const world: WorldTraitLists = offered
    ? { traits: offered.traits, traitGroups: offered.groups }
    : hideBlueprints ? { ...lists, traitGroups: lists.traitGroups.filter((g) => g !== blueprints) } : lists;
  const hasNode = links ? (e: Entity) => ownsOrLinksTraits(e) || (emptySystemNodes && !!e.customPersona) : ownsTraits;
  return {
    groups: world.traitGroups, leaves: world.traits,
    entities: entities.filter(hasNode), library: library.filter(hasNode),
    placement: (e) => e.traitPlacement,
    nodeGroup: (e, parentId, order) => ({ id: e.id, name: e.name, parentId, order }),
    pushRows: (tree, entity) => {
      const ownGroupIds = new Set((entity.traitGroups ?? []).map((g) => g.id));
      const parent = (ref: string | null | undefined) => (ref != null && ownGroupIds.has(ref) ? ref : entity.id);
      for (const g of entity.traitGroups ?? []) {
        tree.groups.push({ ...g, parentId: parent(g.parentId) });
        tree.ownerOf.set(g.id, entity.id);
      }
      for (const t of entity.traits ?? []) {
        tree.leaves.push({ ...t, groupId: parent(t.groupId) });
        tree.ownerOf.set(t.id, entity.id);
      }
      for (const link of links ? entity.traitLinks ?? [] : []) {
        const original = originalOf(world, link.originalId);
        if (original) pushLinkRows({ ...tree, traits: tree.leaves }, world, entity.id, link, original, parent);
      }
    },
  };
}

/** One link's rows: the original at the link's place and, for a group, its live subtree below it. */
function pushLinkRows(
  tree: Pick<OwnedTraitTree, 'groups' | 'traits' | 'ownerOf' | 'linkRows'>, world: Pick<WorldTraitLists, 'traits' | 'traitGroups'>,
  entityId: string, link: TraitLink, original: NonNullable<ReturnType<typeof originalOf>>,
  parent: (ref: string | null | undefined) => string | null,
) {
  const row = (rowId: string, originalId: string, root: boolean) => {
    tree.linkRows.set(rowId, { entityId, link, originalId, root });
    tree.ownerOf.set(rowId, entityId);
  };
  const at = { order: link.order ?? 0 };
  row(link.id, link.originalId, true);
  if (original.kind === 'trait') {
    tree.traits.push({ ...original.item, id: link.id, groupId: parent(link.groupId), ...at });
    return;
  }
  tree.groups.push({ ...original.item, id: link.id, parentId: parent(link.groupId), ...at });
  // Every subtree node's parent is the original or a group below it.
  const inLink = (ref: string | null | undefined) => (ref === original.item.id ? link.id : linkRowId(link.id, ref!));
  const subGroups = groupsBelow(world.traitGroups, original.item.id);
  for (const g of subGroups) {
    tree.groups.push({ ...g, id: linkRowId(link.id, g.id), parentId: inLink(g.parentId) });
    row(linkRowId(link.id, g.id), g.id, false);
  }
  const below = new Set([original.item.id, ...subGroups.map((g) => g.id)]);
  for (const t of world.traits) {
    if (t.groupId == null || !below.has(t.groupId)) continue;
    tree.traits.push({ ...t, id: linkRowId(link.id, t.id), groupId: inLink(t.groupId) });
    row(linkRowId(link.id, t.id), t.id, false);
  }
}

/** Whether a Link's own row offers Remove Link: always with an Original, and with no Original only inside a world. */
export const linkRowRemovable = (row: LinkRow, world: object | null): boolean => !row.unbound || !!world;

/**
 * One entity's Traits tree: its own items at the root, with its links among them. Inside a world a link
 * reads its original there; standalone, or when the world has no such original, it draws as one unbound row
 * by its stored name. Own items have no owner, as the editor edits them as the root.
 */
export function entityRootTraitTree(entity: Entity, world: Pick<WorldTraitLists, 'traits' | 'traitGroups'> | null): OwnedTraitTree {
  const tree: OwnedTraitTree = {
    groups: [...entity.traitGroups ?? []], traits: [...entity.traits ?? []],
    entityNodes: new Map(), ownerOf: new Map(), linkRows: new Map(),
  };
  const own = new Set(tree.groups.map((g) => g.id));
  const parent = (ref: string | null | undefined) => (ref != null && own.has(ref) ? ref : null);
  for (const link of entity.traitLinks ?? []) {
    const original = world && originalOf(world, link.originalId);
    if (world && original) {
      pushLinkRows(tree, world, entity.id, link, original, parent);
      continue;
    }
    tree.traits.push({ id: link.id, name: link.originalName, statChanges: [], groupId: parent(link.groupId), order: link.order ?? 0 });
    tree.linkRows.set(link.id, { entityId: entity.id, link, originalId: link.originalId, root: true, unbound: true });
    tree.ownerOf.set(link.id, entity.id);
  }
  return tree;
}

/** Why a drop was refused: the owner's tree already holds the original `name`; the Custom Persona entity
 *  `name` left the top level; something outside Blueprints reads `name` as it would join; or a linked Blueprint
 *  would leave Blueprints. */
export type TraitDropRefusal =
  | { reason: 'duplicate'; name: string; owner: string }
  | { reason: 'root'; name: string }
  /** A trait or group `name` would join Blueprints while something outside reads it. */
  | { reason: 'into-blueprints'; name: string; reader: TraitReader }
  /** A Blueprints item moved out of Blueprints, or into an entity, while the `owners` link it or something below it. */
  | { reason: 'blueprint-linked'; name: string; owners: string[] };

export interface OwnedTraitDropOptions {
  /** Whether a world row dropped into an entity links it. Off, the row moves in as the entity's own item. */
  createLinks?: boolean;
  /** The stats whose code may read a trait joining Blueprints. Absent, only requirements count as readers. */
  codeWorld?: Pick<TraitReaderWorld, 'stats' | 'statGroups' | 'placeholders'>;
}

/** What a drop in the one tree writes: the world's lists when they changed, and every entity that changed. */
export type OwnedTraitDrop =
  | { kind: 'moved'; world?: { traits: Trait[]; groups: TraitGroup[] }; entities: Entity[] }
  | { kind: 'refused'; refusal: TraitDropRefusal };

/** Whether the trait changes stats: stat changes or stat toggles. */
export const hasStatEffects = (t: Trait): boolean => t.statChanges.length > 0 || (t.statToggles?.length ?? 0) > 0;

/** The trait's stat changes and stat toggles, each naming one stat. */
export const statRows = (t: Trait): readonly StatRow[] => [...t.statChanges, ...(t.statToggles ?? [])];

/** One stat change or stat toggle, as routing reads it. */
export type StatRow = Pick<StatChange, 'statId' | 'target'>;

/** Whose stat an owner's trait row moves; null when it names neither. */
export type StatRowSide = 'own' | 'global' | null;

/** Whose stat an entity's trait row moves, played or not (Q18, Q30): its own stat by id, else the global stat
 *  with that id; with `target`, only the global stat. */
export function statRowSide(row: StatRow, own: ReadonlySet<string>, global: ReadonlySet<string>): StatRowSide {
  const reachesGlobal = global.has(row.statId);
  if (row.target === 'global') return reachesGlobal ? 'global' : null;
  return own.has(row.statId) ? 'own' : reachesGlobal ? 'global' : null;
}

/** The one tree's visible rows, with collapsed groups' children hidden. */
export const ownedTraitRows = (tree: OwnedTraitTree, collapsedIds: Iterable<string>): FlatTraitNode[] =>
  ownerTreeRows(toOwnerTree(tree), collapsedIds);

/** Where a drag in the one tree would land; see {@link ownerTreeDropProjection}. */
export const getOwnedTraitDropProjection = (
  tree: OwnedTraitTree, items: FlatTraitNode[], activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): DropProjection | null =>
  ownerTreeDropProjection(toOwnerTree(tree), items, activeId, overId, dragOffset, indentationWidth);

/** Where a drag in a one-entity tree would land. Nothing lands inside a link's rows, which are its original's. */
export function getEntityRootDropProjection(
  tree: OwnedTraitTree, items: FlatTraitNode[], activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): DropProjection | null {
  const active = items.find((i) => i.id === activeId);
  if (!active) return null;
  const projection = getDropProjection(items, activeId, overId, dragOffset, indentationWidth);
  return projectionPastBlocked(items, active, overId, projection, (id) => tree.linkRows.has(id), indentationWidth);
}

/**
 * Resolve a drag in a one-entity tree: the entity's own items reorder and nest among its links, and each
 * link's own row keeps its place in the order. A linked group's inner rows are read from the original and
 * never written. Null = nothing to write.
 */
export function applyEntityRootDrop(
  entity: Entity, world: Pick<WorldTraitLists, 'traits' | 'traitGroups'> | null,
  collapsedIds: Iterable<string>, activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): Entity | null {
  const tree = entityRootTraitTree(entity, world);
  const collapsed = [...collapsedIds];
  const rows = ownedTraitRows(tree, [...collapsed, activeId]);
  const projection = getEntityRootDropProjection(tree, rows, activeId, overId, dragOffset, indentationWidth);
  const activeRow = rows.find((r) => r.id === activeId);
  if (!projection || !activeRow) return null;
  const offset = (projection.depth - activeRow.depth) * indentationWidth;
  const dropped = applyDrop(tree.groups, tree.traits, collapsed, activeId, overId, offset, indentationWidth);
  if (dropped.groups === tree.groups && dropped.leaves === tree.traits) return null;

  const ownGroupIds = new Set((entity.traitGroups ?? []).map((g) => g.id));
  const ownTraitIds = new Set((entity.traits ?? []).map((t) => t.id));
  const traits = dropped.leaves.filter((t) => ownTraitIds.has(t.id));
  const traitGroups = dropped.groups.filter((g) => ownGroupIds.has(g.id));
  const placeOf = (id: string) => {
    const g = dropped.groups.find((x) => x.id === id);
    if (g) return { groupId: g.parentId, order: g.order ?? 0 };
    const t = dropped.leaves.find((x) => x.id === id);
    return { groupId: t?.groupId ?? null, order: t?.order ?? 0 };
  };
  const traitLinks = (entity.traitLinks ?? []).map((l) => ({ ...l, ...placeOf(l.id) }));
  return withOwnedLists(entity, traits, traitGroups, traitLinks);
}

/** The entity with its three lists replaced. An empty list is stored as absent. */
export const withOwnedLists = (entity: Entity, traits: Trait[], traitGroups: TraitGroup[], traitLinks: TraitLink[]): Entity =>
  withEntityLists(entity, { traits, traitGroups, traitLinks });

/** What the owner node already holds that blocks a link to the original; null when it can link. */
export function linkHeldReason(
  world: WorldTraitLists, entities: readonly Entity[], nodeId: string, originalId: string,
): HeldReason | null {
  const ownerWorld = { ...world, entities };
  const resolved = resolveOwners(ownerWorld, undefined).owners.find((b) => b.id === nodeId);
  return resolved ? heldReason(ownerWorld, resolved, originalId) : null;
}

/** Why the owner node can't link the original; null when it can. An owner's tree holds each original once. */
export function linkRefusal(
  world: WorldTraitLists, entities: readonly Entity[], nodeId: string, originalId: string,
): Extract<TraitDropRefusal, { reason: 'duplicate' }> | null {
  if (!linkHeldReason(world, entities, nodeId, originalId)) return null;
  const name = originalOf(world, originalId)?.item.name ?? '';
  return { reason: 'duplicate', name, owner: entities.find((e) => e.id === nodeId)?.name ?? '' };
}

/**
 * Resolve a drag in the one tree. A world row dropped into an entity links it there, refused when the
 * entity's tree already holds it; without `createLinks` it moves in as the entity's own item, refused while
 * any entity links it. An owned row may change owner and keeps its id. An entity node moves like a group,
 * among world items only, and the Custom Persona entity's node at the top level only. Null = nothing to write.
 */
export function applyOwnedTraitDrop(
  world: WorldTraitLists, entities: readonly Entity[],
  collapsedIds: Iterable<string>, activeId: string, overId: string, dragOffset: number, indentationWidth: number,
  { emptySystemNodes = true, ...options }: TraitDropRuleOptions & { emptySystemNodes?: boolean } = {},
): OwnedTraitDrop | null {
  const drop = applyOwnerTreeDrop(
    traitTreeSource(world, entities, [], { links: true, emptySystemNodes }), traitDropRules(world, entities, options),
    collapsedIds, activeId, overId, dragOffset, indentationWidth,
  );
  if (drop?.kind !== 'moved') return drop;
  return { kind: 'moved', ...(drop.world ? { world: { traits: drop.world.leaves, groups: drop.world.groups } } : {}), entities: drop.entities };
}

/** {@link OwnedTraitDropOptions} with the id a new link takes. */
export type TraitDropRuleOptions = OwnedTraitDropOptions & { newLinkId?: () => string };

/**
 * The owner-tree drop rules for owned traits. A Blueprints row dropped into an entity links it there, refused
 * when the entity's tree already holds it; with links off, or for any other world row, it moves in. A linked
 * Blueprint stays in Blueprints. A hidden empty Blueprints group stays in the world's lists.
 */
export function traitDropRules(
  world: WorldTraitLists, entities: readonly Entity[], { createLinks = true, newLinkId = randomUUID, codeWorld }: TraitDropRuleOptions = {},
): OwnerTreeDropRules<TraitGroup, Trait, TraitLink, LinkRow, TraitDropRefusal> {
  const duplicateIn = (nodeId: string, originalId: string): OwnerTreeDrop<TraitGroup, Trait, TraitDropRefusal> | null => {
    const refusal = linkRefusal(world, entities, nodeId, originalId);
    return refusal && { kind: 'refused', refusal };
  };
  return {
    check: ({ tree, dropped, activeId, isNode, from, to, parentAfter, moved, subtree, ownerBefore, rowIdIn, writeEntity }) => {
      const blueprint = !isNode && from === null && isBlueprintItem(world, activeId);
      if (blueprint && createLinks && to !== null) {
        const refused = duplicateIn(to, activeId);
        if (refused) return refused;
        const link = makeLink(world, activeId, newLinkId(), { groupId: null, order: 0 });
        return link && { kind: 'moved', entities: [writeEntity(tree.entityNodes.get(to)!, ownerBefore, undefined, link)], rowId: rowIdIn(to, link.id) };
      }
      // A linked Blueprint stays in Blueprints, so every link points into it.
      if (blueprint) {
        const leavesBlueprints = parentAfter == null || !blueprintsSubtreeIds(dropped.groups).has(parentAfter);
        const owners = leavesBlueprints ? entities.filter((e) => e.traitLinks?.some((l) => subtree.has(l.originalId))).map((e) => e.name) : [];
        if (owners.length) return { kind: 'refused', refusal: { reason: 'blueprint-linked', name: moved.name, owners } };
      }
      // An item that joins Blueprints reaches play only through links, so nothing outside may read it.
      if (!isNode && !blueprint && to === null && parentAfter != null && blueprintsSubtreeIds(dropped.groups).has(parentAfter)) {
        const movedItems = new Map([...dropped.groups, ...dropped.leaves].filter((item) => subtree.has(item.id)).map((item) => [item.id, item]));
        const read = traitReaderOutsideBlueprints({ ...world, entities, ...codeWorld }, from, movedItems, blueprintItemIds(world));
        if (read) return { kind: 'refused', refusal: { reason: 'into-blueprints', ...read } };
      }
      if (!isNode && from !== to && to !== null) {
        for (const { link } of linksCarried(tree, activeId)) {
          const refused = duplicateIn(to, link.originalId);
          if (refused) return refused;
        }
      }
      return undefined;
    },
    write: (entity, { groups, leaves, links }, placement) => {
      const written = withOwnedLists(entity, leaves, groups, links);
      return placement ? { ...written, traitPlacement: placement } : written;
    },
    // A hidden empty Blueprints group had no row to move, so it stays with its parent, after the reindexed siblings.
    hiddenWorldGroups: (tree, dropped) => {
      const siblingOrders = (parentId: string | null) => [
        ...dropped.groups.filter((g) => (g.parentId ?? null) === parentId),
        ...dropped.leaves.filter((t) => (t.groupId ?? null) === parentId),
      ].map((item) => item.order ?? 0);
      return world.traitGroups.filter((g) => !tree.groups.includes(g))
        .map((g) => ({ ...g, order: Math.max(-1, ...siblingOrders(g.parentId ?? null)) + 1 }));
    },
  };
}

/** The selected traits among one level's nodes, in tree order. */
const selectedLeaves = (nodes: TraitTreeNode[], sel: ReadonlySet<string>): Trait[] =>
  nodes.flatMap((node) => (node.kind === 'leaf' && sel.has(node.id) ? [node.leaf] : []));

/** The trait tree the AI reads, with every hidden group's heading lifted out. */
const aiTraitTree = (groups: TraitGroup[], traits: Trait[]): TraitTreeNode[] => aiVisibleTree(buildTraitTree(groups, traits));

/** The selected traits in the order `buildTraitContext` renders them: ungrouped first, then group by group. */
export function traitsInContextOrder(selectedIds: Iterable<string>, traits: Trait[], groups: TraitGroup[]): Trait[] {
  const sel = new Set(selectedIds);
  const walk = (nodes: TraitTreeNode[]): Trait[] =>
    nodes.flatMap((node) => (node.kind === 'group' ? [...selectedLeaves(node.children, sel), ...walk(node.children)] : []));
  const tree = aiTraitTree(groups, traits);
  return [...selectedLeaves(tree, sel), ...walk(tree)];
}

/**
 * Build the trait block sent to the AI: ungrouped selected traits first, then each group (depth-first) that
 * has ≥1 selected trait, emitting the group name + its AI description (if non-blank) above its selected
 * traits. A group the AI can't see gives its traits and subgroups to its parent. A trait's blank AI
 * description falls back to just its name. Empty → ''.
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
  const tree = aiTraitTree(groups, traits);

  const lines: string[] = [];
  for (const t of selectedLeaves(tree, sel)) lines.push(md ? `- ${traitLine(t)}` : traitLine(t));

  const walk = (nodes: TraitTreeNode[], depth: number) => {
    for (const node of nodes) {
      if (node.kind !== 'group') continue;
      const groupTraits = selectedLeaves(node.children, sel);
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
  walk(tree, 0);
  return lines.join('\n');
}

/** XML shape of the trait block: ungrouped `<trait>` first, then each group (with ≥1 selected trait) as a
 *  `<group>` nesting its `<name>`/`<description>`, its traits, and any descendant groups. A group with no
 *  directly-selected trait isn't wrapped but its descendants still surface (mirrors the simple/markdown walk). */
function buildTraitContextXml(sel: Set<string>, traits: Trait[], groups: TraitGroup[]): string {
  const tree = aiTraitTree(groups, traits);

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
      const groupTraits = selectedLeaves(node.children, sel);
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

  const lines = selectedLeaves(tree, sel).map((t) => traitXml(t, ''));
  lines.push(...walk(tree, ''));
  return lines.join('\n');
}
