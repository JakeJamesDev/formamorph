import type { Entity, EntityPositions, GameLocation, PersonaRef } from "@/types";
import { ancestors, parentLookup } from "@/lib/ancestors";

/**
 * The inverted index over entity-owned location membership (see ADR-0003). Entities carry the locations
 * they belong to; every roster that asks "who is at this place" reads it through here, so there is one
 * inversion rather than one per caller.
 *
 * During play a runtime layer sits on top: an entity with a position is at that position only, and one
 * without is at every location it lists. `entitiesInPlay` applies it, so the rosters read it unchanged.
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
  return withMovementRules({ ...entity, locations });
}

/** A Movement choice, Free included. */
export type MovementChoice = NonNullable<Entity['movement']> | 'free';

/** Whether `entity` is at every one of two or more listed locations at once. */
export const isEverywhere = (entity: Entity) => (entity.locations?.length ?? 0) > 1 && entity.presence !== 'random';

/** The Movement choices `entity` offers. One entity at several places at once has no route to walk. */
export function movementOptions(entity: Entity): MovementChoice[] {
  return isEverywhere(entity) ? ['free', 'stays', 'follow'] : ['free', 'stays', 'between', 'follow'];
}

/** `entity` with Moves Between reset to Free where it no longer applies. */
function withMovementRules(entity: Entity): Entity {
  return entity.movement === 'between' && isEverywhere(entity) ? withMovement(entity, 'free') : entity;
}

/** A copy of `entity` with `movement`; Free is stored as no field. */
export function withMovement(entity: Entity, movement: MovementChoice): Entity {
  if (movement !== 'free') return { ...entity, movement };
  const { movement: _free, ...rest } = entity;
  return rest;
}

/** A copy of `entity` with `presence`; Everywhere Listed is stored as no field. */
export function withPresence(entity: Entity, presence: Entity['presence']): Entity {
  if (presence) return { ...entity, presence };
  const { presence: _everywhere, ...rest } = entity;
  return withMovementRules(rest);
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

/** `entities` as they stand in play: each one with a position lists that location only. The same array when
 *  nobody has a position. */
export function entitiesInPlay(entities: Entity[], positions: Readonly<EntityPositions>): Entity[] {
  if (!entities.some((e) => e.id in positions)) return entities;
  return entities.map((entity) => {
    const at = positions[entity.id];
    return at === undefined ? entity : { ...entity, locations: [at] };
  });
}

/** The entity fields a position is placed from. */
export type PlaceableEntity = Pick<Entity, 'id' | 'locations' | 'presence' | 'movement' | 'customPersona'>;

/** The entities that can hold a position under `persona`: all but the Custom Persona and the played one. */
export function positionedCast<E extends PlaceableEntity>(entities: readonly E[], persona: PersonaRef | undefined): E[] {
  const played = persona?.source === 'world' ? persona.entityId : undefined;
  return entities.filter((e) => !e.customPersona && e.id !== played);
}

/** Where the Presence rule places `entity` among the locations the world still has: a One entity at one
 *  of them drawn with `random`, an entity with a Movement and one listed location there. None for
 *  anyone else. */
function placeByPresence(entity: PlaceableEntity, live: ReadonlySet<string>, random: () => number): string | undefined {
  const options = (entity.locations ?? []).filter((id) => live.has(id));
  if (entity.presence === 'random') return options.length ? options[Math.floor(random() * options.length)] : undefined;
  return entity.movement && entity.locations?.length === 1 ? options[0] : undefined;
}

/** The positions a new game starts with, each placed by the Presence rule. */
export function startingPositions(
  entities: readonly PlaceableEntity[], locationIds: readonly string[], random: () => number = Math.random,
): EntityPositions {
  const live = new Set(locationIds);
  const positions: EntityPositions = {};
  for (const entity of entities) {
    const at = placeByPresence(entity, live, random);
    if (at) positions[entity.id] = at;
  }
  return positions;
}

/** A save's positions against the world as it is now. A deleted entity's position goes. An entity
 *  without a live position is placed again by the Presence rule; one the rule doesn't place goes back
 *  to every location it lists. The same map when nothing changes. */
export function reconcilePositions(
  saved: EntityPositions, entities: readonly PlaceableEntity[], locationIds: readonly string[], random: () => number = Math.random,
): EntityPositions {
  const live = new Set(locationIds);
  const next: EntityPositions = {};
  let changed = false;
  for (const entity of entities) {
    const at = saved[entity.id];
    if (at !== undefined && live.has(at)) {
      next[entity.id] = at;
      continue;
    }
    const drawn = placeByPresence(entity, live, random);
    if (drawn) next[entity.id] = drawn;
    if (drawn !== at) changed = true;
  }
  if (!changed && Object.keys(saved).length !== Object.keys(next).length) changed = true;
  return changed ? next : saved;
}

/** {@link reconcilePositions} on a saved state; the same state when nothing changes. */
export function reconcileGameStatePositions<S extends { entityPositions?: EntityPositions }>(
  state: S, entities: readonly PlaceableEntity[], locationIds: readonly string[], random: () => number = Math.random,
): S {
  const saved = state.entityPositions ?? {};
  const next = reconcilePositions(saved, entities, locationIds, random);
  if (next === saved) return state;
  const { entityPositions: _old, ...rest } = state;
  // `rest` is `S` minus an optional field, so it still satisfies `S`; TypeScript can't see that through Omit.
  return (Object.keys(next).length ? { ...rest, entityPositions: next } : rest) as S;
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

/** `entities` with `locationId` dropped from every membership and every Known In list — run when a location
 *  is deleted, so no entity keeps pointing at a place that no longer exists. Returns the same array when
 *  nobody listed it. */
export function dropLocationFromEntities(locationId: string, entities: Entity[]): Entity[] {
  if (!entities.some((e) => e.locations?.includes(locationId) || knownInIncludes(e, locationId))) return entities;
  return entities.map((entity) => {
    let next = entity;
    if (next.locations?.includes(locationId)) next = withEntityLocations(next, next.locations.filter((id) => id !== locationId));
    if (knownInIncludes(next, locationId)) next = toggleKnownInPick(next, locationId);
    return next;
  });
}
