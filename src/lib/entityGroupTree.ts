// The entity folder tree (groups + entities, nestable via parentId/groupId) — a binding of the generic
// groupTree machinery to Entity/EntityGroup. Groups are editor-only organization and are NEVER sent to the AI
// (unlike traits, there is deliberately no build*Context here) — entities feed the AI exactly as if ungrouped.

import {
  buildTree, flattenTree, getDropProjection, applyDrop, duplicateNode,
  removeChildrenOf as removeChildrenOfGeneric, isDescendantGroup as isDescendantGroupGeneric,
  type GroupTreeNode, type FlatTreeNode,
} from './groupTree';
import type { Entity, EntityGroup } from '@/types';

export type EntityTreeNode = GroupTreeNode<EntityGroup, Entity>;
export type FlatEntityNode = FlatTreeNode<EntityGroup, Entity>;

/** Build the full ordered tree of top-level nodes, each group carrying its recursive children. */
export const buildEntityTree = (groups: EntityGroup[], entities: Entity[]): EntityTreeNode[] =>
  buildTree(groups, entities);

/** True if `candidateId` is `ancestorId` itself or nested anywhere beneath it — guards illegal moves. */
export const isDescendantGroup = (groups: EntityGroup[], ancestorId: string, candidateId: string): boolean =>
  isDescendantGroupGeneric(groups, ancestorId, candidateId);

/** Depth-first flatten of the tree, tagging each node with its parent and indentation depth. */
export const flattenEntityTree = (tree: EntityTreeNode[]): FlatEntityNode[] => flattenTree(tree);

/** Drop every node that descends from any id in `ids` (collapsed groups, the dragged subtree). */
export const removeChildrenOf = (items: FlatEntityNode[], ids: Iterable<string>): FlatEntityNode[] =>
  removeChildrenOfGeneric(items, ids);

/** Projected drop `{depth, parentId}` for the active row, given the pointer's horizontal drag offset. */
export const getEntityDropProjection = (
  items: FlatEntityNode[], activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): { depth: number; parentId: string | null } =>
  getDropProjection(items, activeId, overId, dragOffset, indentationWidth);

/** Deep-duplicate an entity or a whole group subtree, inserting the copy right after the original. */
export function duplicateEntityNode(
  groups: EntityGroup[], entities: Entity[], id: string,
): { groups: EntityGroup[]; entities: Entity[]; newId: string } {
  const r = duplicateNode(groups, entities, id);
  return { groups: r.groups, entities: r.leaves, newId: r.newId };
}

/** Resolve a drag into new groups/entities arrays (re-parent + reindex). Illegal/unfound moves are no-ops. */
export function applyEntityDrop(
  groups: EntityGroup[], entities: Entity[], collapsedIds: Iterable<string>,
  activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): { groups: EntityGroup[]; entities: Entity[] } {
  const r = applyDrop(groups, entities, collapsedIds, activeId, overId, dragOffset, indentationWidth);
  return { groups: r.groups, entities: r.leaves };
}
