import type { EntityPresence } from '@/lib/presence';

/** Location id → the names of the met entities shown there, in cast order. */
export type MetRoster = Readonly<Record<string, string[]>>;

/** Each Met entity at its places. */
export function metRosterByLocation(met: readonly EntityPresence[]): MetRoster {
  const roster: Record<string, string[]> = {};
  for (const { entity, label } of met) {
    for (const at of new Set(entity.locations ?? [])) (roster[at] ??= []).push(label ?? entity.name);
  }
  return roster;
}
