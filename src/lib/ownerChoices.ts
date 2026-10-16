// The rows of the flyouts that pick an owner or a Blueprint: a group tree's leaves under their groups.

import { ancestors, parentLookup } from './ancestors';
import { buildTree, flattenTree, type TreeGroup, type TreeLeaf } from './groupTree';
import type { Entity, EntityGroup } from '@/types';

/** One row of a drill-down level. `parentId` is the group the row sits in; null = the top level. An owner row
 *  carries `customPersona` when the entity holds that mark. */
export type OwnerChoice =
  | { kind: 'group'; id: string; name: string; parentId: string | null }
  | { kind: 'owner'; id: string; name: string; parentId: string | null; customPersona?: true };

/** Every leaf and group in tree order. A group with no leaf anywhere below it has no row. */
export function treeChoices<L extends TreeLeaf>(
  groups: readonly TreeGroup[], leaves: readonly L[], mark: (leaf: L) => { customPersona?: true } = () => ({}),
): OwnerChoice[] {
  const parentOfGroup = parentLookup(groups, (g) => g.parentId);
  const holdsLeaf = new Set<string>();
  for (const leaf of leaves) {
    if (!leaf.groupId) continue;
    holdsLeaf.add(leaf.groupId);
    for (const above of ancestors(leaf.groupId, parentOfGroup)) holdsLeaf.add(above);
  }
  return flattenTree(buildTree(groups, leaves)).flatMap((row): OwnerChoice[] => {
    if (row.leaf) return [{ kind: 'owner', id: row.leaf.id, name: row.leaf.name, parentId: row.parentId, ...mark(row.leaf) }];
    return row.group && holdsLeaf.has(row.group.id) ? [{ kind: 'group', id: row.group.id, name: row.group.name, parentId: row.parentId }] : [];
  });
}

/** Every entity and entity group in Entities tab order. */
export const ownerChoices = (groups: EntityGroup[], entities: Entity[]): OwnerChoice[] =>
  treeChoices(groups, entities, (e) => (e.customPersona ? { customPersona: true } : {}));
