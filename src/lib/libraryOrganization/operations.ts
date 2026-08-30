import {
  prunePlacements,
  resizePlacements,
  resolvePlacements,
  rowMajor,
  withPlacements,
} from './placements';
import {
  NEW_GROUP_NAME,
  type LibraryGroup,
  type LibraryTabOrganization,
  type LibraryTileSize,
  type PlacementMap,
} from './types';

/** The same record without one key, for the many places a default is stored as no entry at all. */
const dropKey = <T,>(record: Record<string, T>, key: string): Record<string, T> => {
  const { [key]: _dropped, ...rest } = record;
  return rest;
};

/**
 * Hand one tile's cells to another id, or give them up entirely when `to` is null.
 *
 * A tile that changes which grid it is drawn in has to arrive homeless: its old cell belongs to the
 * board it left, and claiming the same cell on the board it joined would push whoever stands there out.
 */
const rehome = (
  placements: Record<number, PlacementMap>,
  from: string,
  to: string | null,
): Record<number, PlacementMap> => Object.fromEntries(
  Object.entries(placements).map(([width, places]) => {
    const at = places[from];
    const rest = dropKey(places, from);
    return [Number(width), at && to ? { ...rest, [to]: at } : rest];
  }),
);

/** True when the id names a folder in this tab rather than a library item. */
export const isGroupId = (org: LibraryTabOrganization, id: string): boolean => id in org.groups;

/** The folder an item sits in, or undefined when it is loose in the main grid. */
export const groupOf = (org: LibraryTabOrganization, itemId: string): LibraryGroup | undefined =>
  Object.values(org.groups).find((group) => group.members.includes(itemId));

/** The size a tile renders at; anything never resized is medium. */
export const tileSize = (org: LibraryTabOrganization, id: string): LibraryTileSize =>
  org.sizes[id] ?? 'medium';

/** The same list with `id` gone, or the original array when it was not there. */
const without = (list: string[], id: string): string[] =>
  list.includes(id) ? list.filter((entry) => entry !== id) : list;

/** A copy of the list with `remove` entries dropped at `index` and `insert` put in their place. */
const spliced = (list: string[], index: number, remove: number, ...insert: string[]): string[] => {
  const next = [...list];
  next.splice(index, remove, ...insert);
  return next;
};

/** Every group with `itemId` taken out of its members. */
const detach = (
  groups: Record<string, LibraryGroup>,
  itemId: string,
): Record<string, LibraryGroup> => Object.fromEntries(
  Object.entries(groups).map(([id, group]) => [id, { ...group, members: without(group.members, itemId) }]),
);

/**
 * Put one tile into a new folder of its own, standing where the tile stood.
 *
 * This is how every folder starts: the context menu's New Group action. No drag gesture makes one.
 *
 * @param groupId - The id to mint the folder under; the caller owns id generation
 */
export function createGroupFromItem(
  org: LibraryTabOrganization,
  { groupId, itemId }: { groupId: string; itemId: string },
): LibraryTabOrganization {
  if (isGroupId(org, itemId)) return org;

  const groups = detach(org.groups, itemId);
  const slot = org.order.indexOf(itemId);
  const size = org.sizes[itemId];

  return {
    ...org,
    order: slot === -1 ? [...org.order, groupId] : spliced(org.order, slot, 1, groupId),
    groups: {
      ...groups,
      [groupId]: { id: groupId, name: NEW_GROUP_NAME, members: [itemId], settings: {} },
    },
    sizes: size ? { ...org.sizes, [groupId]: size } : org.sizes,
    // The folder inherits the tile's cell, so the board looks the same the moment the folder appears.
    placements: rehome(org.placements, itemId, groupId),
  };
}

/** Move an item into a folder, out of the main grid and out of whatever folder held it before. */
export function addToGroup(
  org: LibraryTabOrganization,
  itemId: string,
  groupId: string,
): LibraryTabOrganization {
  const target = org.groups[groupId];
  if (!target || isGroupId(org, itemId) || target.members.includes(itemId)) return org;

  const groups = detach(org.groups, itemId);
  return {
    ...org,
    order: without(org.order, itemId),
    groups: { ...groups, [groupId]: { ...groups[groupId], members: [...groups[groupId].members, itemId] } },
    placements: rehome(org.placements, itemId, null),
  };
}

