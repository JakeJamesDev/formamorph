import type { Entity, EntityPositions, GameLocation, GroupStates, PersonaRef } from "@/types";
import { ancestors, parentLookup } from "@/lib/ancestors";
import {
  isGroup, routineNames, withGroupPlacesMapped, withGroupStart, withoutGroupStartsAt, withoutRoutinePlace,
} from "@/lib/entityKind";
import { groupPlaces } from "@/lib/positionEngine";
import { randomUUID } from "@/lib/uuid";

/**
 * The inverted index over entity-owned location membership (see ADR-0003). Entities carry the locations
 * they belong to; every roster that asks "who is at this place" reads it through here, so there is one
 * inversion rather than one per caller.
 *
 * During play a runtime layer sits on top: an Individual is at its position only, and a Group at the places its
 * presences stand, each once. `entitiesInPlay` applies it, so the rosters read it unchanged.
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
export function entityIdsAtAny(locationIds: readonly string[], entities: Entity[]): string[] {
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

/** `entity` carried into a world, `map` naming each of its locations the world can place (source id → world id).
 *  A Group keeps its routine through the map; any other entity belongs to the mapped places. */
export function placedIn(entity: Entity, map: Readonly<Record<string, string>>): Entity {
  return isGroup(entity) ? withGroupPlacesMapped(entity, map, randomUUID) : withEntityLocations(entity, Object.values(map));
}

/** Whether a Start of `entity` begins at `locationId`. */
export const startsAt =(entity: Entity, locationId: string) => (entity.starts ?? []).some((start) => start.place === locationId);

/** `entities` with a Start added at `locationId` to each picked Group that has none there, and the Starts there
 *  removed from each Group not picked — the write side of a location-first edit. A Group keeps its last Start,
 *  and an Individual is never touched. Entities that don't change are returned by reference. */
export function setLocationRoster(locationId: string, entityIds: string[], entities: Entity[]): Entity[] {
  const wanted = new Set(entityIds);
  return entities.map((entity) => {
    if (!isGroup(entity)) return entity;
    const has = startsAt(entity, locationId);
    const should = wanted.has(entity.id);
    if (has === should) return entity;
    return should ? withGroupStart(entity, locationId, randomUUID) : withoutGroupStartsAt(entity, locationId);
  });
}

/** Where entities stand in play: each Individual's position, and each Group's presences. */
export interface Standings {
  positions: Readonly<EntityPositions>;
  groups: Readonly<GroupStates>;
}

/** `entities` as they stand in play: an Individual with a position lists that location only, and a Group with
 *  presences the places they stand at, each once (Q131). The same array when nobody is placed. */
export function entitiesInPlay(entities: Entity[], { positions, groups }: Standings): Entity[] {
  if (!entities.some((e) => e.id in positions || e.id in groups)) return entities;
  const places = groupPlaces(groups);
  return entities.map((entity) => {
    const at = positions[entity.id];
    if (at !== undefined) return { ...entity, locations: [at] };
    const group = places[entity.id];
    return group ? { ...entity, locations: group } : entity;
  });
}

/** The ids of the entities present at `locationId` as they stand in play. Pass the discovered entities in
 *  `entities` too, so the ones met this turn count (Q62). */
export const presentEntityIds = (
  entities: Entity[], standings: Standings, locationId: string | null | undefined,
): string[] => entityIdsAt(locationId, entitiesInPlay(entities, standings));

/** The entities that can hold a position under `persona`: all but the Custom Persona and the played one. */
export function positionedCast<E extends Pick<Entity, 'id' | 'customPersona'>>(entities: readonly E[], persona: PersonaRef | undefined): E[] {
  const played = persona?.source === 'world' ? persona.entityId : undefined;
  return entities.filter((e) => !e.customPersona && e.id !== played);
}

/** An entity's Known In: Nearby, Nowhere, or the picked location ids, each covering its subtree. */
export type KnownIn = 'nearby' | 'nowhere' | string[];

/** `entity`'s Known In, an absent field or an empty list reading as Nearby. */
export function knownInOf(entity: Pick<Entity, 'knownIn'>): KnownIn {
  const { knownIn } = entity;
  if (knownIn === 'nowhere') return 'nowhere';
  return knownIn?.length ? knownIn : 'nearby';
}

/** A copy of `entity` with `knownIn`; Nearby and an empty list are stored as no field. */
export function withKnownIn(entity: Entity, knownIn: KnownIn): Entity {
  const picks = Array.isArray(knownIn) ? [...new Set(knownIn)] : knownIn;
  if (picks !== 'nearby' && picks.length) return { ...entity, knownIn: picks };
  const { knownIn: _nearby, ...rest } = entity;
  return rest;
}

/** `entity` with `locationId` added to or removed from its Known In picks. A first pick replaces Nearby or
 *  Nowhere; removing the last one falls back to Nearby. */
export function toggleKnownInPick(entity: Entity, locationId: string): Entity {
  const known = knownInOf(entity);
  const picks = Array.isArray(known) ? known : [];
  return withKnownIn(entity, picks.includes(locationId) ? picks.filter((id) => id !== locationId) : [...picks, locationId]);
}

/** An entity known at a location, and the picked location that makes it so: `null` for its own pick on the
 *  location, else the nearest picked location containing it. */
export interface KnownHereRow {
  entity: Entity;
  via: string | null;
}

/** The entities known at `locationId` through their Known In picks, in cast order. The Custom Persona is
 *  never known anywhere. */
export function knownHere(locationId: string, locations: readonly Pick<GameLocation, 'id' | 'parentId'>[], entities: Entity[]): KnownHereRow[] {
  const chain = [locationId, ...ancestors(locationId, parentLookup(locations, (l) => l.parentId))];
  return entities.flatMap((entity) => {
    const known = knownInOf(entity);
    if (entity.customPersona || !Array.isArray(known)) return [];
    const at = chain.find((id) => known.includes(id));
    return at === undefined ? [] : [{ entity, via: at === locationId ? null : at }];
  });
}

const knownInIncludes = (entity: Entity, locationId: string) => Array.isArray(entity.knownIn) && entity.knownIn.includes(locationId);

/** `entities` with `locationId` dropped from every membership, every routine and every Known In list — run when a
 *  location is deleted, so no entity keeps pointing at a place that no longer exists. A Start at the place goes,
 *  and so does a row left with no places. Returns the same array when nobody named it. */
export function dropLocationFromEntities(locationId: string, entities: Entity[]): Entity[] {
  const names = (e: Entity) => e.locations?.includes(locationId) || knownInIncludes(e, locationId) || routineNames(e, locationId);
  if (!entities.some(names)) return entities;
  return entities.map((entity) => {
    let next = withoutRoutinePlace(entity, locationId);
    if (!next.kind && next.locations?.includes(locationId)) next = withEntityLocations(next, next.locations.filter((id) => id !== locationId));
    if (knownInIncludes(next, locationId)) next = toggleKnownInPick(next, locationId);
    return next;
  });
}
