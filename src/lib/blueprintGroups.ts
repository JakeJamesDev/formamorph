// Where Blueprints sits in a world's group tree. A leaf module, so the gate module can read it.

import type { TraitGroup } from '@/types';

/** The world's Blueprints group, when the author added one. */
export const blueprintsGroup = (groups: readonly TraitGroup[]): TraitGroup | undefined =>
  groups.find((g) => g.system === 'blueprints');

/** Every group below `groupId`, depth-first. */
export function groupsBelow(groups: readonly TraitGroup[], groupId: string): TraitGroup[] {
  const out: TraitGroup[] = [];
  const walk = (parentId: string) => {
    for (const g of groups) if (g.parentId === parentId) { out.push(g); walk(g.id); }
  };
  walk(groupId);
  return out;
}

/** Blueprints and every world group below it. Empty when the world has no Blueprints group. */
export function blueprintsSubtreeIds(groups: readonly TraitGroup[]): Set<string> {
  const blueprints = blueprintsGroup(groups);
  return new Set(blueprints ? [blueprints.id, ...groupsBelow(groups, blueprints.id).map((g) => g.id)] : []);
}
