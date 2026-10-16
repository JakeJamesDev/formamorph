// Where Blueprints sits in a world's trait or stat group tree. A leaf module, so the gate module can read it.

/** A world group as the Blueprints walk reads it. */
interface BlueprintsWalkGroup { id: string; parentId: string | null; system?: 'blueprints' }

/** The world's Blueprints group, when the author added one. */
export const blueprintsGroup = <G extends BlueprintsWalkGroup>(groups: readonly G[]): G | undefined =>
  groups.find((g) => g.system === 'blueprints');

/** Every group below `groupId`, depth-first. */
export function groupsBelow<G extends BlueprintsWalkGroup>(groups: readonly G[], groupId: string): G[] {
  const out: G[] = [];
  const walk = (parentId: string) => {
    for (const g of groups) if (g.parentId === parentId) { out.push(g); walk(g.id); }
  };
  walk(groupId);
  return out;
}

/** Blueprints and every world group below it. Empty when the world has no Blueprints group. */
export function blueprintsSubtreeIds(groups: readonly BlueprintsWalkGroup[]): Set<string> {
  const blueprints = blueprintsGroup(groups);
  return new Set(blueprints ? [blueprints.id, ...groupsBelow(groups, blueprints.id).map((g) => g.id)] : []);
}
