import type { EntityPositions } from '@/types';
import type { EntityPresence } from '@/lib/presence';

/** Location id → the names of the met entities shown there, in cast order. */
export type MetRoster = Readonly<Record<string, string[]>>;

/** Each Met entity at its places; `anchors` places a runtime character that lists none. */
export function metRosterByLocation(met: readonly EntityPresence[], anchors: Readonly<EntityPositions>): MetRoster {
  const roster: Record<string, string[]> = {};
  for (const { entity, label } of met) {
    const places = entity.locations?.length ? entity.locations : anchors[entity.id] ? [anchors[entity.id]] : [];
    for (const at of new Set(places)) (roster[at] ??= []).push(label ?? entity.name);
  }
  return roster;
}
