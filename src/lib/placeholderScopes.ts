// The Placeholders tab over a whole world. A world keeps several placeholder lists — its own shared one, and
// the one each entity or dictionary book owns — and the tab draws them as one tree: the shared list's
// folders, then its loose rows, then a derived owner node per entity or book that owns any, its rows
// beneath. A folder holds folders and shared rows only. An owner node is not a folder: it is read off the
// entity or book, so it cannot be renamed, deleted or dragged. A drop across those sections moves the
// record between lists with its id kept, so nothing placed anywhere has to re-aim.
//
// Data in, data out, like `placeholderTree`: the tree component only wires this to the drag scaffold.

import { arrayMove } from '@dnd-kit/sortable';
import { entitiesInTreeOrder } from './entityGroupTree';
import { childPlaceholderGroups, isDescendantPlaceholderGroup, placeholderGroupOf } from './placeholderGroups';
import {
  allPlaceholders, movePlaceholderHome, placeholderHomeIndex, placeholderList, withPlaceholderList,
  type PlaceholderHome, type PlaceholderHomesWorld, type PlaceholderOwnerRef, type PlaceholderSlices,
} from './placeholderHomes';
import {
  commitPlaceholderDrop, getPlaceholderDropProjection, placeholderRows, removeCollapsedPlaceholderRows,
  type PlaceholderDropContext, type PlaceholderTreeRow,
} from './placeholderTree';
import { SHARED_PATH_SEP } from './placeholders';
import type { Placeholder, PlaceholderGroup } from '@/types';

/** A placeholder row, plus which of the world's lists it lives in. */
export interface PlaceholderRowNode extends PlaceholderTreeRow {
  kind: 'placeholder';
  home: PlaceholderHome;
}

/** The derived row for an entity or book that owns placeholders. Always at the top level. */
export interface PlaceholderOwnerNode {
  kind: 'owner';
  id: string;
  parentId: null;
  depth: 0;
  owner: PlaceholderOwnerRef;
  home: PlaceholderHome;
}

/** An editor folder over shared rows. Its id is the group's own, which no placeholder row's chain equals. */
export interface PlaceholderGroupNode {
  kind: 'group';
  id: string;
  parentId: string | null;
  depth: number;
  group: PlaceholderGroup;
  home: PlaceholderHome;
}

export type PlaceholderTreeNode = PlaceholderRowNode | PlaceholderOwnerNode | PlaceholderGroupNode;

const WORLD: PlaceholderHome = { kind: 'world' };

// Row ids are chains of placeholder ids; an owner node id carries a prefix no placeholder id has.
const OWNER_NODE_PREFIX = 'owner:';

/** The node id the tab gives an owner — what selection speaks in when an owner node is picked. */
export const ownerNodeId = (ownerId: string): string => `${OWNER_NODE_PREFIX}${ownerId}`;

/** The owner id behind a node id, or null for a placeholder row's id. */
export const ownerIdOfNode = (nodeId: string): string | null =>
  (nodeId.startsWith(OWNER_NODE_PREFIX) ? nodeId.slice(OWNER_NODE_PREFIX.length) : null);

/**
 * The tab's rows: the shared list's folders, each holding its subfolders and then its placeholders as a
 * tree; the loose shared placeholders; then an owner node for each entity in tree order and each book in
 * book order that owns at least one placeholder, with that owner's own tree beneath it. Every row looks its
 * holders and chip targets up across the whole world, so a scoped placeholder holding a shared one still
 * draws it as a shared row.
 */
export function placeholderTreeNodes(world: PlaceholderHomesWorld): PlaceholderTreeNode[] {
  const all = allPlaceholders(world);
  // A shared row drawn under a scoped holder still lives in its own list, so each row's home is read off
  // the record rather than the section it is drawn in.
  const homeOf = placeholderHomeIndex(world);
  const rowsOf = (list: readonly Placeholder[], under?: { id: string; depth: number }): PlaceholderRowNode[] =>
    placeholderRows(list, all).map((row) => ({
      ...row,
      kind: 'placeholder',
      home: homeOf.get(row.placeholder.id) ?? WORLD,
      depth: under ? row.depth + under.depth + 1 : row.depth,
      parentId: row.parentId ?? under?.id ?? null,
    }));
  const groups = world.placeholderGroups ?? [];
  const shared = world.placeholders ?? [];
  const out: PlaceholderTreeNode[] = [];
  // Folders before rows at every level, so a folder never sits between two loose rows.
  const folders = (parentId: string | null, depth: number) => {
    for (const group of childPlaceholderGroups(groups, parentId)) {
      const node: PlaceholderGroupNode = { kind: 'group', id: group.id, parentId, depth, group, home: WORLD };
      out.push(node);
      folders(group.id, depth + 1);
      out.push(...rowsOf(shared.filter((p) => placeholderGroupOf(groups, p) === group.id), node));
    }
  };
  folders(null, 0);
  out.push(...rowsOf(shared.filter((p) => placeholderGroupOf(groups, p) === null)));
  const section = (owner: PlaceholderOwnerRef, list: Placeholder[] | undefined) => {
    if (!list?.length) return;
    const home: PlaceholderHome = { kind: owner.kind, ownerId: owner.id };
    const node: PlaceholderOwnerNode = { kind: 'owner', id: ownerNodeId(owner.id), parentId: null, depth: 0, owner, home };
    out.push(node, ...rowsOf(list, node));
  };
  for (const e of entitiesInTreeOrder(world.entityGroups ?? [], world.entities ?? [])) {
    section({ kind: 'entity', id: e.id, name: e.name }, e.placeholders);
  }
  for (const b of world.dictionaries ?? []) section({ kind: 'dictionary', id: b.id, name: b.name }, b.placeholders);
  return out;
}

