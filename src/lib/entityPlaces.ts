import { PLAYER_START, type Connection, type Entity, type EntityStart, type GameLocation } from "@/types";
import { isGeneric, isUnique, routinePlaces } from "@/lib/entityKind";
import type { Standings } from "@/lib/entityPresence";
import { startingLocationIds } from "@/lib/locationGraph";
import { placesOf, startReach } from "@/lib/positionEngine";
import { openingBook } from "@/lib/positionPlay";

/**
 * Entity Places: where an entity is (ADR-0017). Four questions, each its own answer: Position (where it stands now),
 * Sample Placement (where authoring places it at the start of the story), Presence (every place it can be, with its
 * reasons) and Start places (where it can begin). An entity with no kind answers all four from its stored membership
 * list, which only this module reads and writes. "Who is at a place" inverts any of them, in cast order (ADR-0003).
 */

/** The entity fields every answer reads. */
export type PlacedEntity = Pick<Entity, "id" | "kind" | "starts" | "traversable" | "locations">;

/** The places and links an answer reads. Starting locations count where Player's Starting Location stands. */
export interface PlacesWorld {
  locations: readonly Pick<GameLocation, "id" | "parentId" | "isStarting">[];
  connections: readonly Connection[];
}

/** One answer's places for each entity, in order. */
export type PlacesOf = (entity: PlacedEntity) => readonly string[];

const unique = (ids: Iterable<string>): string[] => [...new Set(ids)];

/** Whether `entity` has a kind the engine runs; any other entity answers from its membership. */
const hasKind = (entity: PlacedEntity): boolean => isUnique(entity) || isGeneric(entity);

/** An entity with no kind's stored membership. */
const membership = (entity: PlacedEntity): string[] => [...(entity.locations ?? [])];

/** Where `entity` stands in `standings`: a Unique entity at its one place, a Generic entity at each place a Generic
 *  Entity Instance stands, once. An entity with a kind and no Position stands nowhere (Q10). An entity with no kind
 *  stands at its own Position when it has one, a runtime character's included, else at its membership. */
export function positionOf(entity: PlacedEntity, { positions, generics }: Standings): string[] {
  const at = positions[entity.id];
  if (at !== undefined) return [at];
  const instances = generics[entity.id];
  if (instances) return unique(Object.values(instances).map((instance) => instance.position));
  return hasKind(entity) ? [] : membership(entity);
}

/** The Position answer over `standings`. */
export const positionsIn = (standings: Standings): PlacesOf => (entity) => positionOf(entity, standings);

/** The Sample Placement of `cast` for a story that begins at `playerStart`: a Unique entity from its first Start, a
 *  Generic entity from all of them, as a new game opens. */
export function samplePlacement(cast: readonly Entity[], world: PlacesWorld, playerStart: string | undefined): PlacesOf {
  return positionsIn(openingBook(cast, world.locations, world.connections, playerStart));
}

/** Why an entity can be at a place. `begins`: the Starts that begin there. `row`: a Schedule row that names it.
 *  `traversable`: Traversable lists it. `member`: an entity with no kind belongs there. */
export type PresenceReason =
  | { kind: "begins"; startIds: string[] }
  | { kind: "row"; startId: string; rowId: string }
  | { kind: "traversable" }
  | { kind: "member" };

/** A place an entity can be, with each reason in the order begins, rows, Traversable. */
export interface PresencePlace {
  place: string;
  reasons: PresenceReason[];
}

/** Every place an entity can be. `anywhere`: Traversable is Anywhere, which adds no place. */
export interface Presence {
  places: PresencePlace[];
  anywhere: boolean;
}

/** The places `start` begins at: the starting locations for Player's Starting Location. */
const beginsAt = (start: Pick<EntityStart, "place">, world: Pick<PlacesWorld, "locations">): string[] =>
  (start.place === PLAYER_START ? startingLocationIds(world.locations) : [start.place]);

