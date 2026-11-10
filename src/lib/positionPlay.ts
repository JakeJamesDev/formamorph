import type { Connection, Entity, EntityPositions, GameLocation, IndividualStates } from "@/types";
import { advancePositions, type PositionBook, type PositionScene, type Routine } from "@/lib/positionEngine";
import { castRoutines } from "@/lib/entityKind";
import { entitiesInPlay } from "@/lib/entityPresence";
import { storyMinute } from "@/lib/gameClock";

/**
 * The game's side of the position engine: the routines and scene one call reads, and the saved book kept against
 * the world on load and when the opening hour lands.
 */

/** What every engine call in one game moment reads. `scene.playerAt` is where the player stands then. */
export interface PositionWorld {
  routines: ReadonlyMap<string, Routine>;
  scene: PositionScene;
  random: () => number;
}

/** A position world from its parts. */
export function positionWorld(
  routines: readonly Routine[], now: number, playerAt: string | undefined,
  locations: readonly Pick<GameLocation, "id" | "parentId">[], connections: readonly Connection[], random: () => number = Math.random,
): PositionWorld {
  return { routines: new Map(routines.map((r) => [r.id, r])), scene: { now, playerAt, locations, connections }, random };
}

/** `world` with the player at `playerAt`. */
export const withPlayerAt = (world: PositionWorld, playerAt: string | undefined): PositionWorld =>
  world.scene.playerAt === playerAt ? world : { ...world, scene: { ...world.scene, playerAt } };

/** The ids of the Individuals following the player, in book order. */
export const followerIds = (individuals: Readonly<IndividualStates>): string[] =>
  Object.keys(individuals).filter((id) => individuals[id].follow?.mode === "following");

/** The ids of the Individuals waiting where a follower was left. */
export const waitingIds = (individuals: Readonly<IndividualStates>): string[] =>
  Object.keys(individuals).filter((id) => individuals[id].follow?.mode === "waiting");

/** Every Individual placed for `world.scene`: the engine's one step. */
export const placeAll = (book: PositionBook, world: PositionWorld): PositionBook =>
  advancePositions([...world.routines.values()], book, world.scene, world.random);

/**
 * A saved book against the world as it is now: positions of characters without a routine or at a deleted
 * place go, states of characters the world lost go, followers from a save written before the engine join as
 * Following, then everyone is placed for now.
 */
export function reconcileBook(book: PositionBook, world: PositionWorld, legacyFollowers: readonly string[] = []): PositionBook {
  const live = new Set(world.scene.locations.map((l) => l.id));
  const positions: EntityPositions = {};
  for (const [id, at] of Object.entries(book.positions)) if (world.routines.has(id) && live.has(at)) positions[id] = at;
  const individuals: IndividualStates = {};
  for (const [id, st] of Object.entries(book.individuals)) if (world.routines.has(id)) individuals[id] = st;
  // A character the save placed but the engine never ran on keeps the Start at its saved place, when it has one.
  for (const [id, at] of Object.entries(positions)) {
    const start = individuals[id] ? undefined : world.routines.get(id)?.starts.find((s) => s.place === at);
    if (start) individuals[id] = { startId: start.id, lastRun: world.scene.now };
  }
  const placed = placeAll({ positions, individuals }, world);
  const joining = legacyFollowers.filter((id) => world.routines.has(id) && !placed.individuals[id]?.follow);
  if (!joining.length) return placed;
  const following = { ...placed.individuals };
  const at = { ...placed.positions };
  for (const id of joining) {
    if (!following[id]) continue;
    following[id] = { ...following[id], follow: { mode: "following" } };
    if (positions[id] !== undefined) at[id] = positions[id];
  }
  return placeAll({ positions: at, individuals: following }, world);
}

/**
 * The book once the opening hour is set: everyone away from the player is placed again for the real hour from
 * their rolled Start, and everyone at the player's place stays where the opening put them.
 */
export function reseatForOpening(book: PositionBook, world: PositionWorld): PositionBook {
  const { now, playerAt } = world.scene;
  const positions = { ...book.positions };
  const individuals: IndividualStates = {};
  for (const [id, st] of Object.entries(book.individuals)) {
    if (playerAt !== undefined && positions[id] === playerAt) {
      individuals[id] = { ...st, lastRun: now };
      continue;
    }
    individuals[id] = { startId: st.startId, lastRun: now, ...(st.follow && { follow: st.follow }) };
    if (!st.follow) delete positions[id];
  }
  return placeAll({ positions, individuals }, world);
}

/** `entities` as a new game at `playerAt` places them at the opening hour, each Individual from its first Start
 *  and its first pick, so an authoring preview reads one stable cast. */
export function openingCast(
  entities: Entity[], locations: readonly Pick<GameLocation, "id" | "parentId">[], connections: readonly Connection[], playerAt: string | undefined,
): Entity[] {
  const world = positionWorld(castRoutines(entities), storyMinute(0), playerAt, locations, connections, () => 0);
  return entitiesInPlay(entities, placeAll({ positions: {}, individuals: {} }, world).positions);
}
