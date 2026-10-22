// The stat folder tree (groups + stats, nestable via parentId/groupId): a binding of the generic groupTree
// machinery to Stat/StatGroup, for the world's stats and for each entity's own. A stat list is stored in tree
// order, so every reader that walks the plain array sees the order the author drew.

import {
  buildTree, flattenTree, getDropProjection, applyDrop, duplicateNode,
  removeChildrenOf as removeChildrenOfGeneric, removeGroupPromotingChildren,
  type GroupTreeNode, type FlatTreeNode, type TreeLeaf,
} from './groupTree';
import type { Stat, StatGroup } from '@/types';

export type StatTreeNode = GroupTreeNode<StatGroup, Stat>;
export type FlatStatNode = FlatTreeNode<StatGroup, Stat>;

/** The name the Stats tab's Add Group gives a group. */
const NEW_STAT_GROUP_NAME = 'New Group';

/** A stat group as the editor's Add Group makes it, placed `order`th at the tree's root. */
export const newStatGroup = (id: string, order: number, name = NEW_STAT_GROUP_NAME): StatGroup =>
  ({ id, name, aiDescription: '', parentId: null, order });

/** How many stats and stat groups sit at the tree's root: the `order` a new root item takes. */
export function statRootCount(groups: readonly StatGroup[] | undefined, stats: readonly Pick<Stat, 'groupId'>[] | undefined): number {
  const known = new Set((groups ?? []).map((g) => g.id));
  return (stats ?? []).filter((s) => s.groupId == null || !known.has(s.groupId)).length
    + (groups ?? []).filter((g) => g.parentId == null || !known.has(g.parentId)).length;
}

export const buildStatTree = (groups: readonly StatGroup[], stats: readonly Stat[]): StatTreeNode[] => buildTree(groups, stats);

export const flattenStatTree = (tree: StatTreeNode[]): FlatStatNode[] => flattenTree(tree);

export const removeChildrenOf = (items: FlatStatNode[], ids: Iterable<string>): FlatStatNode[] =>
  removeChildrenOfGeneric(items, ids);

/** Projected drop `{depth, parentId}` for the active row, given the pointer's horizontal drag offset. */
export const getStatDropProjection = (
  items: FlatStatNode[], activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): { depth: number; parentId: string | null } => getDropProjection(items, activeId, overId, dragOffset, indentationWidth);

/** The stats in the order the Stats tab draws them: group nesting, then sibling order. */
export const statsInTreeOrder = <L extends TreeLeaf = Stat>(groups: readonly StatGroup[], stats: readonly L[]): L[] =>
  flattenTree(buildTree(groups, stats)).flatMap((node) => (node.leaf ? [node.leaf] : []));

/** Resolve a drag into new groups and stats (re-parent, reindex). Stats come back in tree order. Illegal and
 *  unfound moves change nothing. */
export function applyStatDrop(
  groups: StatGroup[], stats: Stat[], collapsedIds: Iterable<string>,
  activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): { groups: StatGroup[]; stats: Stat[] } {
  const r = applyDrop(groups, stats, collapsedIds, activeId, overId, dragOffset, indentationWidth);
  return { groups: r.groups, stats: statsInTreeOrder(r.groups, r.leaves) };
}

/** Deep-duplicate a stat or a whole group subtree, inserting the copy right after the original. */
export function duplicateStatNode(
  groups: StatGroup[], stats: Stat[], id: string,
): { groups: StatGroup[]; stats: Stat[]; newId: string } {
  const r = duplicateNode(groups, stats, id);
  return { groups: r.groups, stats: statsInTreeOrder(r.groups, r.leaves), newId: r.newId };
}

/** Delete a group. Its subgroups and stats move up to its parent, into the slot the group held, rather than
 *  vanishing under a deleted id. Stats come back in tree order. Unchanged inputs keep identity. */
export function removeStatGroup<L extends TreeLeaf = Stat>(
  groups: StatGroup[], stats: L[], id: string,
): { groups: StatGroup[]; stats: L[] } {
  const next = removeGroupPromotingChildren(groups, stats, id);
  if (next.groups === groups) return { groups, stats };
  return { groups: next.groups, stats: statsInTreeOrder(next.groups, next.leaves) };
}

/** One node of the in-game panel's stat layout: a collapsible group with what it holds, or one stat. */
export type StatLayoutNode<T> =
  | { kind: 'group'; group: StatGroup; children: StatLayoutNode<T>[] }
  | { kind: 'stat'; item: T };

/**
 * The stats the player can see, laid out as the author grouped them. `authored` decides placement, so a save's
 * frozen copy of a stat follows a regrouping; `items` are the live rows to show, matched by `idOf`. An item
 * the authored list lacks sits at the top level after the grouped ones. A group holding nothing visible,
 * directly or below, is left out.
 */
export function statPanelLayout<T>(
  groups: readonly StatGroup[], authored: readonly Stat[], items: readonly T[], idOf: (item: T) => string,
): StatLayoutNode<T>[] {
  const byId = new Map(items.map((item) => [idOf(item), item]));
  const build = (nodes: StatTreeNode[]): StatLayoutNode<T>[] => nodes.flatMap((node): StatLayoutNode<T>[] => {
    if (node.kind === 'leaf') {
      const item = byId.get(node.id);
      return item === undefined ? [] : [{ kind: 'stat', item }];
    }
    const children = build(node.children);
    return children.length ? [{ kind: 'group', group: node.group, children }] : [];
  });
  const placed = new Set(authored.map((s) => s.id));
  const loose = items.filter((item) => !placed.has(idOf(item))).map((item): StatLayoutNode<T> => ({ kind: 'stat', item }));
  return [...build(buildStatTree(groups, authored)), ...loose];
}

/** A run of stats under one group heading. */
export interface StatPanelBlock<T> {
  key: string;
  /** Path of group names ("Body › Reflexes"); null for the stats outside any group. */
  path: string[] | null;
  items: T[];
}

/**
 * A layout flattened the way the Traits tab draws its groups: the stats outside any group first, then each
 * group's own stats under its path, its subgroups after it. A group with no stat of its own adds no block.
 */
export function statPanelBlocks<T>(nodes: readonly StatLayoutNode<T>[]): StatPanelBlock<T>[] {
  const stats = (list: readonly StatLayoutNode<T>[]) => list.flatMap((n) => (n.kind === 'stat' ? [n.item] : []));
  const blocks: StatPanelBlock<T>[] = [];
  const walk = (list: readonly StatLayoutNode<T>[], path: string[]) => {
    for (const node of list) {
      if (node.kind !== 'group') continue;
      const at = [...path, node.group.name];
      const own = stats(node.children);
      if (own.length) blocks.push({ key: node.group.id, path: at, items: own });
      walk(node.children, at);
    }
  };
  const root = stats(nodes);
  if (root.length) blocks.push({ key: 'root', path: null, items: root });
  walk(nodes, []);
  return blocks;
}
