import type { Connection, Entity, EntityPositions, GameLocation, GenericStates, ScheduleAction, UniqueStates } from "@/types";
import {
  actionNow, advancePositions, EMPTY_BOOK, genericPlaces, isHeldNow, type PositionBook, type PositionScene, type Routine,
} from "@/lib/positionEngine";
import type { SandboxState } from "@/lib/statCodeTurn";
import { castRoutines } from "@/lib/entityKind";
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
  /** The disabled entities, whose follow ends at the next commit (Q9). Absent, none. */
  off?: ReadonlySet<string>;
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

/** What a Unique entity's routine does at one moment, as scripts read it. */
export interface RoutineReading {
  action: ScheduleAction["kind"] | "";
  held: boolean;
}

/** Each Unique entity's routine reading at `world.scene.now`, by id. A follower and a waiting entity have none.
 *  `held` reads true whether or not an action is in force (Q228). */
export function routineReadings(world: PositionWorld, uniques: Readonly<UniqueStates>): Record<string, RoutineReading> {
  const out: Record<string, RoutineReading> = {};
  for (const routine of world.uniques.values()) {
    const st = uniques[routine.id];
    if (st?.follow) continue;
    const action = actionNow(routine, st, world.scene);
    out[routine.id] = { action, held: isHeldNow(st, world.scene.now) };
  }
  return out;
}

/** What a script reads of `book` placed in `world`: each Unique entity's place and routine, each Generic entity's
 *  Generic Entity Instance positions, and who follows or waits. */
export const scriptPlaces = (
  book: PositionBook, world: PositionWorld,
): Pick<SandboxState, "positions" | "genericPositions" | "followers" | "waiting" | "routineNow"> => ({
  positions: book.positions, genericPositions: genericPlaces(book.generics), followers: followerIds(book.uniques), waiting: waitingIds(book.uniques),
  routineNow: routineReadings(world, book.uniques),
});

/** Every Unique entity and every Generic Entity Instance placed for `world.scene`: the engine's one step. A disabled
 *  entity stays where it is and its clock pauses, so it resumes there (Q23, Q38). */
export const placeAll = (book: PositionBook, world: PositionWorld): PositionBook =>
  paused(advancePositions([...world.uniques.values(), ...world.generics.values()], book, world.scene, world.random), world);

/** `book` with each disabled entity's engine times moved up to `world.scene.now`, so no time passes for it. */
function paused(book: PositionBook, world: PositionWorld): PositionBook {
  const { now } = world.scene;
  let uniques: UniqueStates | null = null;
  for (const id of world.off ?? []) {
    const st = book.uniques[id];
    if (!st || st.lastRun >= now) continue;
    const by = now - st.lastRun;
    uniques ??= { ...book.uniques };
    uniques[id] = {
      ...st, lastRun: now,
      ...(st.idleEnd !== undefined && { idleEnd: st.idleEnd + by }),
      ...(st.hold && 'until' in st.hold && { hold: { until: st.hold.until + by } }),
    };
  }
  return uniques ? { ...book, uniques } : book;
}

/**
 * A saved book against the world as it is now: positions of characters without a routine or at a deleted
 * place go, states of characters the world lost go, followers from a save written before the engine join as
 * Following, then everyone is placed for now. A Generic Entity Instance at a deleted place goes where its row puts it.
 * `held` names disabled entities: their entries stay as stored, unplaced (Q38).
 */
export function reconcileBook(
  book: PositionBook, world: PositionWorld, legacyFollowers: readonly string[] = [], held: ReadonlySet<string> = new Set(),
): PositionBook {
  if (held.size) return withHeld(reconcileBook(withoutIds(book, held), world, legacyFollowers), book, held, world);
  const live = new Set(world.scene.locations.map((l) => l.id));
  const positions: EntityPositions = {};
  for (const [id, at] of Object.entries(book.positions)) if (world.uniques.has(id) && live.has(at)) positions[id] = at;
  const uniques: UniqueStates = {};
  for (const [id, st] of Object.entries(book.uniques)) if (world.uniques.has(id)) uniques[id] = st;
  const generics: GenericStates = {};
  for (const [id, entityInstances] of Object.entries(book.generics)) {
    if (world.generics.has(id)) generics[id] = entityInstances;
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

/** `book` without the Unique entries of `ids`. */
function withoutIds(book: PositionBook, ids: ReadonlySet<string>): PositionBook {
  const drop = <T>(record: Readonly<Record<string, T>>) => Object.fromEntries(Object.entries(record).filter(([id]) => !ids.has(id)));
  return { ...book, positions: drop(book.positions), uniques: drop(book.uniques) };
}

/** `placed` with each of `held`'s stored entries from `stored` put back as they were, at a place that still exists. */
function withHeld(placed: PositionBook, stored: PositionBook, held: ReadonlySet<string>, world: PositionWorld): PositionBook {
  const live = new Set(world.scene.locations.map((l) => l.id));
  const positions = { ...placed.positions };
  const uniques = { ...placed.uniques };
  for (const id of held) {
    const at = stored.positions[id];
    // A held entity at a deleted place keeps what the reconcile gave it.
    if (at !== undefined && !live.has(at)) continue;
    if (at !== undefined) positions[id] = at;
    if (stored.uniques[id]) uniques[id] = stored.uniques[id];
  }
  return { ...placed, positions, uniques };
}

/**
 * The book once the opening hour is set: everyone away from the player is placed again for the real hour from
 * their rolled Start, and everyone at the player's place stays where the opening put them. A Generic Entity Instance
 * does the same from its own Start.
 */
export function reseatForOpening(book: PositionBook, world: PositionWorld): PositionBook {
  const { now, playerAt } = world.scene;
  const positions = { ...book.positions };
  const uniques: UniqueStates = {};
  for (const [id, st] of Object.entries(book.uniques)) {
    if (world.off?.has(id)) {
      uniques[id] = st;
      continue;
    }
    if (playerAt !== undefined && positions[id] === playerAt) {
      uniques[id] = { ...st, lastRun: now };
      continue;
    }
    uniques[id] = { startId: st.startId, lastRun: now, ...(st.follow && { follow: st.follow }) };
    if (!st.follow) delete positions[id];
  }
  const generics: GenericStates = {};
  for (const [id, entityInstances] of Object.entries(book.generics)) {
    generics[id] = Object.fromEntries(Object.entries(entityInstances).flatMap(([startId, p]) =>
      (playerAt !== undefined && p.position === playerAt ? [[startId, { ...p, lastRun: now }]] : [])));
  }
  return placeAll({ positions, uniques, generics }, world);
}

/** The book a new game at `playerAt` opens with at the start of the story, each Unique entity from its first Start
 *  and its first pick and each Generic entity from all of its: the one sample placement authoring reads (Q210, Q216). */
export function openingBook(
  entities: readonly Entity[], locations: readonly Pick<GameLocation, "id" | "parentId">[], connections: readonly Connection[], playerAt: string | undefined,
): PositionBook {
  return placeAll(EMPTY_BOOK, openingWorld(entities, locations, connections, playerAt));
}

/** The position world `openingBook` places `entities` in. */
export const openingWorld = (
  entities: readonly Entity[], locations: readonly Pick<GameLocation, "id" | "parentId">[], connections: readonly Connection[], playerAt: string | undefined,
): PositionWorld => positionWorld(castRoutines(entities), storyMinute(0), playerAt, locations, connections, () => 0, playerAt);
