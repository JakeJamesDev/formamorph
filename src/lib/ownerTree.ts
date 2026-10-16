// The owner-tree engine: the world's rows of one item kind with a node for each entity that owns some, and the
// drops that move rows across owners. A source supplies the kind's lists and an entity's rows; drop rules supply
// the kind's refusals and its write-back. Owned traits and owned stats supply both.

import type { Entity, TreePlacement } from '@/types';
import {
  applyDrop, buildTree, flattenTree, getDropProjection, isDescendantGroup, nodeDropWrites, projectionPastBlocked,
  removeChildrenOf, type FlatTreeNode, type TreeGroup, type TreeLeaf,
} from './groupTree';
import { ancestors, parentLookup } from './ancestors';
import { blueprintsSubtreeIds } from './blueprintGroups';

/** A world or entity group; `system` marks the world's Blueprints group. */
export type OwnerTreeGroup = TreeGroup & { system?: 'blueprints' };

/** A link's stored place among its owner's items. */
export interface OwnerLink { groupId: string | null; order?: number }

/** A row a link draws: the link's own row (`root`), or a row of its original's subtree. */
export interface OwnerLinkRow<Lk extends OwnerLink> { entityId: string; link: Lk; root: boolean }

/** The one tree as flat group and leaf lists. An entity node is a group whose id is the entity's. */
export interface OwnerTree<G extends OwnerTreeGroup, L extends TreeLeaf, R extends OwnerLinkRow<OwnerLink>> {
  groups: G[];
  leaves: L[];
  /** Entity node id → the entity it draws. */
  entityNodes: Map<string, Entity>;
  /** Entity row id → its entity's id. World rows are absent. */
  ownerOf: Map<string, string>;
  /** Row id → the link that draws it. */
  linkRows: Map<string, R>;
}

/** The row id an entity's item takes in the tree, and the item id a row draws. */
export interface OwnerRowIds {
  rowId(entityId: string, itemId: string): string;
  itemId(entityId: string, rowId: string): string;
}

/** What the tree draws for one item kind. */
export interface OwnerTreeSource<G extends OwnerTreeGroup, L extends TreeLeaf, R extends OwnerLinkRow<OwnerLink>> {
  groups: readonly G[];
  leaves: readonly L[];
  /** The entities with a node, in entity order. */
  entities: readonly Entity[];
  /** Entities with a node that come last at the top level and never take a placement. */
  library?: readonly Entity[];
  placement(entity: Entity): TreePlacement | undefined;
  /** How an entity's rows are named; absent, a row's id is its item's. */
  rowIds?: OwnerRowIds;
  nodeGroup(entity: Entity, parentId: string | null, order: number): G;
  /** Push the entity's rows below its node, each in `ownerOf` and each link's in `linkRows`. */
  pushRows(tree: OwnerTree<G, L, R>, entity: Entity): void;
}

/** An entity node's stored placement when its group is one of `placeableIds`; a gone, foreign or Blueprints group
 *  reads as none. The Custom Persona entity's node sits at the top level only. */
export function nodePlacement(p: TreePlacement | undefined, entity: Entity, placeableIds: ReadonlySet<string>): TreePlacement | null {
  if (p && p.groupId !== null && entity.customPersona) return null;
  return p && (p.groupId === null || placeableIds.has(p.groupId)) ? p : null;
}

/** The world groups an entity node can sit in: every one outside Blueprints. */
export function placeableGroupIds(groups: readonly OwnerTreeGroup[]): Set<string> {
  const inBlueprints = blueprintsSubtreeIds(groups);
  return new Set(groups.filter((g) => !inBlueprints.has(g.id)).map((g) => g.id));
}

const placeableIds = <G extends OwnerTreeGroup, L extends TreeLeaf, R extends OwnerLinkRow<OwnerLink>>(
  source: OwnerTreeSource<G, L, R>,
): Set<string> => placeableGroupIds(source.groups);

