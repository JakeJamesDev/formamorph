import type { Entity } from "@/types";

/**
 * The inverted index over entity-owned location membership (see ADR-0003). Entities carry the locations
 * they belong to; every roster that asks "who is at this place" reads it through here, so there is one
 * inversion rather than one per caller.
 *
 * Roster order is the entity array's own order — the author's ordering of the cast — since an
 * entity-owned list carries no rank within a location.
 */

/** The ids of the entities that belong to `locationId`. Empty for a location nobody lists. */
export function entityIdsAt(locationId: string | null | undefined, entities: Entity[]): string[] {
  if (!locationId) return [];
  return entities.filter((e) => e.locations?.includes(locationId)).map((e) => e.id);
}

/** The deduped ids of the entities that belong to any of `locationIds` — the union a multi-location scope
 *  (sub-locations, reachable) rosters. Each entity appears once however many of the places it lists. */
export function entityIdsAtAny(locationIds: string[], entities: Entity[]): string[] {
  const scope = new Set(locationIds);
  return entities.filter((e) => e.locations?.some((id) => scope.has(id))).map((e) => e.id);
}

/** A copy of `entity` belonging to exactly `locationIds`, deduped. An empty list drops the field rather
 *  than storing `[]`, so an entity placed nowhere exports as clean as one that never had a membership. */
export function withEntityLocations(entity: Entity, locationIds: string[]): Entity {
  const locations = [...new Set(locationIds)];
  if (locations.length === 0) {
    const { locations: _none, ...rest } = entity;
    return rest;
  }
  return { ...entity, locations };
}

/** `entities` with `locationId` added to or removed from each listed entity's membership — the write side
 *  of a location-first edit, where the author picks the cast standing in one place. Entities whose
 *  membership is unchanged are returned by reference. */
export function setLocationRoster(locationId: string, entityIds: string[], entities: Entity[]): Entity[] {
  const wanted = new Set(entityIds);
  return entities.map((entity) => {
    const has = entity.locations?.includes(locationId) ?? false;
    const should = wanted.has(entity.id);
    if (has === should) return entity;
    const next = should
      ? [...(entity.locations ?? []), locationId]
      : (entity.locations ?? []).filter((id) => id !== locationId);
    return withEntityLocations(entity, next);
  });
}

/** `entities` with `locationId` dropped from every membership — run when a location is deleted, so no
 *  entity keeps pointing at a place that no longer exists. Returns the same array when nobody listed it. */
export function dropLocationFromEntities(locationId: string, entities: Entity[]): Entity[] {
  if (!entities.some((e) => e.locations?.includes(locationId))) return entities;
  return entities.map((entity) =>
    entity.locations?.includes(locationId)
      ? withEntityLocations(entity, entity.locations.filter((id) => id !== locationId))
      : entity,
  );
}
