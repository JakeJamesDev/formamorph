// Stats an entity owns: pure edits of one entity's own stat list. A stat here is the world stat type.

import { arrayMove } from '@dnd-kit/sortable';
import type { Entity, Stat } from '@/types';
import { newStat, withDefaultDescriptors } from './blankWorld';
import { followRename } from './statDescriptors';

/** The entity with its owned stats replaced. An empty list is stored as absent. */
export function withOwnedStats(entity: Entity, stats: Stat[]): Entity {
  const { stats: _stats, ...rest } = entity;
  return stats.length ? { ...rest, stats } : rest;
}

const statsOf = (entity: Entity): Stat[] => entity.stats ?? [];

/** Append a new stat at the end of the entity's list. */
export const addOwnedStat = (entity: Entity, id: string, name?: string): Entity =>
  withOwnedStats(entity, [...statsOf(entity), withDefaultDescriptors(newStat(id, name))]);

/** Replace stat `stat.id`. A default descriptor follows the stat's name, as it does on the Stats tab. */
export const updateOwnedStat = (entity: Entity, stat: Stat): Entity =>
  withOwnedStats(entity, statsOf(entity).map((s) => {
    if (s.id !== stat.id) return s;
    const descriptors = followRename(s, stat);
    return descriptors === stat.descriptors ? stat : { ...stat, descriptors };
  }));

export const removeOwnedStat = (entity: Entity, id: string): Entity =>
  withOwnedStats(entity, statsOf(entity).filter((s) => s.id !== id));

/** The list with a copy of stat `id` right after it, under `newId`. The list itself for an id it lacks. */
export function withStatCopy(stats: Stat[], id: string, newId: string): Stat[] {
  const index = stats.findIndex((s) => s.id === id);
  if (index === -1) return stats;
  const copy = { ...structuredClone(stats[index]), id: newId };
  copy.name = `${copy.name} (Copy)`;
  return [...stats.slice(0, index + 1), copy, ...stats.slice(index + 1)];
}

/** The list with stat `activeId` moved to the place of `overId`. The list itself for an id it lacks. */
export function withStatMoved(stats: Stat[], activeId: string, overId: string): Stat[] {
  const from = stats.findIndex((s) => s.id === activeId);
  const to = stats.findIndex((s) => s.id === overId);
  return from === -1 || to === -1 ? stats : arrayMove(stats, from, to);
}

export const duplicateOwnedStat = (entity: Entity, id: string, newId: string): Entity => {
  const stats = statsOf(entity);
  const next = withStatCopy(stats, id, newId);
  return next === stats ? entity : withOwnedStats(entity, next);
};

export const moveOwnedStat = (entity: Entity, activeId: string, overId: string): Entity => {
  const stats = statsOf(entity);
  const next = withStatMoved(stats, activeId, overId);
  return next === stats ? entity : withOwnedStats(entity, next);
};