/** An entity's links in its tree's order: by place among its own groups, then by order. */
export function ownerLinksInTreeOrder<Link extends OwnerLink & { id: string }>(groups: readonly TreeGroup[], links: readonly Link[]): Link[] {
  const byId = new Map(links.map((l) => [l.id, l]));
  const leaves = links.map((l) => ({ id: l.id, name: '', groupId: l.groupId, order: l.order }));
  return flattenTree(buildTree(groups, leaves)).flatMap((row) => (row.leaf ? byId.get(row.id) ?? [] : []));
}

/** An entity's list fields the owner trees write. */
type EntityLists = { [K in 'traits' | 'traitGroups' | 'traitLinks' | 'stats' | 'statGroups' | 'statLinks']?: NonNullable<Entity[K]> };

/** The entity with the given lists replaced. An empty list is stored as absent. */
export function withEntityLists(entity: Entity, lists: EntityLists): Entity {
  const rest = Object.entries(entity).filter(([key]) => !(key in lists));
  const kept = Object.entries(lists).filter(([, list]) => list?.length);
  // Each key either keeps its entity value or takes a list of the key's own type.
  return Object.fromEntries([...rest, ...kept]) as unknown as Entity;
}

/** The world's rows with a node for each entity. A node sits where its placement puts it; an unplaced node goes
 *  to the end of the top level, in entity order, and library entities after those. */
export function buildOwnerTree<G extends OwnerTreeGroup, L extends TreeLeaf, R extends OwnerLinkRow<OwnerLink>>(
  source: OwnerTreeSource<G, L, R>,
): OwnerTree<G, L, R> {
  const worldGroupIds = new Set(source.groups.map((g) => g.id));
  const placeable = placeableIds(source);
  const placementOf = (e: Entity) => nodePlacement(source.placement(e), e, placeable);
  const atRoot = (ref: string | null | undefined) => ref == null || !worldGroupIds.has(ref);
  const rootSorts = [
    ...source.groups.map((g, i) => (atRoot(g.parentId) ? g.order ?? i : -1)),
    ...source.leaves.map((l, i) => (atRoot(l.groupId) ? l.order ?? i : -1)),
    ...source.entities.map(placementOf).map((p) => (p?.groupId === null ? p.order : -1)),
  ];
  const firstNodeOrder = Math.max(-1, ...rootSorts) + 1;

  const tree: OwnerTree<G, L, R> = {
    groups: [...source.groups], leaves: [...source.leaves], entityNodes: new Map(), ownerOf: new Map(), linkRows: new Map(),
  };
  const library = source.library ?? [];
  const libraryIds = new Set(library.map((e) => e.id));
  let unplaced = 0;
  for (const entity of [...source.entities, ...library]) {
    tree.entityNodes.set(entity.id, entity);
    const placement = libraryIds.has(entity.id) ? null : placementOf(entity);
    tree.groups.push(source.nodeGroup(entity, placement?.groupId ?? null, placement ? placement.order : firstNodeOrder + unplaced++));
    source.pushRows(tree, entity);
  }
  return tree;
}

/** The tree's visible rows, with collapsed groups' children hidden. */
export const ownerTreeRows = <G extends OwnerTreeGroup, L extends TreeLeaf, R extends OwnerLinkRow<OwnerLink>>(
  tree: OwnerTree<G, L, R>, collapsedIds: Iterable<string>,
): FlatTreeNode<G, L>[] => removeChildrenOf(flattenTree(buildTree(tree.groups, tree.leaves)), collapsedIds);

/** The rows at or below `id`, as a parent walk finds them. */
export function rowsBelow(lists: { groups: readonly TreeGroup[]; leaves: readonly TreeLeaf[] }, id: string): Set<string> {
  const parentOf = new Map<string, string | null>([
    ...lists.groups.map((g) => [g.id, g.parentId] as const),
    ...lists.leaves.map((l) => [l.id, l.groupId ?? null] as const),
  ]);
  const parentOfId = (rowId: string) => parentOf.get(rowId);
  return new Set([...parentOf.keys()].filter((rowId) => rowId === id || ancestors(rowId, parentOfId).includes(id)));
}

