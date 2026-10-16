// Stats an entity owns: pure edits of one entity's own stat list. A stat here is the world stat type.

import type { Entity, Stat, StatGroup } from '@/types';
import { newStat, withDefaultDescriptors } from './blankWorld';
import { followRename } from './statDescriptors';
import { duplicateStatNode, newStatGroup } from './statGroupTree';
import { entityStatRootCount } from './statLinks';
import { withEntityLists } from './ownerTree';

/** The entity with its owned stats replaced. An empty list is stored as absent. */
export const withOwnedStats = (entity: Entity, stats: Stat[]): Entity => withEntityLists(entity, { stats });

/** The entity with its owned stats and stat groups replaced. An empty list is stored as absent. */
export const withOwnedStatTree = (entity: Entity, stats: Stat[], groups: StatGroup[]): Entity =>
  withEntityLists(entity, { stats, statGroups: groups });

const statsOf = (entity: Entity): Stat[] => entity.stats ?? [];
const groupsOf = (entity: Entity): StatGroup[] => entity.statGroups ?? [];

/** Append a new stat at the end of the entity's top level. */
export const addOwnedStat = (entity: Entity, id: string, name?: string): Entity => {
  const added = withDefaultDescriptors({
    ...newStat(id, name), groupId: null, order: entityStatRootCount(entity),
  });
  return withOwnedStats(entity, [...statsOf(entity), added]);
};

/** Append a new group at the end of the entity's top level. */
export const addOwnedStatGroup = (entity: Entity, id: string, name?: string): Entity =>
  withOwnedStatTree(
    entity, statsOf(entity), [...groupsOf(entity), newStatGroup(id, entityStatRootCount(entity), name)],
  );

/** Replace group `group.id`. */
export const updateOwnedStatGroup = (entity: Entity, group: StatGroup): Entity =>
  withOwnedStatTree(entity, statsOf(entity), groupsOf(entity).map((g) => (g.id === group.id ? group : g)));


/** Copy a stat or a whole group right after its original; `newId` is the copy's id. The entity itself for an id
 *  it lacks. */
export function duplicateOwnedStatNode(entity: Entity, id: string): { entity: Entity; newId: string } {
  const next = duplicateStatNode(groupsOf(entity), statsOf(entity), id);
  return next.newId === id ? { entity, newId: id } : { entity: withOwnedStatTree(entity, next.stats, next.groups), newId: next.newId };
}

/** Replace stat `stat.id`. A default descriptor follows the stat's name, as it does on the Stats tab. */
export const updateOwnedStat = (entity: Entity, stat: Stat): Entity =>
  withOwnedStats(entity, statsOf(entity).map((s) => {
    if (s.id !== stat.id) return s;
    const descriptors = followRename(s, stat);
    return descriptors === stat.descriptors ? stat : { ...stat, descriptors };
  }));

export const removeOwnedStat = (entity: Entity, id: string): Entity =>
  withOwnedStats(entity, statsOf(entity).filter((s) => s.id !== id));
