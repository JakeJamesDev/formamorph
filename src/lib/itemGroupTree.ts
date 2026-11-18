// The Items tab folder tree: the generic groupTree machinery bound to Item/ItemGroup. Groups are editor-only
// and never reach the AI or the player.

import {
  buildTree, flattenTree, getDropProjection, applyDrop, duplicateNode, removeChildrenOf,
  type FlatTreeNode,
} from './groupTree';
import { remintItemCopy } from './items';
import type { Item, ItemGroup } from '@/types';

export type FlatItemNode = FlatTreeNode<ItemGroup, Item>;

/** The Items tab's rows, depth-first, each tagged with its parent and depth. */
export const flattenItemTree = (groups: readonly ItemGroup[], items: readonly Item[]): FlatItemNode[] =>
  flattenTree(buildTree(groups, items));

/** Items in the order the Items tab shows them, for pickers elsewhere. */
export const itemsInTabOrder = (groups: readonly ItemGroup[], items: readonly Item[]): Item[] =>
  flattenItemTree(groups, items).flatMap((n) => (n.leaf ? [n.leaf] : []));

/** The tab's rows with every row below a collapsed group left out. */
export const visibleItemRows = (groups: readonly ItemGroup[], items: readonly Item[], collapsed: Iterable<string>): FlatItemNode[] =>
  removeChildrenOf(flattenItemTree(groups, items), collapsed);

/** The depth a drag would drop the active row at, or null when it has no drop. */
export const itemDropDepth = (
  rows: FlatItemNode[], activeId: string, overId: string, offsetLeft: number, indent: number,
): number | null => getDropProjection(rows, activeId, overId, offsetLeft, indent)?.depth ?? null;

/** Resolves a drag into new groups and items (re-parent and reindex). An illegal or unfound move changes nothing. */
export function applyItemDrop(
  groups: ItemGroup[], items: Item[], collapsedIds: Iterable<string>,
  activeId: string, overId: string, offsetLeft: number, indent: number,
): { groups: ItemGroup[]; items: Item[] } {
  const r = applyDrop(groups, items, collapsedIds, activeId, overId, offsetLeft, indent);
  return { groups: r.groups, items: r.leaves };
}

/** How many items and item groups sit at the tree's root: the `order` a new root row takes. */
export const itemRootCount = (groups: readonly ItemGroup[], items: readonly Item[]): number =>
  items.filter((i) => (i.groupId ?? null) === null).length + groups.filter((g) => g.parentId === null).length;

/** Deep-copies an item or a whole group, placing the copy right after the original. Each copied item gets
 *  fresh ids for its effect rows and its own placeholders. */
export function duplicateItemNode(
  groups: ItemGroup[], items: Item[], id: string,
): { groups: ItemGroup[]; items: Item[]; newId: string } {
  const r = duplicateNode(groups, items, id);
  if (r.leaves === items) return { groups: r.groups, items, newId: r.newId };
  const original = new Set(items.map((i) => i.id));
  const next = r.leaves.map((i) => (original.has(i.id) ? i : remintItemCopy(i)));
  // A copied item also sits right after its source in the world's list, which pickers read.
  const at = items.findIndex((i) => i.id === id);
  if (at >= 0) next.splice(at + 1, 0, next.pop()!);
  return { groups: r.groups, items: next, newId: r.newId };
}
