import type { GameLocation } from "@/types";

/** The locations a new game may begin in (flagged `isStarting`). */
export const startingLocations = (locations: GameLocation[]): GameLocation[] =>
  locations.filter((l) => l.isStarting);

/**
 * Resolve the initial location for a new game: the player's chosen id when valid, otherwise a random pick
 * among the starting locations (falling back to all locations when none are flagged). `undefined` only
 * when there are no locations at all.
 */
export const resolveStartingLocation = (
  locations: GameLocation[],
  chosenId?: string | null,
): GameLocation | undefined => {
  if (chosenId) {
    const chosen = locations.find((l) => l.id === chosenId);
    if (chosen) return chosen;
  }
  const starting = startingLocations(locations);
  const pool = starting.length > 0 ? starting : locations;
  return pool[Math.floor(Math.random() * pool.length)];
};