/** The Presence of `entity` in `world`: only places the world has (Q19), in the order Starts, rows, Traversable first
 *  name them. A row place with no path from its Start is left out (Q8); a Player's Starting Location Start checks none (Q18). */
export function presenceOf(entity: PlacedEntity, world: PlacesWorld): Presence {
  const known = new Set(world.locations.map((l) => l.id));
  if (!hasKind(entity)) {
    const places = unique(membership(entity)).filter((place) => known.has(place));
    return { places: places.map((place) => ({ place, reasons: [{ kind: "member" }] })), anywhere: false };
  }
  const found = new Map<string, { begins: string[]; rows: PresenceReason[]; traversable: boolean }>();
  const at = (place: string) => {
    let entry = found.get(place);
    if (!entry) found.set(place, (entry = { begins: [], rows: [], traversable: false }));
    return entry;
  };
  for (const start of entity.starts ?? []) {
    for (const place of beginsAt(start, world)) at(place).begins.push(start.id);
    const reach = startReach(start.place, world);
    for (const row of start.schedule) {
      for (const place of unique(placesOf(row.action))) {
        if (reach.has(place)) at(place).rows.push({ kind: "row", startId: start.id, rowId: row.id });
      }
    }
  }
  const traversable = isUnique(entity) ? entity.traversable ?? [] : [];
  if (Array.isArray(traversable)) for (const place of traversable) at(place).traversable = true;
  const places = [...found].filter(([place]) => known.has(place)).map(([place, entry]): PresencePlace => ({
    place,
    reasons: [
      ...(entry.begins.length ? [{ kind: "begins" as const, startIds: entry.begins }] : []),
      ...entry.rows,
      ...(entry.traversable ? [{ kind: "traversable" as const }] : []),
    ],
  }));
  return { places, anywhere: traversable === "anywhere" };
}

/** Every place id `entity` names, whether or not a world has it: its Starts (Player's Starting Location is no place),
 *  rows and Traversable list, or an entity with no kind's membership. No world and no path check (Q19). */
export function namedPlacesOf(entity: PlacedEntity): string[] {
  if (!hasKind(entity)) return unique(membership(entity));
  return unique([...routinePlaces(entity.starts ?? []), ...(Array.isArray(entity.traversable) ? entity.traversable : [])]);
}

/** The Presence answer over `world`, as places alone. */
export const presenceIn = (world: PlacesWorld): PlacesOf => (entity) => presenceOf(entity, world).places.map((p) => p.place);

/** Where `entity` can begin, in Start order, each place once: Player's Starting Location stands for the starting
 *  locations (Q16). An entity with no kind begins at its membership. */
export function startPlacesOf(entity: PlacedEntity, world: Pick<PlacesWorld, "locations">): string[] {
  if (!hasKind(entity)) return unique(membership(entity));
  return unique((entity.starts ?? []).flatMap((start) => beginsAt(start, world)));
}

/** The ids of `cast` that `placesOf` puts at `place`, in cast order. Empty for no place. */
export function idsAt(place: string | null | undefined, cast: readonly PlacedEntity[], placesOf: PlacesOf): string[] {
  if (!place) return [];
  return cast.filter((entity) => placesOf(entity).includes(place)).map((entity) => entity.id);
}

/** The ids of `cast` that `placesOf` puts at any of `places`, each once, in cast order. */
export function idsAtAny(places: readonly string[], cast: readonly PlacedEntity[], placesOf: PlacesOf): string[] {
  const scope = new Set(places);
  return cast.filter((entity) => placesOf(entity).some((place) => scope.has(place))).map((entity) => entity.id);
}

/** `entity` belonging to exactly `places`, deduped. An empty list drops the field, so an entity placed nowhere
 *  exports as clean as one that never had a membership. */
export function withMembership<E extends Pick<Entity, "locations">>(entity: E, places: readonly string[]): E {
  const locations = unique(places);
  if (locations.length) return { ...entity, locations };
  const { locations: _none, ...rest } = entity;
  return rest as E;
}
