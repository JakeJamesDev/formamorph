import type { EntityPresence } from '@/lib/presence';

/** Location id → the names of the known entities shown there, in cast order. */
export type MetRoster = Readonly<Record<string, string[]>>;

/** Each entity the player knows by name at its places. */
export function metRosterByLocation(known: readonly EntityPresence[]): MetRoster {
  const roster: Record<string, string[]> = {};
  for (const { entity, label } of known) {
    for (const at of new Set(entity.locations ?? [])) (roster[at] ??= []).push(label ?? entity.name);
  }
  return roster;
}
