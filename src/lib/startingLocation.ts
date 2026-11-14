import type { GameLocation } from "@/types";

/** The locations a new game may begin in (flagged `isStarting`). */
export const startingLocations = (locations: GameLocation[]): GameLocation[] =>
  locations.filter((l) => l.isStarting);

/** The locations a new game may begin in, falling back to all locations when none is flagged. */
export const startCandidates = (locations: readonly GameLocation[]): GameLocation[] => {
  const starting = startingLocations([...locations]);
  return starting.length > 0 ? starting : [...locations];
};

/** Where an authoring run's story begins: the first start candidate. Undefined with no locations. */
export const sampleStart = (locations: readonly GameLocation[]): GameLocation | undefined => startCandidates(locations)[0];

/** `locations` in tree order: each root in list order, then its children depth-first. A child whose parent is
 *  missing counts as a root. */
export function inTreeOrder<L extends Pick<GameLocation, "id" | "parentId">>(locations: readonly L[]): L[] {
  const ids = new Set(locations.map((l) => l.id));
  const childrenOf = new Map<string, L[]>();
  const roots: L[] = [];
  for (const l of locations) {
    if (l.parentId && ids.has(l.parentId)) childrenOf.set(l.parentId, [...childrenOf.get(l.parentId) ?? [], l]);
    else roots.push(l);
  }
  const out: L[] = [];
  const visit = (l: L) => { out.push(l); for (const child of childrenOf.get(l.id) ?? []) visit(child); };
  roots.forEach(visit);
  return out;
}

/**
 * The new game's start under the Enabled gates (Q12, Q51): the chosen location when it is on, else a random on
 * starting location, else the first on location in tree order when every starting location is off, else a random
 * on location when none is flagged. With every location off, the authored pick.
 */
export function startingLocationIn(
  locations: GameLocation[], isOn: (id: string) => boolean, chosenId?: string | null, random: () => number = Math.random,
): GameLocation | undefined {
  const on = locations.filter((l) => isOn(l.id));
  if (!on.length) return resolveStartingLocation(locations, chosenId);
  const chosen = chosenId ? on.find((l) => l.id === chosenId) : undefined;
  if (chosen) return chosen;
  const starting = startingLocations(on);
  if (starting.length) return starting[Math.floor(random() * starting.length)];
  if (startingLocations(locations).length) return inTreeOrder(on)[0];
  return on[Math.floor(random() * on.length)];
}

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
  const pool = startCandidates(locations);
  return pool[Math.floor(Math.random() * pool.length)];
};
