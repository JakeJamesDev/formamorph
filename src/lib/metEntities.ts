import type { DiscoveredEntity, Entity, EntityPositions, SceneEntity } from '@/types';
import { resolveEntityByName } from '@/lib/entityMatch';

/** `met` plus each entity the scene lists by its revealed name, in scene order. The same array when nobody
 *  new is met. */
export function metFromScene(met: readonly string[], scene: readonly SceneEntity[], entities: readonly Entity[]): readonly string[] {
  const known = new Set(met);
  const added: string[] = [];
  for (const row of scene) {
    if (!row.revealed) continue;
    const id = resolveEntityByName(row.name, entities)?.id;
    if (id && !known.has(id)) {
      known.add(id);
      added.push(id);
    }
  }
  return added.length ? [...met, ...added] : met;
}

/** Each runtime character's position: the location it was met at. */
export function runtimeCharacterPositions(discovered: readonly DiscoveredEntity[]): EntityPositions {
  const positions: EntityPositions = {};
  for (const { entity, locationId } of discovered) if (locationId) positions[entity.id] = locationId;
  return positions;
}

/** Location id → the names of the met entities positioned there, in cast order. */
export type MetRoster = Readonly<Record<string, string[]>>;

/** Where each met entity with a position stands. */
export function metRosterByLocation({ entities, positions, met }: {
  entities: readonly Entity[];
  positions: Readonly<EntityPositions>;
  met: readonly string[];
}): MetRoster {
  const metIds = new Set(met);
  const roster: Record<string, string[]> = {};
  for (const entity of entities) {
    const at = positions[entity.id];
    if (at === undefined || !metIds.has(entity.id)) continue;
    (roster[at] ??= []).push(entity.name);
  }
  return roster;
}