/** The links a dragged row carries: itself when it is a link, and every link below it, in link row order. */
export function linksCarried<R extends OwnerLinkRow<OwnerLink>>(
  tree: OwnerTree<OwnerTreeGroup, TreeLeaf, R>, id: string,
): R[] {
  const below = rowsBelow(tree, id);
  return [...tree.linkRows].filter(([rowId, row]) => row.root && below.has(rowId)).map(([, row]) => row);
}

/** Whether the row is an entity node, or a world group with one anywhere below it. */
const carriesEntityNode = (tree: OwnerTree<OwnerTreeGroup, TreeLeaf, OwnerLinkRow<OwnerLink>>, id: string): boolean =>
  [...tree.entityNodes.keys()].some((nodeId) => isDescendantGroup(tree.groups, id, nodeId));

/** The entity whose tree a parent row is in; null for the world. */
const ownerOfParent = (tree: OwnerTree<OwnerTreeGroup, TreeLeaf, OwnerLinkRow<OwnerLink>>, parentId: string | null): string | null =>
  (parentId === null ? null : tree.entityNodes.has(parentId) ? parentId : tree.ownerOf.get(parentId) ?? null);

/**
 * Where a drag in the one tree would land. Blueprints stays at the top level. A row that is or holds an entity
 * node stops at the top level or a world group outside Blueprints. Nothing lands inside a linked group, whose
 * subtree is its original's. A row carrying a link stays in an entity. Null when the rows below would hold
 * the row where it can't be.
 */
export function ownerTreeDropProjection<G extends OwnerTreeGroup, L extends TreeLeaf, R extends OwnerLinkRow<OwnerLink>>(
  tree: OwnerTree<G, L, R>, items: FlatTreeNode<G, L>[], activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): { depth: number; parentId: string | null } | null {
  const projection = getDropProjection(items, activeId, overId, dragOffset, indentationWidth);
  const active = items.find((i) => i.id === activeId);
  if (!active) return null;
  const inEntity = (id: string) => tree.entityNodes.has(id) || tree.ownerOf.has(id);
  const inBlueprints = blueprintsSubtreeIds(tree.groups);
  const blocked = active.group?.system === 'blueprints' ? () => true : carriesEntityNode(tree, activeId)
    ? (id: string) => inEntity(id) || inBlueprints.has(id)
    : (id: string) => tree.linkRows.has(id);
  const replayed = projectionPastBlocked(items, active, overId, projection, blocked, indentationWidth);
  if (!replayed) return null;
  // An entity node's links ride inside it; any other row carrying a link stays in an entity.
  if (!tree.entityNodes.has(activeId) && ownerOfParent(tree, replayed.parentId) === null && linksCarried(tree, activeId).length) return null;
  return replayed;
}

/** The Custom Persona entity `name` left the top level. */
export type RootRefusal = { reason: 'root'; name: string };

/** What a drop writes: the world's lists when they changed, and every entity that changed. `rowId` is the
 *  dragged row's id after the drop. */
export type OwnerTreeDrop<G, L, Rf> =
  | { kind: 'moved'; world?: { groups: G[]; leaves: L[] }; entities: Entity[]; rowId: string }
  | { kind: 'refused'; refusal: Rf | RootRefusal };

/** An entity's own lists and links as a drop leaves them. */
export interface OwnedLists<G, L, Lk> { groups: G[]; leaves: L[]; links: Lk[] }

/** A drop as the kind's rules see it, after the move and the root check. */
export interface OwnerTreeDropState<G extends OwnerTreeGroup, L extends TreeLeaf, Lk extends OwnerLink, R extends OwnerLinkRow<Lk>> {
  tree: OwnerTree<G, L, R>;
  dropped: { groups: G[]; leaves: L[] };
  activeId: string;
  isNode: boolean;
  /** The dragged row's owner before and after; null for the world. */
  from: string | null;
  to: string | null;
  parentAfter: string | null;
  moved: G | L;
  /** The dragged row with every row below it, after the move. */
  subtree: ReadonlySet<string>;
  ownerBefore(rowId: string): string | null;
  /** The item id a row draws. */
  itemId(rowId: string): string;
  /** The row id the item `itemId` takes under `owner`; null for the world. */
  rowIdIn(owner: string | null, itemId: string): string;
  /** The entity's lists with each row under `ownerOf`. `added` joins its links at the dragged row's place. */
  writeEntity(entity: Entity, ownerOf: (rowId: string) => string | null, placement?: TreePlacement, added?: Lk): Entity;
}