/**
 * Fold two loose tiles into one new folder, standing where the target stood.
 *
 * The drag gesture's group drop: the carried item joins the item it was held over. The folder takes
 * the target's cell and size, so the board looks the same the moment it appears.
 *
 * @param groupId - The id to mint the folder under; the caller owns id generation
 */
export function groupItems(
  org: LibraryTabOrganization,
  { groupId, itemId, targetId }: { groupId: string; itemId: string; targetId: string },
): LibraryTabOrganization {
  if (itemId === targetId || isGroupId(org, itemId) || isGroupId(org, targetId)) return org;
  return addToGroup(createGroupFromItem(org, { groupId, itemId: targetId }), itemId, groupId);
}

/** Take an item out of its folder and back to the end of the main grid, disbanding a folder left empty. */
export function removeFromGroup(org: LibraryTabOrganization, itemId: string): LibraryTabOrganization {
  const group = groupOf(org, itemId);
  if (!group) return org;

  const members = without(group.members, itemId);
  const moved: LibraryTabOrganization = {
    ...org,
    order: [...org.order, itemId],
    groups: { ...org.groups, [group.id]: { ...group, members } },
    placements: rehome(org.placements, itemId, null),
  };
  return members.length === 0 ? disbandGroup(moved, group.id) : moved;
}

/** Dissolve a folder, leaving its members in the main grid where the folder tile stood. */
export function disbandGroup(org: LibraryTabOrganization, groupId: string): LibraryTabOrganization {
  const group = org.groups[groupId];
  if (!group) return org;

  const slot = org.order.indexOf(groupId);
  const order = slot === -1
    ? [...org.order, ...group.members]
    : spliced(org.order, slot, 1, ...group.members);
  const { [groupId]: _removed, ...groups } = org.groups;

  // The folder's cell frees up and its members arrive homeless, so each takes the first free block
  // rather than claiming a spot some other tile is standing in.
  return {
    ...org,
    order,
    groups,
    sizes: dropKey(org.sizes, groupId),
    placements: rehome(org.placements, groupId, null),
  };
}

/** Rename a folder. A blank name is ignored, so an emptied field leaves the folder named as it was. */
export function renameGroup(
  org: LibraryTabOrganization,
  groupId: string,
  name: string,
): LibraryTabOrganization {
  const group = org.groups[groupId];
  const trimmed = name.trim();
  if (!group || !trimmed) return org;

  return { ...org, groups: { ...org.groups, [groupId]: { ...group, name: trimmed } } };
}

/**
 * Resize one tile, item or folder alike. Medium is the default, so it is stored as no entry.
 *
 * @param ids - The tiles sharing this one's grid. Given, the tile is re-fitted at every arranged width;
 *   omitted, only the size changes and the board is left to be resolved at render time.
 * @param columns - The width being looked at. Its board is stored before the resize when it never has
 *   been, so a width the player has only viewed resizes like an arranged one instead of repacking.
 */
export function setTileSize(
  org: LibraryTabOrganization,
  id: string,
  size: LibraryTileSize,
  ids?: string[],
  columns?: number,
): LibraryTabOrganization {
  if (tileSize(org, id) === size) return org;
  const width = columns ? Math.max(1, Math.floor(columns)) : 0;
  const held = ids && width > 0 && !org.placements[width]
    ? withPlacements(org, width, resolvePlacements(org, ids, width))
    : org;
  const resized = size === 'medium'
    ? { ...held, sizes: dropKey(held.sizes, id) }
    : { ...held, sizes: { ...held.sizes, [id]: size } };
  return ids ? resizePlacements(resized, id, ids) : resized;
}

/**
 * Write the list a drag finished with as the order, wholesale. The main grid reorders live while a
 * drag runs, so the drop hands over the drawn list itself rather than a single move. Inside a folder
 * only the existing members can be rearranged: a drawn list that adds, drops, or invents ids is
 * refused, since an order write must never change what a folder holds.
 *
 * @param container - The folder whose members were rearranged, or null for the main grid
 */
export function setDrawnOrder(
  org: LibraryTabOrganization,
  drawn: string[],
  container?: string | null,
): LibraryTabOrganization {
  if (!container) return { ...org, order: drawn };

  const group = org.groups[container];
  if (!group) return org;
  const members = new Set(group.members);
  const valid = drawn.length === group.members.length && drawn.every((id) => members.has(id))
    && new Set(drawn).size === drawn.length;
  if (!valid) return org;

  return { ...org, groups: { ...org.groups, [container]: { ...group, members: drawn } } };
}

