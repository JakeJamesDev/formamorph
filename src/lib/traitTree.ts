// The trait folder tree (groups + traits, nestable via parentId/groupId) — a binding of the generic groupTree
// machinery to Trait/TraitGroup, plus the trait-only `buildTraitContext` that renders the selected traits into
// the block sent to the AI. The editor and selection screen build/walk the tree from the two flat world arrays.

import {
  buildTree, flattenTree, getDropProjection, applyDrop, duplicateNode,
  removeChildrenOf as removeChildrenOfGeneric, isDescendantGroup as isDescendantGroupGeneric,
  type GroupTreeNode, type FlatTreeNode,
} from './groupTree';
import type { CustomPersonaNode, Entity, Trait, TraitGroup, TraitLink, TraitPlacement } from '@/types';
import { xmlEscape } from './utils';
import { PLAYER_BEARER, bearsTraits, holdsOriginal, makeLink, originalOf, resolveBearers } from './bearers';
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

/** The world's Templates group, when the author added one. */
export const templatesGroup = (groups: readonly TraitGroup[]): TraitGroup | undefined =>
  groups.find((g) => g.system === 'templates');

/** Every group below `groupId`, depth-first. */
export function groupsBelow(groups: readonly TraitGroup[], groupId: string): TraitGroup[] {
  const out: TraitGroup[] = [];
  const walk = (parentId: string) => {
    for (const g of groups) if (g.parentId === parentId) { out.push(g); walk(g.id); }
  };
  walk(groupId);
  return out;
}

/** Templates and every world group below it. Empty when the world has no Templates group. */
export function templatesSubtreeIds(groups: readonly TraitGroup[]): Set<string> {
  const templates = templatesGroup(groups);
  return new Set(templates ? [templates.id, ...groupsBelow(groups, templates.id).map((g) => g.id)] : []);
}

/** The world's traits and groups without Templates and everything below it: what the root offers the player.
 *  The bearer resolver builds the player bearer from it; the trait runtime falls back to it only for a world
 *  given without bearers. */
export function offeredWorldTraits<T extends Trait, G extends TraitGroup>(
  traits: readonly T[], groups: readonly G[],
): { traits: readonly T[]; groups: readonly G[] } {
  const inTemplates = templatesSubtreeIds(groups);
  if (!inTemplates.size) return { traits, groups };
  return {
    traits: traits.filter((t) => t.groupId == null || !inTemplates.has(t.groupId)),
    groups: groups.filter((g) => !inTemplates.has(g.id)),
  };
}

/** The Custom Persona node's row id in the Traits tree. */
export const CUSTOM_PERSONA_ID = 'custom-persona';
export const CUSTOM_PERSONA_NAME = 'Custom Persona';

/** Custom Persona as the tree draws a bearer node: a node holding links only. */
export const customPersonaEntity = (node: CustomPersonaNode): Entity => ({
  id: CUSTOM_PERSONA_ID, name: CUSTOM_PERSONA_NAME, traitLinks: node.traitLinks,
  ...(node.traitPlacement ? { traitPlacement: node.traitPlacement } : {}),
});

/** The Custom Persona node an edit of its bearer node writes back. Owned items are never kept. */
export const customPersonaFrom = (entity: Entity): CustomPersonaNode => ({
  traitLinks: entity.traitLinks ?? [],
  ...(entity.traitPlacement ? { traitPlacement: entity.traitPlacement } : {}),
});

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

type WorldTraitLists = { traits: readonly Trait[]; traitGroups: readonly TraitGroup[]; customPersona?: CustomPersonaNode };

/** Whether a world group holds a trait or a group directly. */
export const groupHoldsItems = (lists: Pick<WorldTraitLists, 'traits' | 'traitGroups'>, groupId: string): boolean =>
  lists.traitGroups.some((g) => g.parentId === groupId) || lists.traits.some((t) => t.groupId === groupId);

/** Whether the editor's tree shows the system node: always in Advanced, and in Basic only when it holds something. */
const showsSystemNode = (holds: boolean, emptySystemNodes: boolean) => holds || emptySystemNodes;

/** The world's traits, with a node for each entity that owns a trait or a group. A node sits where its
 *  placement puts it; an unplaced node goes to the end of the top level, in entity order. Library entities
 *  (a persona or an added entity) come last at the top level, in the order given. Without `links`, the
 *  player's view, Templates and everything in it drop out. With `links`, the editor's view, an entity's links
 *  draw too, an entity with links only gets a node, and so does Custom Persona. `emptySystemNodes` off hides
 *  an empty Templates group and an empty Custom Persona node. */
