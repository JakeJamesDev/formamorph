// The rows of the flyouts that pick an owner: the world's entities under their entity groups.

import { ancestors, parentLookup } from './ancestors';
import { buildEntityTree, flattenEntityTree } from './entityGroupTree';
import type { Entity, EntityGroup } from '@/types';

/** One row of a drill-down level. `parentId` is the entity group the row sits in; null = the top level. An
 *  owner row carries `customPersona` when the entity holds that mark. */
export type OwnerChoice =
  | { kind: 'group'; id: string; name: string; parentId: string | null }
  | { kind: 'owner'; id: string; name: string; parentId: string | null; customPersona?: true };

/** Every entity and entity group in Entities tab order. A group with no entity anywhere below it has no row. */
export function ownerChoices(groups: EntityGroup[], entities: Entity[]): OwnerChoice[] {
  const rows = flattenEntityTree(buildEntityTree(groups, entities));
  const parentOfGroup = parentLookup(groups, (g) => g.parentId);
  const holdsEntity = new Set<string>();
  for (const row of rows) {
    if (!row.leaf) continue;
    const start = row.leaf.groupId;
    if (!start) continue;
    holdsEntity.add(start);
    for (const above of ancestors(start, parentOfGroup)) holdsEntity.add(above);
  }
  const choices: OwnerChoice[] = [];
  for (const row of rows) {
    if (row.leaf) {
      choices.push({ kind: 'owner', id: row.leaf.id, name: row.leaf.name, parentId: row.parentId, ...(row.leaf.customPersona ? { customPersona: true } : {}) });
    } else if (row.group && holdsEntity.has(row.group.id)) {
      choices.push({ kind: 'group', id: row.group.id, name: row.group.name, parentId: row.parentId });
    }
  }
  return choices;
}
