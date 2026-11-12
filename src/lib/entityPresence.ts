import type { ContentLocationRef, Entity, EntityKind, EntityPositions, GameLocation, GenericStates, PersonaRef } from "@/types";
import { ancestors, parentLookup } from "@/lib/ancestors";
import { isGeneric, withGenericStart, withoutRoutinePlace, withRoutineMapped } from "@/lib/entityKind";
import { withNewStart } from "@/lib/routineEditing";
import { idsAt, namedPlacesOf, positionsIn, withMembership } from "@/lib/entityPlaces";
import { randomUUID } from "@/lib/uuid";

/**
 * Entity edits that touch places, and the rosters over the Entity Places module (ADR-0017). In play,
 * `entitiesInPlay` lays each entity's Position over the cast, so the rosters read it unchanged. Roster order is
 * the cast's own order.
 */
export { entitiesInPlay, entityIdsAt, entityIdsAtAny } from "@/lib/entityPlaces";

/** A copy of `entity` belonging to exactly `locationIds`: the Entity Places module's membership write. */
export const withEntityLocations = (entity: Entity, locationIds: string[]): Entity => withMembership(entity, locationIds);

/** `entity` carried into a world, `map` naming each of its places the world can place (source id → world id).
 *  An entity with a kind keeps its routine through the map; one with no kind belongs to the mapped places. */
export function placedIn(entity: Entity, map: Readonly<Record<string, string>>): Entity {
  return entity.kind ? withRoutineMapped(entity, map, randomUUID) : withEntityLocations(entity, Object.values(map));
}

/** The carry map of `refs` (source id → world id, in ref order): each ref through `connections`, else its own id,
 *  kept only where `known` holds the place. */
export function carryMap(
  refs: readonly ContentLocationRef[], connections: Readonly<Record<string, string>>, known: ReadonlySet<string>,
): Record<string, string> {
  return Object.fromEntries(refs.flatMap((ref) => {
    const id = connections[ref.id] ?? ref.id;
    return known.has(id) ? [[ref.id, id]] : [];
  }));
}

/** The routine fields of an entity with a kind. */
export const ROUTINE_FIELDS = ["starts", "traversable"] as const;
export type Routine = Pick<Entity, (typeof ROUTINE_FIELDS)[number]>;

/** The routine `source` holds once carried into a world as an entity of `kind`: its places through `connections`, kept
 *  where `known` holds them (Q11). The one mapping carry, update, compare and link repair share (Q30). */
export function carriedRoutine(
  source: Entity, kind: EntityKind, connections: Readonly<Record<string, string>>, known: ReadonlySet<string>,
): Routine {
  const carried = placedIn({ ...source, kind }, carryMap(source.locationRefs ?? [], connections, known));
  return {
    ...(carried.starts && { starts: carried.starts }),
    ...(carried.traversable !== undefined && { traversable: carried.traversable }),
  };
}

/** The membership `source` holds once carried into a world as an entity with no kind: the same carry as a first add (Q33). */
export function carriedMembership(
  source: Entity, connections: Readonly<Record<string, string>>, known: ReadonlySet<string>,
): string[] {
  const { kind: _kind, ...plain } = source;
  return namedPlacesOf(placedIn(plain, carryMap(source.locationRefs ?? [], connections, known)));
}

/** A linked `copy` with its routine rebuilt as a fresh carry of `source` through `connections`, as an entity of `kind`. */
export function withCarriedRoutine(
  copy: Entity, source: Entity, connections: Readonly<Record<string, string>>, known: ReadonlySet<string>,
  kind: EntityKind,
): Entity {
  const { starts: _s, traversable: _t, ...rest } = copy;
  return { ...rest, ...carriedRoutine(source, kind, connections, known) };
}

/** Whether a Start of `entity` begins at `locationId`. */
export const startsAt =(entity: Entity, locationId: string) => (entity.starts ?? []).some((start) => start.place === locationId);

/** `entity` with one more Start at `locationId`, weight 1 and no rows. Its other Starts stay. */
export const withStartHere = (entity: Entity, locationId: string): Entity =>
  isGeneric(entity) ? withGenericStart(entity, locationId, randomUUID) : withNewStart(entity, locationId, randomUUID);

/** Where entities stand in play: each Unique entity's position, and each Generic entity's instances. */
export interface Standings {
  positions: Readonly<EntityPositions>;
  generics: Readonly<GenericStates>;
}

/** The ids of the entities whose Position is `locationId`. Pass the discovered entities in `entities` too, so the
 *  ones met this turn count (Q62). */
export const presentEntityIds = (
  entities: Entity[], standings: Standings, locationId: string | null | undefined,
): string[] => idsAt(locationId, entities, positionsIn(standings));

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
  const names = (e: Entity) => namedPlacesOf(e).includes(locationId) || knownInIncludes(e, locationId);
  if (!entities.some(names)) return entities;
  return entities.map((entity) => {
    let next = withoutRoutinePlace(entity, locationId);
    const members = next.kind ? [] : namedPlacesOf(next);
    if (members.includes(locationId)) next = withEntityLocations(next, members.filter((id) => id !== locationId));
    if (knownInIncludes(next, locationId)) next = toggleKnownInPick(next, locationId);
    return next;
  });
}
