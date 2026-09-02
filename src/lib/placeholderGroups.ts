// Editor folders for the world's shared placeholders. A group is a name with a parent, a placeholder names
// its group by `groupId`, and the Placeholders tab draws the folders above the loose rows. Only a shared
// placeholder is grouped: a scoped one sits under its entity or book, an owned one under its holder. Pure,
// like the entity folder tree it mirrors: the world tab and the chip menus read these, nothing writes them
// but a drop or a delete.

import { buildTree, flattenTree, isDescendantGroup } from './groupTree';
import { PLACEHOLDER_PATH_SEPARATOR } from './placeholders';
import type { Placeholder, PlaceholderGroup } from '@/types';

/** The folder a placeholder sits in: null when ungrouped, or when the folder it names is gone. A dangling
 *  reference reads as loose rather than hiding the row. */
export function placeholderGroupOf(groups: readonly PlaceholderGroup[], placeholder: Pick<Placeholder, 'groupId'>): string | null {
  const id = placeholder.groupId ?? null;
  return id !== null && groups.some((g) => g.id === id) ? id : null;
}

/** Direct subfolders of `parentId` (null for the top level), in sibling order. */
export function childPlaceholderGroups(groups: readonly PlaceholderGroup[], parentId: string | null): PlaceholderGroup[] {
  const known = new Set(groups.map((g) => g.id));
  return groups
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => (group.parentId !== null && known.has(group.parentId) ? group.parentId : null) === parentId)
    .sort((a, b) => (a.group.order ?? a.index) - (b.group.order ?? b.index))
    .map(({ group }) => group);
}

/** One folder as the tab lists it: its depth, and the path of names above and including it. */
export interface OrderedPlaceholderGroup {
  group: PlaceholderGroup;
  depth: number;
  /** `Body › Face` — the heading a chip menu puts over the folder's placeholders, so two subfolders of one
   *  name under different parents read apart. */
  heading: string;
}

/** Every folder depth-first in tree order, each with its heading. */
export function placeholderGroupsInTreeOrder(groups: readonly PlaceholderGroup[]): OrderedPlaceholderGroup[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const headings = new Map<string, string>();
  return flattenTree(buildTree([...groups], [])).flatMap((node) => {
    const group = node.group && byId.get(node.id);
    if (!group) return [];
    const above = node.parentId === null ? undefined : headings.get(node.parentId);
    const heading = above ? `${above}${PLACEHOLDER_PATH_SEPARATOR}${group.name}` : group.name;
    headings.set(group.id, heading);
    return [{ group, depth: node.depth, heading }];
  });
}

/** True if `candidateId` is `ancestorId` itself or nested anywhere beneath it. */
export function isDescendantPlaceholderGroup(groups: readonly PlaceholderGroup[], ancestorId: string, candidateId: string): boolean {
  return isDescendantGroup([...groups], ancestorId, candidateId);
}

/** The placeholder in folder `groupId`; null puts it back among the loose rows. Absence is what a loose
 *  row stores, so a world that never used folders serializes as it did. */
export function withPlaceholderGroup(placeholder: Placeholder, groupId: string | null): Placeholder {
  if (groupId === null) {
    if (placeholder.groupId === undefined) return placeholder;
    const { groupId: _gone, ...rest } = placeholder;
    return rest;
  }
  return placeholder.groupId === groupId ? placeholder : { ...placeholder, groupId };
}

/** Delete a folder. Its subfolders and placeholders move up to its parent rather than vanishing under a
 *  deleted id. Unchanged inputs keep identity. */
export function removePlaceholderGroup(
  groups: PlaceholderGroup[], placeholders: Placeholder[], id: string,
): { groups: PlaceholderGroup[]; placeholders: Placeholder[] } {
  const doomed = groups.find((g) => g.id === id);
  if (!doomed) return { groups, placeholders };
  const parentId = doomed.parentId;
  return {
    groups: groups.filter((g) => g.id !== id).map((g) => (g.parentId === id ? { ...g, parentId } : g)),
    placeholders: placeholders.some((p) => p.groupId === id)
      ? placeholders.map((p) => (p.groupId === id ? withPlaceholderGroup(p, parentId) : p))
      : placeholders,
  };
}

/** Placeholders as they travel off-world, in a character card or dictionary file: the folders are the
 *  world's, so the reference to one goes. Returns the list itself when nothing names a folder. */
export function portablePlaceholders(list: Placeholder[]): Placeholder[] {
  return list.some((p) => p.groupId !== undefined) ? list.map((p) => withPlaceholderGroup(p, null)) : list;
}
