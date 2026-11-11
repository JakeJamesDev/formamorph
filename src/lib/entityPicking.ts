import { knownInOf, toggleKnownInPick, withEntityLocations } from "@/lib/entityPresence";
import { isGeneric, isUnique, toggleGenericStart, withFirstStartPlace } from "@/lib/entityKind";
import { randomUUID } from "@/lib/uuid";
import { holderOf } from "@/lib/locationTree";
import { nearbyPlaces, reachableFrom, startingLocationIds } from "@/lib/locationGraph";
import { placesOf } from "@/lib/positionEngine";
import { PLAYER_START, type Connection, type Entity, type GameLocation } from "@/types";

/**
 * The full-screen Locations Canvas as a picker for one entity: how each location draws while the entity is
 * picked, and what a click on a location writes. Pure, so the canvas only draws the answer.
 */

/** `ids` with `id` removed when present, added when not. */
const toggled = (ids: readonly string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

/** What a canvas click writes while an entity is picked. */
export type PickMode = "locations" | "knownIn";

/** An entity to select on a location's Presence tab: `locations` is the Routine mode. */
export interface PresenceReveal {
  entityId: string;
  mode: PickMode;
  /** The Start the Step changed, to show in the Routine editor. */
  startId?: string;
}

/** `entity` with `locationId` toggled for `mode`. For a Unique entity, a location click sets where it starts; for a
 *  Generic entity it adds a Start there or removes the ones that begin there. */
export function togglePick(entity: Entity, mode: PickMode, locationId: string): Entity {
  if (mode === "knownIn") return toggleKnownInPick(entity, locationId);
  if (isUnique(entity)) return withFirstStartPlace(entity, locationId, randomUUID);
  if (isGeneric(entity)) return toggleGenericStart(entity, locationId, randomUUID);
  return withEntityLocations(entity, toggled(entity.locations ?? [], locationId));
}

/** The locations `entity` is known in through a pick. None for the Custom Persona, which hides Known In. */
export function knownInPicks(entity: Pick<Entity, "knownIn" | "customPersona">): string[] {
  const knownIn = knownInOf(entity);
  return entity.customPersona || !Array.isArray(knownIn) ? [] : knownIn;
}

/** How a location draws: `member` is one of the entity's locations, `covered` sits inside a pick at any
 *  depth, `faded` is neither. Under Nearby, `routine` is a place the routine uses and `nearby` is one Nearby
 *  link from one. `pick` marks a pick itself. */
export interface PickMark {
  kind: "member" | "covered" | "routine" | "nearby" | "faded";
  pick: boolean;
}

/**
 * Every place `entity` can be over the whole day of every Start: where each Start begins, and each place a row
 * names that is connected to it, as the engine keeps it. `PLAYER_START` stands for the world's starting
 * locations, or every location when none is flagged.
 */
export function routinePlaces(
  entity: Pick<Entity, "starts">, locations: readonly GameLocation[], connections: readonly Connection[],
): Set<string> {
  const playerStarts = startingLocationIds(locations);
  const known = new Set(locations.map((l) => l.id));
  const out = new Set<string>();
  for (const start of entity.starts ?? []) {
    const begins = start.place === PLAYER_START ? playerStarts : [start.place];
    const connected = reachableFrom(begins, locations, connections);
    for (const id of begins) out.add(id);
    for (const row of start.schedule) {
      for (const id of placesOf(row.action)) if (connected.has(id)) out.add(id);
    }
  }
  return new Set([...out].filter((id) => known.has(id)));
}

/** Under Nearby: the full mark on every routine place, the lighter mark on every place one Nearby link from one. */
function nearbyMarks(entity: Entity, locations: GameLocation[], connections: readonly Connection[]): Map<string, PickMark> {
  const routine = routinePlaces(entity, locations, connections);
  const near = new Set([...routine].flatMap((id) => nearbyPlaces(id, locations, connections)));
  return new Map(locations.map((l) => [l.id, {
    kind: routine.has(l.id) ? "routine" : near.has(l.id) ? "nearby" : "faded",
    pick: false,
  }]));
}

/** The mark of every location while `entity` is picked. `pickedPending`: Picked Locations is chosen with no pick yet. */
export function pickMarks(
  entity: Entity, locations: GameLocation[], connections: readonly Connection[], pickedPending = false,
): Map<string, PickMark> {
  if (!pickedPending && !entity.customPersona && knownInOf(entity) === "nearby") return nearbyMarks(entity, locations, connections);
  const members = new Set(entity.locations);
  const picks = new Set(knownInPicks(entity));
  const byId = new Map(locations.map((l) => [l.id, l]));
  const insidePick = (location: GameLocation): boolean => {
    const seen = new Set<string>();
    for (let at: GameLocation | undefined = location; at && !seen.has(at.id);) {
      if (picks.has(at.id)) return true;
      seen.add(at.id);
      const parent = holderOf(locations, at);
      at = parent ? byId.get(parent) : undefined;
    }
    return false;
  };
  return new Map(locations.map((location) => [location.id, {
    kind: members.has(location.id) ? "member" : insidePick(location) ? "covered" : "faded",
    pick: picks.has(location.id),
  }]));
}
