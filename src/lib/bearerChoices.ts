// The rows of the flyouts that pick a bearer: Custom Persona, then the world's entities under their entity groups.

import { buildEntityTree, flattenEntityTree } from './entityGroupTree';
import { CUSTOM_PERSONA_ID, CUSTOM_PERSONA_NAME } from './traitTree';
import type { Entity, EntityGroup } from '@/types';

/** One row of a drill-down level. `parentId` is the entity group the row sits in; null = the top level. */
export type BearerChoice =
  | { kind: 'group'; id: string; name: string; parentId: string | null }
  | { kind: 'bearer'; id: string; name: string; parentId: string | null; customPersona?: true };

/** Custom Persona first when asked for, then every entity and entity group in Entities tab order. A group
 *  with no entity anywhere below it has no row. */
export function bearerChoices(
  groups: EntityGroup[], entities: Entity[], { customPersona = false } = {},
): BearerChoice[] {
  const rows = flattenEntityTree(buildEntityTree(groups, entities));
  const holdsEntity = new Set<string>();
  for (const row of rows) {
    if (!row.leaf) continue;
    for (let at = row.leaf.groupId ?? null; at; at = groups.find((g) => g.id === at)?.parentId ?? null) holdsEntity.add(at);
  }
  const choices: BearerChoice[] = customPersona
    ? [{ kind: 'bearer', id: CUSTOM_PERSONA_ID, name: CUSTOM_PERSONA_NAME, parentId: null, customPersona: true }]
    : [];
  for (const row of rows) {
    if (row.leaf) {
      choices.push({ kind: 'bearer', id: row.leaf.id, name: row.leaf.name, parentId: row.parentId });
    } else if (row.group && holdsEntity.has(row.group.id)) {
      choices.push({ kind: 'group', id: row.group.id, name: row.group.name, parentId: row.parentId });
    }
  }
  return choices;
}
