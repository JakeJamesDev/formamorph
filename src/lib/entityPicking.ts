import { knownInOf, toggleKnownInPick, withEntityLocations } from "@/lib/entityPresence";
import { isGroup, isIndividual, toggleGroupStart, withFirstStartPlace } from "@/lib/entityKind";
import { randomUUID } from "@/lib/uuid";
import { holderOf } from "@/lib/locationTree";
import type { Entity, GameLocation } from "@/types";

/**
 * The full-screen Locations Canvas as a picker for one entity: how each location draws while the entity is
 * picked, and what a click on a location writes. Pure, so the canvas only draws the answer.
 */

/** `ids` with `id` removed when present, added when not. */
const toggled = (ids: readonly string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

/** What a canvas click writes while an entity is picked. */
export type PickMode = "locations" | "knownIn";

/** `entity` with `locationId` toggled for `mode`. For an Individual, a location click sets where it starts; for a
 *  Group it adds a Start there or removes the ones that begin there. */
export function togglePick(entity: Entity, mode: PickMode, locationId: string): Entity {
  if (mode === "knownIn") return toggleKnownInPick(entity, locationId);
  if (isIndividual(entity)) return withFirstStartPlace(entity, locationId, randomUUID);
  if (isGroup(entity)) return toggleGroupStart(entity, locationId, randomUUID);
  return withEntityLocations(entity, toggled(entity.locations ?? [], locationId));
}

/** The locations `entity` is known in through a pick. None for the Custom Persona, which hides Known In. */
export function knownInPicks(entity: Pick<Entity, "knownIn" | "customPersona">): string[] {
  const knownIn = knownInOf(entity);
  return entity.customPersona || !Array.isArray(knownIn) ? [] : knownIn;
}

/** How a location draws: `member` is one of the entity's locations, `covered` sits inside a pick at any
 *  depth, `faded` is neither. `pick` marks a pick itself. */
export interface PickMark {
  kind: "member" | "covered" | "faded";
  pick: boolean;
}

/** The mark of every location while `entity` is picked. */
export function pickMarks(entity: Entity, locations: GameLocation[]): Map<string, PickMark> {
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