export function ownedTraitTree(
  lists: WorldTraitLists, entities: readonly Entity[], library: readonly Entity[] = [],
  { links = false, emptySystemNodes = true } = {},
): OwnedTraitTree {
  const offered = links ? null : offeredWorldTraits(lists.traits, lists.traitGroups);
  const templates = links ? templatesGroup(lists.traitGroups) : undefined;
  const hideTemplates = !!templates && !showsSystemNode(groupHoldsItems(lists, templates.id), emptySystemNodes);
  const world: WorldTraitLists = offered
    ? { traits: offered.traits, traitGroups: offered.groups }
    : hideTemplates ? { ...lists, traitGroups: lists.traitGroups.filter((g) => g !== templates) } : lists;
  const worldGroupIds = new Set(world.traitGroups.map((g) => g.id));
  const placeable = placeableGroupIds(world.traitGroups);
  const atRoot = (ref: string | null | undefined) => ref == null || !worldGroupIds.has(ref);
  const hasNode = links ? bearsTraits : ownsTraits;
  const customPersona = links && lists.customPersona
    && showsSystemNode(lists.customPersona.traitLinks.length > 0, emptySystemNodes)
    ? [customPersonaEntity(lists.customPersona)] : [];
  const owning = [...entities.filter(hasNode), ...customPersona];
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
  const linkRows = new Map<string, LinkRow>();
  let unplaced = 0;
  const libraryIds = new Set(library.map((e) => e.id));
  [...owning, ...library.filter(hasNode)].forEach((entity) => {
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
    for (const link of links ? entity.traitLinks ?? [] : []) {
      const original = originalOf(world, link.originalId);
      if (original) pushLinkRows({ groups, traits, ownerOf, linkRows }, world, entity.id, link, original, parent);
    }
  });
  return { groups, traits, entityNodes, ownerOf, linkRows };
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

/** Why a drop into an entity was refused: `offender`, inside the dragged `name`, has stat effects; the
 *  bearer's tree already holds the original `name`; or the top level already offers it to the player. */
export type TraitDropRefusal =
  | {
    reason: 'stats';
    name: string;
    kind: 'trait' | 'group';
    offender: string;
    /** The name of the entity the item stays with; null = the world. */
    owner: string | null;
  }
  | { reason: 'duplicate'; name: string; bearer: string }
  | { reason: 'offered'; name: string };

export interface OwnedTraitDropOptions {
  /** Whether a world row dropped into an entity links it. Off, the row stays among the world items. */
  createLinks?: boolean;
}

/** What a drop in the one tree writes: the world's lists when they changed, every entity that changed, and
 *  Custom Persona when it changed. */
export type OwnedTraitDrop =
  | { kind: 'moved'; world?: { traits: Trait[]; groups: TraitGroup[] }; entities: Entity[]; customPersona?: CustomPersonaNode }
  | { kind: 'refused'; refusal: TraitDropRefusal };

/** Whether the trait changes stats: stat changes or stat toggles. An entity's own traits never do. */
export const hasStatEffects = (t: Trait): boolean => t.statChanges.length > 0 || (t.statToggles?.length ?? 0) > 0;

/** The one tree's visible rows, with collapsed groups' children hidden. */
export const ownedTraitRows = (tree: OwnedTraitTree, collapsedIds: Iterable<string>): FlatTraitNode[] =>
  removeChildrenOf(flattenTraitTree(buildTraitTree(tree.groups, tree.traits)), collapsedIds);

/** Whether the row is an entity node, or a world group with one anywhere below it. */
const carriesEntityNode = (tree: OwnedTraitTree, id: string): boolean =>
  [...tree.entityNodes.keys()].some((nodeId) => isDescendantGroup(tree.groups, id, nodeId));

/** The entity whose tree a parent row is in; null for the world. */
const ownerOfParent = (tree: OwnedTraitTree, parentId: string | null): string | null =>
  (parentId === null ? null : tree.entityNodes.has(parentId) ? parentId : tree.ownerOf.get(parentId) ?? null);

/** The links a dragged row carries: itself when it is a link, and every link below it. */
function linksCarried(tree: OwnedTraitTree, id: string): LinkRow[] {
  const parentOf = new Map<string, string | null>([
    ...tree.groups.map((g) => [g.id, g.parentId] as const),
    ...tree.traits.map((t) => [t.id, t.groupId ?? null] as const),
  ]);
  const below = (rowId: string) => {
    for (let at: string | null | undefined = rowId; at; at = parentOf.get(at)) if (at === id) return true;
    return false;
  };
  return [...tree.linkRows].filter(([rowId, row]) => row.root && below(rowId)).map(([, row]) => row);
}

/**
 * Where a drag in the one tree would land. Templates and Custom Persona stay at the top level. A row that is or holds an entity node stops at the top level
 * or a world group outside Templates. Nothing lands inside a linked group, whose subtree is its original's.
 * A row carrying a link stays in an entity, Custom Persona takes links only, and without `createLinks` a
 * world row stays among the world items. Null when the rows below would hold the row where it can't be.
 */
export function getOwnedTraitDropProjection(
  tree: OwnedTraitTree, items: FlatTraitNode[], activeId: string, overId: string, dragOffset: number, indentationWidth: number,
  { createLinks = true }: OwnedTraitDropOptions = {},
): { depth: number; parentId: string | null } | null {
  const projection = getDropProjection(items, activeId, overId, dragOffset, indentationWidth);
  const active = items.find((i) => i.id === activeId);
  if (!active) return null;
  const inEntity = (id: string) => tree.entityNodes.has(id) || tree.ownerOf.has(id);
  const worldRow = !inEntity(activeId);
  const ownedRow = tree.ownerOf.has(activeId) && !tree.linkRows.has(activeId);
  const inTemplates = templatesSubtreeIds(tree.groups);
  const systemNode = activeId === CUSTOM_PERSONA_ID || active.group?.system === 'templates';
  const blocked = systemNode ? () => true : carriesEntityNode(tree, activeId)
    ? (id: string) => inEntity(id) || inTemplates.has(id)
    : (id: string) => tree.linkRows.has(id) || (!createLinks && worldRow && inEntity(id))
      || (ownedRow && id === CUSTOM_PERSONA_ID);
  const parentOf = new Map(items.map((i) => [i.id, i.parentId]));
  let { depth, parentId } = projection;
  while (parentId !== null && blocked(parentId)) {
    parentId = parentOf.get(parentId) ?? null;
    depth -= 1;
  }
  const replayed = depth === projection.depth
    ? projection
    : getDropProjection(items, activeId, overId, (depth - active.depth) * indentationWidth, indentationWidth);
  if (replayed.depth !== depth || replayed.parentId !== parentId) return null;
  if (ownerOfParent(tree, parentId) === null && linksCarried(tree, activeId).length) return null;
  return replayed;
}

/**
 * Why the bearer node can't link the original; null when it can. A bearer's tree holds each original once.
 * Custom Persona's node is the player bearer, which already has every original outside Templates.
 */
export function linkRefusal(
  world: WorldTraitLists, entities: readonly Entity[], nodeId: string, originalId: string,
): Extract<TraitDropRefusal, { reason: 'duplicate' | 'offered' }> | null {
  const bearerWorld = { ...world, entities };
  const bearerId = nodeId === CUSTOM_PERSONA_ID ? PLAYER_BEARER : nodeId;
  const resolved = resolveBearers(bearerWorld, undefined).bearers.find((b) => b.id === bearerId);
  if (!resolved || !holdsOriginal(bearerWorld, resolved, originalId)) return null;
  const name = originalOf(world, originalId)?.item.name ?? '';
  const offered = offeredWorldTraits(world.traits, world.traitGroups);
  if (nodeId === CUSTOM_PERSONA_ID && [...offered.traits, ...offered.groups].some((item) => item.id === originalId)) {
    return { reason: 'offered', name };
  }
  const bearer = nodeId === CUSTOM_PERSONA_ID ? CUSTOM_PERSONA_NAME : entities.find((e) => e.id === nodeId)?.name ?? '';
  return { reason: 'duplicate', name, bearer };
}

/**
 * Resolve a drag in the one tree. A world row dropped into an entity links it there, refused when the
 * entity's tree already holds it. An owned row may change owner and keeps its id, unless a trait it carries
 * into an entity has stat effects. An entity node moves like a group, among world items only.
 * Null = nothing to write.
 */
export function applyOwnedTraitDrop(
  world: WorldTraitLists, entities: readonly Entity[],
  collapsedIds: Iterable<string>, activeId: string, overId: string, dragOffset: number, indentationWidth: number,
  { createLinks = true, emptySystemNodes = true, newLinkId = randomUUID }:
    OwnedTraitDropOptions & { emptySystemNodes?: boolean; newLinkId?: () => string } = {},
): OwnedTraitDrop | null {
  const tree = ownedTraitTree(world, entities, [], { links: true, emptySystemNodes });
  const collapsed = [...collapsedIds];
  const rows = ownedTraitRows(tree, [...collapsed, activeId]);
  const projection = getOwnedTraitDropProjection(tree, rows, activeId, overId, dragOffset, indentationWidth, { createLinks });
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
  const ownerBefore = (id: string) => tree.ownerOf.get(id) ?? null;

  /** The entity's lists and links as the drop leaves them. `added` joins its links at the dragged row's place. */
  const writeEntity = (entity: Entity, ownerAfter: (id: string) => string | null, placement?: TraitPlacement, added?: TraitLink): Entity => {
    // The entity node's id stands for the entity's root, which its own lists store as null.
    const fromNode = (parent: string | null | undefined) => (parent === entity.id ? null : parent ?? null);
    const mine = (id: string) => ownerAfter(id) === entity.id;
    const owned = (id: string) => mine(id) && !tree.linkRows.has(id);
    const traits = dropped.leaves.filter((t) => owned(t.id)).map((t) => ({ ...t, groupId: fromNode(t.groupId) }));
    const groups = dropped.groups
      .filter((g) => !tree.entityNodes.has(g.id) && owned(g.id))
      .map((g) => ({ ...g, parentId: fromNode(g.parentId) }));
    const placeOf = (id: string) => {
      const g = groupById.get(id);
      const t = g ? undefined : dropped.leaves.find((l) => l.id === id)!;
      return { groupId: fromNode(g ? g.parentId : t!.groupId), order: (g ?? t!).order ?? 0 };
    };
    const links = [...tree.linkRows].filter(([id, row]) => row.root && mine(id)).map(([id, row]) => ({ ...row.link, ...placeOf(id) }));
    if (added) links.push({ ...added, ...placeOf(activeId) });
    const { traits: _t, traitGroups: _g, traitLinks: _l, ...rest } = entity;
    return {
      ...rest,
      ...(traits.length ? { traits } : {}),
      ...(groups.length ? { traitGroups: groups } : {}),
      ...(links.length ? { traitLinks: links } : {}),
      ...(placement ? { traitPlacement: placement } : {}),
    };
  };

  const duplicateIn = (nodeId: string, originalId: string): OwnedTraitDrop | null => {
    const refusal = linkRefusal(world, entities, nodeId, originalId);
    return refusal && { kind: 'refused', refusal };
  };
  /** The drop's writes, with Custom Persona's node split off the entities. */
  const moved = (entitiesOut: Entity[], worldOut?: { traits: Trait[]; groups: TraitGroup[] }): OwnedTraitDrop => {
    const persona = entitiesOut.find((e) => e.id === CUSTOM_PERSONA_ID);
    return {
      kind: 'moved',
      ...(worldOut ? { world: worldOut } : {}),
      entities: entitiesOut.filter((e) => e !== persona),
      ...(persona ? { customPersona: customPersonaFrom(persona) } : {}),
    };
  };

  // A world row dropped into an entity links it there; the original stays where it is.
  if (!isNode && from === null && to !== null) {
    const refused = duplicateIn(to, activeId);
    if (refused) return refused;
    const link = makeLink(world, activeId, newLinkId(), { groupId: null, order: 0 }, tree.entityNodes.get(to)!.placeholders);
    return link && moved([writeEntity(tree.entityNodes.get(to)!, ownerBefore, undefined, link)]);
  }
  if (!isNode && from !== to && to !== null) {
    for (const { link } of linksCarried(tree, activeId)) {
      const refused = duplicateIn(to, link.originalId);
      if (refused) return refused;
    }
    // A link's stat effects stay on its original, so only owned traits count.
    const ownedBelow = leavesBelow.filter((t) => !tree.linkRows.has(t.id));
    const offender = flattenTraitTree(buildTraitTree(dropped.groups, ownedBelow)).find((n) => n.leaf && hasStatEffects(n.leaf));
    if (offender) {
      return {
        kind: 'refused',
        refusal: {
          reason: 'stats', name: movedItem.name, kind: movedGroup ? 'group' : 'trait', offender: offender.leaf!.name,
          owner: from ? tree.entityNodes.get(from)!.name : null,
        },
      };
    }
  }

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

  // A hidden empty Templates group had no row to move, so it stays with its parent, after the reindexed siblings.
  const siblingOrders = (parentId: string | null) => [
    ...dropped.groups.filter((g) => (g.parentId ?? null) === parentId),
    ...dropped.leaves.filter((t) => (t.groupId ?? null) === parentId),
  ].map((item) => item.order ?? 0);
  const hidden = world.traitGroups.filter((g) => !tree.groups.includes(g))
    .map((g) => ({ ...g, order: Math.max(-1, ...siblingOrders(g.parentId ?? null)) + 1 }));
  const worldGroups = [...dropped.groups.filter((g) => !tree.entityNodes.has(g.id) && ownerAfter(g.id) === null), ...hidden];
  const entitiesOut = [...tree.entityNodes.values()].filter((e) => touched.has(e.id)).map((entity) => {
    const node = groupById.get(entity.id)!;
    return writeEntity(entity, ownerAfter, pinned.has(entity.id) ? { groupId: node.parentId, order: node.order ?? 0 } : undefined);
  });
  return moved(
    entitiesOut,
    touched.has(null) ? { traits: dropped.leaves.filter((t) => ownerAfter(t.id) === null), groups: worldGroups } : undefined,
  );
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
