import {
  NEW_GROUP_NAME,
  type LibraryGroup,
  type LibraryTabOrganization,
  type LibraryTileSize,
} from './types';

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
    order: slot === -1 ? [...org.order, groupId] : spliced(org.order, slot, 1, groupId),
    groups: {
      ...groups,
      [groupId]: { id: groupId, name: NEW_GROUP_NAME, members: [itemId], settings: {} },
    },
    sizes: size ? { ...org.sizes, [groupId]: size } : org.sizes,
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
    order: without(org.order, itemId),
    groups: { ...groups, [groupId]: { ...groups[groupId], members: [...groups[groupId].members, itemId] } },
    sizes: org.sizes,
  };
}

/** Take an item out of its folder and back to the end of the main grid, disbanding a folder left empty. */
export function removeFromGroup(org: LibraryTabOrganization, itemId: string): LibraryTabOrganization {
  const group = groupOf(org, itemId);
  if (!group) return org;

  const members = without(group.members, itemId);
  const moved: LibraryTabOrganization = {
    order: [...org.order, itemId],
    groups: { ...org.groups, [group.id]: { ...group, members } },
    sizes: org.sizes,
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
  const { [groupId]: _size, ...sizes } = org.sizes;

  return { order, groups, sizes };
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

/** Resize one tile, item or folder alike. Medium is the default, so it is stored as no entry. */
export function setTileSize(
  org: LibraryTabOrganization,
  id: string,
  size: LibraryTileSize,
): LibraryTabOrganization {
  if (tileSize(org, id) === size) return org;
  if (size === 'medium') {
    const { [id]: _dropped, ...sizes } = org.sizes;
    return { ...org, sizes };
  }
  return { ...org, sizes: { ...org.sizes, [id]: size } };
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

  const unchanged = order.length === org.order.length
    && Object.keys(groups).length === Object.keys(org.groups).length
    && Object.keys(sizes).length === Object.keys(org.sizes).length
    && Object.entries(groups).every(([id, group]) => group.members.length === org.groups[id].members.length);

  return unchanged ? org : { order, groups, sizes };
}
