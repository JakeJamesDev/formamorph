import type { Connection, Entity, EntityPositions, GameLocation, GenericStates, UniqueStates } from "@/types";
import { advancePositions, EMPTY_BOOK, type PositionBook, type PositionScene, type Routine } from "@/lib/positionEngine";
import { castRoutines } from "@/lib/entityKind";
import { entitiesInPlay } from "@/lib/entityPresence";
import { storyMinute } from "@/lib/gameClock";

/**
 * The game's side of the position engine: the routines and scene one call reads, and the saved book kept against
 * the world on load and when the opening hour lands.
 */

/** What every engine call in one game moment reads. `scene.playerAt` is where the player stands then. `uniques`
 *  holds the Unique entities, the only ones a pull, a follow or a script move reaches; `generics` holds the Generic entities. */
export interface PositionWorld {
  uniques: ReadonlyMap<string, Routine>;
  generics: ReadonlyMap<string, Routine>;
  scene: PositionScene;
  random: () => number;
}

/** A position world from its parts. `playerStart` is where the player began. */
export function positionWorld(
  routines: readonly Routine[], now: number, playerAt: string | undefined,
  locations: readonly Pick<GameLocation, "id" | "parentId">[], connections: readonly Connection[], random: () => number = Math.random,
  playerStart?: string,
): PositionWorld {
  const byId = (generic: boolean) => new Map(routines.filter((r) => !!r.generic === generic).map((r) => [r.id, r]));
  const scene = { now, playerAt, locations, connections, ...(playerStart !== undefined && { playerStart }) };
  return { uniques: byId(false), generics: byId(true), scene, random };
}

/** `world` with the player at `playerAt`. */
export const withPlayerAt = (world: PositionWorld, playerAt: string | undefined): PositionWorld =>
  world.scene.playerAt === playerAt ? world : { ...world, scene: { ...world.scene, playerAt } };

/** The ids of the Unique entities following the player, in book order. */
export const followerIds = (uniques: Readonly<UniqueStates>): string[] =>
  Object.keys(uniques).filter((id) => uniques[id].follow?.mode === "following");

/** The ids of the Unique entities waiting where a follower was left. */
export const waitingIds = (uniques: Readonly<UniqueStates>): string[] =>
  Object.keys(uniques).filter((id) => uniques[id].follow?.mode === "waiting");

/** Every Unique entity and every Generic presence placed for `world.scene`: the engine's one step. */
export const placeAll = (book: PositionBook, world: PositionWorld): PositionBook =>
  advancePositions([...world.uniques.values(), ...world.generics.values()], book, world.scene, world.random);

/**
 * A saved book against the world as it is now: positions of characters without a routine or at a deleted
 * place go, states of characters the world lost go, followers from a save written before the engine join as
 * Following, then everyone is placed for now. A Generic presence at a deleted place goes where its row puts it.
 */
export function reconcileBook(book: PositionBook, world: PositionWorld, legacyFollowers: readonly string[] = []): PositionBook {
  const live = new Set(world.scene.locations.map((l) => l.id));
  const positions: EntityPositions = {};
  for (const [id, at] of Object.entries(book.positions)) if (world.uniques.has(id) && live.has(at)) positions[id] = at;
  const uniques: UniqueStates = {};
  for (const [id, st] of Object.entries(book.uniques)) if (world.uniques.has(id)) uniques[id] = st;
  const generics: GenericStates = {};
  for (const [id, presences] of Object.entries(book.generics)) {
    if (world.generics.has(id)) generics[id] = presences;
  }
  // A character the save placed but the engine never ran on keeps the Start at its saved place, when it has one.
  for (const [id, at] of Object.entries(positions)) {
    const start = uniques[id] ? undefined : world.uniques.get(id)?.starts.find((s) => s.place === at);
    if (start) uniques[id] = { startId: start.id, lastRun: world.scene.now };
  }
  const placed = placeAll({ positions, uniques, generics }, world);
  const joining = legacyFollowers.filter((id) => world.uniques.has(id) && !placed.uniques[id]?.follow);
  if (!joining.length) return placed;
  const following = { ...placed.uniques };
  const at = { ...placed.positions };
  for (const id of joining) {
    if (!following[id]) continue;
    following[id] = { ...following[id], follow: { mode: "following" } };
    if (positions[id] !== undefined) at[id] = positions[id];
  }
  return placeAll({ ...placed, positions: at, uniques: following }, world);
}

/**
 * The book once the opening hour is set: everyone away from the player is placed again for the real hour from
 * their rolled Start, and everyone at the player's place stays where the opening put them. A Generic presence
 * does the same from its own Start.
 */
export function reseatForOpening(book: PositionBook, world: PositionWorld): PositionBook {
  const { now, playerAt } = world.scene;
  const positions = { ...book.positions };
  const uniques: UniqueStates = {};
  for (const [id, st] of Object.entries(book.uniques)) {
    if (playerAt !== undefined && positions[id] === playerAt) {
      uniques[id] = { ...st, lastRun: now };
      continue;
    }
    uniques[id] = { startId: st.startId, lastRun: now, ...(st.follow && { follow: st.follow }) };
    if (!st.follow) delete positions[id];
  }
  const generics: GenericStates = {};
  for (const [id, presences] of Object.entries(book.generics)) {
    generics[id] = Object.fromEntries(Object.entries(presences).flatMap(([startId, p]) =>
      (playerAt !== undefined && p.position === playerAt ? [[startId, { ...p, lastRun: now }]] : [])));
  }
  return placeAll({ positions, uniques, generics }, world);
}

/** `entities` as a new game at `playerAt` places them at the opening hour, each Unique entity from its first Start
 *  and its first pick and each Generic entity from all of its, so an authoring preview reads one stable cast. */
export function openingCast(
  entities: Entity[], locations: readonly Pick<GameLocation, "id" | "parentId">[], connections: readonly Connection[], playerAt: string | undefined,
): Entity[] {
  const world = positionWorld(castRoutines(entities), storyMinute(0), playerAt, locations, connections, () => 0, playerAt);
  return entitiesInPlay(entities, placeAll(EMPTY_BOOK, world));
}
