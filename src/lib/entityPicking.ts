import { knownInOf, toggleKnownInPick, withEntityLocations } from "@/lib/entityPresence";
import { effectiveDestinations } from "@/lib/locationGraph";
import { holderOf } from "@/lib/locationTree";
import type { Connection, Entity, GameLocation } from "@/types";

/**
 * The full-screen Locations Canvas as a picker for one entity: how each location draws while the entity is
 * picked, and what a click on a location writes. Pure, so the canvas only draws the answer.
 */

/** `ids` with `id` removed when present, added when not. */
const toggled = (ids: readonly string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

/** What a canvas click writes while an entity is picked. */
export type PickMode = "locations" | "knownIn";

/** `entity` with `locationId` toggled for `mode`. */
export function togglePick(entity: Entity, mode: PickMode, locationId: string): Entity {
  if (mode === "knownIn") return toggleKnownInPick(entity, locationId);
  return withEntityLocations(entity, toggled(entity.locations ?? [], locationId));
}

/** The locations `entity` is known in through a pick. None for the Custom Persona, which hides Known In. */
export function knownInPicks(entity: Pick<Entity, "knownIn" | "customPersona">): string[] {
  const knownIn = knownInOf(entity);
  return entity.customPersona || !Array.isArray(knownIn) ? [] : knownIn;
}

/** Where a Moves Between entity's range breaks: the first listed location, and each listed location it
 *  can't reach one hop at a time through its own locations. */
export interface RangeGap {
  from: string;
  unreachable: string[];
}

/** `entity`'s range gap, or null when it has none or doesn't Move Between. */
export function rangeGap(entity: Entity, locations: GameLocation[], connections: Connection[]): RangeGap | null {
  const live = new Set(locations.map((l) => l.id));
  const own = (entity.locations ?? []).filter((id) => live.has(id));
  if (entity.movement !== "between" || own.length < 2) return null;
  const range = new Set(own);
  const reached = new Set([own[0]]);
  const queue = [own[0]];
  for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
    for (const next of effectiveDestinations(at, locations, connections).keys()) {
      if (range.has(next) && !reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  const unreachable = own.filter((id) => !reached.has(id));
  return unreachable.length ? { from: own[0], unreachable } : null;
}

const listWithAnd = new Intl.ListFormat("en", { type: "conjunction" });

/** The range warning, from display names. */
export function rangeWarning(entity: string, from: string, unreachable: string[]): string {
  return `${entity} can’t reach ${listWithAnd.format(unreachable)} from ${from} through its own locations. Add the location between them, or a Connection.`;
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