/**
 * Whether the tab may land `activeId` under `parentId` (null for the root). One rule for the drag's indent
 * indicator and the drop, so the indicator never shows a nesting the drop would refuse: an owner node
 * moves nowhere; a folder nests only in a folder, and never in its own subtree; a scoped placeholder
 * stays out of folders; a placeholder never nests inside a row whose chain already names it.
 */
export function placeholderDropAllowed(
  world: PlaceholderHomesWorld, nodes: readonly PlaceholderTreeNode[], activeId: string, parentId: string | null,
): boolean {
  const active = nodes.find((n) => n.id === activeId);
  if (!active || active.kind === 'owner') return false;
  const parent = parentId === null ? null : nodes.find((n) => n.id === parentId);
  if (parentId !== null && !parent) return false;
  if (active.kind === 'group') {
    if (parent && parent.kind !== 'group') return false;
    return parentId === null || !isDescendantPlaceholderGroup(world.placeholderGroups ?? [], activeId, parentId);
  }
  if (parent?.kind === 'group' && active.home.kind !== 'world') return false;
  return !(parent?.kind === 'placeholder' && parent.id.split(SHARED_PATH_SEP).includes(active.placeholder.id));
}

/**
 * Resolve a drag on the tab into the world's lists. The drop is projected over the whole tree, so its
 * parent may be a folder (a shared record lands in it, at the top level), an owner node (the row lands at
 * the top of that owner's list), a row in another section (the record moves there and nests), or nothing
 * (the record joins the world's loose shared rows). A drop that lands where the record already lives is
 * the plain in-list drop. A dragged folder re-parents and reorders among the folders alone, and the result
 * then carries `placeholderGroups`. `null` where the drag changes nothing: an owner node dragged, a
 * self-nesting, a folder dropped anywhere but in a folder, a scoped placeholder dropped in a folder, or a
 * target the tree does not show.
 */
export function applyScopedPlaceholderDrop(
  world: PlaceholderHomesWorld, collapsedIds: Iterable<string>,
  activeId: string, overId: string, dragOffset: number, indentationWidth: number,
  context: PlaceholderDropContext = {},
): PlaceholderSlices | null {
  const nodes = placeholderTreeNodes(world);
  const visible = removeCollapsedPlaceholderRows(nodes, [...collapsedIds, activeId]);
  if (!visible.some((n) => n.id === overId) || !visible.some((n) => n.id === activeId)) return null;

  const activeIndex = nodes.findIndex((n) => n.id === activeId);
  const overIndex = nodes.findIndex((n) => n.id === overId);
  const active = nodes[activeIndex];
  if (!active || active.kind === 'owner' || overIndex === -1) return null;

  const { parentId } = getPlaceholderDropProjection(visible, activeId, overId, dragOffset, indentationWidth);
  if (!placeholderDropAllowed(world, nodes, activeId, parentId)) return null;
  const parent = parentId === null ? null : nodes.find((n) => n.id === parentId) ?? null;
  const reParented = nodes.map((n) => (n.id === activeId ? { ...n, parentId } : n));
  const moved = arrayMove(reParented, activeIndex, overIndex);

  if (active.kind === 'group') {
    const groups = world.placeholderGroups ?? [];
    const order = new Map(moved.flatMap((n) => (n.kind === 'group' && n.parentId === parentId ? [n.id] : [])).map((id, i) => [id, i]));
    return {
      placeholders: world.placeholders ?? [], entities: world.entities ?? [], dictionaries: world.dictionaries ?? [],
      placeholderGroups: groups.map((g) => (order.has(g.id)
        ? { ...g, parentId: g.id === activeId ? parentId : g.parentId, order: order.get(g.id) }
        : g)),
    };
  }

  const home = parent?.home ?? WORLD;
  const siblingOrder = moved.flatMap((n) => (n.parentId === parentId && n.kind === 'placeholder' ? [n.placeholder.id] : []));

  const targetId = active.placeholder.id;
  // A move to the list the record already lives in hands the lists back as they are.
  const next: PlaceholderHomesWorld = { ...world, ...movePlaceholderHome(world, targetId, home) };
  const list = placeholderList(next, home);
  const holderId = parent?.kind === 'placeholder' ? parent.placeholder.id : null;
  const committed = commitPlaceholderDrop(list, {
    targetId, activeHolderId: active.holderId, holderId, siblingOrder,
    ...(holderId === null ? { groupId: parent?.kind === 'group' ? parent.id : null } : {}),
  }, { ...context, all: allPlaceholders(next) });
  return withPlaceholderList(next, home, committed);
}