/** How one item kind's drops refuse and write. */
export interface OwnerTreeDropRules<G extends OwnerTreeGroup, L extends TreeLeaf, Lk extends OwnerLink, R extends OwnerLinkRow<Lk>, Rf> {
  /** The kind's own outcome for the drop: a result or null ends it, undefined moves the rows. */
  check(drop: OwnerTreeDropState<G, L, Lk, R>): OwnerTreeDrop<G, L, Rf> | null | undefined;
  /** The entity with its lists replaced, and its node's placement when given. */
  write(entity: Entity, lists: OwnedLists<G, L, Lk>, placement?: TreePlacement): Entity;
  /** The world's lists as the kind stores them; absent, as the drop leaves them. */
  writeWorld?(lists: { groups: G[]; leaves: L[] }): { groups: G[]; leaves: L[] };
  /** World groups the tree leaves out, placed after the drop. */
  hiddenWorldGroups?(tree: OwnerTree<G, L, R>, dropped: { groups: readonly G[]; leaves: readonly L[] }): G[];
}

/**
 * Resolve a drag in the one tree. An owned row may change owner and keeps its id. An entity node moves like a
 * group, among world items only, and the Custom Persona entity's node at the top level only. Null = nothing to write.
 */
export function applyOwnerTreeDrop<G extends OwnerTreeGroup, L extends TreeLeaf, Lk extends OwnerLink, R extends OwnerLinkRow<Lk>, Rf>(
  source: OwnerTreeSource<G, L, R>, rules: OwnerTreeDropRules<G, L, Lk, R, Rf>,
  collapsedIds: Iterable<string>, activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): OwnerTreeDrop<G, L, Rf> | null {
  const tree = buildOwnerTree(source);
  const collapsed = [...collapsedIds];
  const rows = ownerTreeRows(tree, [...collapsed, activeId]);
  const projection = ownerTreeDropProjection(tree, rows, activeId, overId, dragOffset, indentationWidth);
  const activeRow = rows.find((r) => r.id === activeId);
  if (!projection || !activeRow) return null;
  // The drop replays the projection's depth, which for an entity node may sit left of the pointer.
  const offset = (projection.depth - activeRow.depth) * indentationWidth;
  const dropped = applyDrop(tree.groups, tree.leaves, collapsed, activeId, overId, offset, indentationWidth);
  if (dropped.groups === tree.groups && dropped.leaves === tree.leaves) return null;

  const groupById = new Map(dropped.groups.map((g) => [g.id, g]));
  const leafById = new Map(dropped.leaves.map((l) => [l.id, l]));
  const groupParent = parentLookup(dropped.groups, (g) => g.parentId);
  const ownerAt = (parent: string | null): string | null =>
    (parent ? [parent, ...ancestors(parent, groupParent)].find((id) => tree.entityNodes.has(id)) : undefined) ?? null;
  const subtree = rowsBelow(dropped, activeId);
  const isNode = tree.entityNodes.has(activeId);
  const from = tree.ownerOf.get(activeId) ?? null;
  const movedGroup = groupById.get(activeId);
  const moved = movedGroup ?? leafById.get(activeId)!;
  const parentAfter = movedGroup ? movedGroup.parentId : leafById.get(activeId)!.groupId ?? null;
  const to = isNode ? null : ownerAt(parentAfter);
  const nodeEntity = isNode ? tree.entityNodes.get(activeId)! : null;
  if (nodeEntity?.customPersona && parentAfter !== null) return { kind: 'refused', refusal: { reason: 'root', name: nodeEntity.name } };

  const ownerBefore = (rowId: string) => tree.ownerOf.get(rowId) ?? null;
  const itemId = (rowId: string) => {
    const owner = tree.ownerOf.get(rowId);
    return owner !== undefined && source.rowIds ? source.rowIds.itemId(owner, rowId) : rowId;
  };
  const itemRef = (ref: string | null | undefined) => (ref == null ? ref : itemId(ref));
  const rowIdIn = (owner: string | null, id: string) => (owner !== null && source.rowIds ? source.rowIds.rowId(owner, id) : id);
  const writeEntity = (entity: Entity, ownerOf: (rowId: string) => string | null, placement?: TreePlacement, added?: Lk): Entity => {
    // The entity node's id stands for the entity's root, which its own lists store as null.
    const fromNode = (parent: string | null | undefined) => (parent === entity.id ? null : itemRef(parent) ?? null);
    const mine = (rowId: string) => ownerOf(rowId) === entity.id;
    const own = (rowId: string) => mine(rowId) && !tree.linkRows.has(rowId) && !tree.entityNodes.has(rowId);
    const placeOf = (rowId: string) => {
      const g = groupById.get(rowId);
      const item = g ?? leafById.get(rowId)!;
      return { groupId: fromNode(g ? g.parentId : leafById.get(rowId)!.groupId), order: item.order ?? 0 };
    };
    const links = [...tree.linkRows].filter(([rowId, row]) => row.root && mine(rowId)).map(([rowId, row]) => ({ ...row.link, ...placeOf(rowId) }));
    if (added) links.push({ ...added, ...placeOf(activeId) });
    return rules.write(entity, {
      groups: dropped.groups.filter((g) => own(g.id)).map((g) => ({ ...g, id: itemId(g.id), parentId: fromNode(g.parentId) })),
      leaves: dropped.leaves.filter((l) => own(l.id)).map((l) => ({ ...l, id: itemId(l.id), groupId: fromNode(l.groupId) })),
      links,
    }, placement);
  };

  const outcome = rules.check({
    tree, dropped, activeId, isNode, from, to, parentAfter, moved, subtree, ownerBefore, itemId, rowIdIn, writeEntity,
  });
  if (outcome !== undefined) return outcome;

  const ownerAfter = (rowId: string) => (subtree.has(rowId) && from !== to ? to : ownerBefore(rowId));
  const placeable = placeableIds(source);
  const unplaced = [...tree.entityNodes.values()].filter((e) => !nodePlacement(source.placement(e), e, placeable)).map((e) => e.id);
  const { touched, pinned } = nodeDropWrites(
    { groups: tree.groups, leaves: tree.leaves }, dropped, new Set(tree.entityNodes.keys()), unplaced, ownerBefore, ownerAfter,
  );
  if (!touched.size) return null;

  const worldOwned = (rowId: string) => ownerAfter(rowId) === null && !tree.entityNodes.has(rowId);
  const entities = [...tree.entityNodes.values()].filter((e) => touched.has(e.id)).map((entity) => {
    const node = groupById.get(entity.id)!;
    return writeEntity(entity, ownerAfter, pinned.has(entity.id) ? { groupId: node.parentId, order: node.order ?? 0 } : undefined);
  });
  const worldLists = () => {
    const lists = {
      groups: dropped.groups.filter((g) => worldOwned(g.id)).map((g) => ({ ...g, id: itemId(g.id), parentId: itemRef(g.parentId) ?? null })),
      leaves: dropped.leaves.filter((l) => worldOwned(l.id))
        .map((l) => ({ ...l, id: itemId(l.id), ...(l.groupId !== undefined ? { groupId: itemRef(l.groupId) } : {}) })),
    };
    const written = rules.writeWorld?.(lists) ?? lists;
    return { ...written, groups: [...written.groups, ...rules.hiddenWorldGroups?.(tree, dropped) ?? []] };
  };
  const rowId = isNode ? activeId : rowIdIn(ownerAfter(activeId), itemId(activeId));
  return { kind: 'moved', ...(touched.has(null) ? { world: worldLists() } : {}), entities, rowId };
}