/**
 * Write the board a drag finished with: where every tile in one grid now lives at this width, and the
 * linear order that board reads as.
 *
 * Only the dragged grid's tiles are written, so the folders' member homes at the same width survive
 * untouched. The order follows because plenty still needs one — the detailed layout, and any width the
 * player has yet to visit.
 *
 * @param columns - Base-cell columns the board was arranged at
 * @param places - Every tile's home in that grid, the holes between them included
 * @param ids - The tiles that grid draws
 * @param container - The folder whose members were arranged, or null for the main grid
 */
export function commitPlacements(
  org: LibraryTabOrganization,
  { columns, places, ids, container }: {
    columns: number;
    places: PlacementMap;
    ids: string[];
    container?: string | null;
  },
): LibraryTabOrganization {
  const width = Math.max(1, Math.floor(columns));
  const merged = { ...org.placements[width], ...places };
  return setDrawnOrder(withPlacements(org, width, merged), rowMajor(places, ids), container);
}

/** Pin a folder's member worlds to a prompt preset, or pass null to drop the setting. */
export function setGroupPromptPreset(
  org: LibraryTabOrganization,
  groupId: string,
  presetId: string | null,
): LibraryTabOrganization {
  const group = org.groups[groupId];
  if (!group) return org;

  const { promptPreset: _cleared, ...rest } = group.settings;
  const settings = presetId ? { ...group.settings, promptPreset: presetId } : rest;

  return { ...org, groups: { ...org.groups, [groupId]: { ...group, settings } } };
}

/** The preset an item inherits from the folder it sits in, if that folder carries one. */
export const groupPromptPreset = (org: LibraryTabOrganization, itemId: string): string | undefined =>
  groupOf(org, itemId)?.settings.promptPreset;

/**
 * The tiles the main grid shows: folders and loose items in the saved order, with grouped items hidden
 * and anything the order has never seen sorted to the end — the behavior the flat grid always had.
 *
 * A folder with no surviving member is dropped rather than rendered empty, so a library wiped from
 * another device leaves no ghost folders behind.
 */
export function topLevelIds(org: LibraryTabOrganization, itemIds: string[]): string[] {
  const known = new Set(itemIds);
  const survives = (group: LibraryGroup) => group.members.some((id) => known.has(id));
  const grouped = new Set(
    Object.values(org.groups).flatMap((group) => (survives(group) ? group.members : [])),
  );

  const placed = org.order.filter((id) => {
    const group = org.groups[id];
    return group ? survives(group) : known.has(id) && !grouped.has(id);
  });
  const seen = new Set(placed);

  return [...placed, ...itemIds.filter((id) => !seen.has(id) && !grouped.has(id))];
}

/**
 * Forget every id the library no longer holds — deleted items, and the folders they emptied. Returns
 * the same state when there is nothing to forget, so a load with no deletions writes nothing back.
 */
export function pruneOrganization(
  org: LibraryTabOrganization,
  itemIds: string[],
): LibraryTabOrganization {
  const known = new Set(itemIds);

  const groups: Record<string, LibraryGroup> = {};
  for (const [id, group] of Object.entries(org.groups)) {
    const members = group.members.filter((member) => known.has(member));
    if (members.length > 0) groups[id] = { ...group, members };
  }
  const order = org.order.filter((id) => (id in org.groups ? id in groups : known.has(id)));
  const sizes = Object.fromEntries(
    Object.entries(org.sizes).filter(([id]) => known.has(id) || id in groups),
  );

  // A deleted tile's cells free up and everything else keeps its home, so a deletion never reflows.
  const placements = prunePlacements(org.placements, new Set([...itemIds, ...Object.keys(groups)]));

  const unchanged = order.length === org.order.length
    && Object.keys(groups).length === Object.keys(org.groups).length
    && Object.keys(sizes).length === Object.keys(org.sizes).length
    && placements === org.placements
    && Object.entries(groups).every(([id, group]) => group.members.length === org.groups[id].members.length);

  return unchanged ? org : { ...org, order, groups, sizes, placements };
}
