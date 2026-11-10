import type { Connection, DiscoveredEntity, Entity, EntityPositions, GameLocation } from "@/types";
import { effectiveDestinations } from "@/lib/locationGraph";
import type { EntityCodeWrite } from "@/lib/statCodeExecutor";
import { daypart, MINUTES_PER_DAY } from "@/lib/gameClock";
import {
  allowedPlaces, isStrictNow, moveIndividualByScript, partWays, startFollowing, startWaiting, waitUntil, type PositionBook, type WaitLength,
} from "@/lib/positionEngine";
import { followerIds, placeAll, withPlayerAt, type PositionWorld } from "@/lib/positionPlay";

/**
 * Followers and the entity location request's replies, over the position engine's book. The turn commit joins
 * the entity replies to the player's move in a fixed order (see {@link joinEntityMoves}).
 */

/** One fixed reply an entity location request can give. */
export type EntityMoveReply = "stay" | "comeAlong" | "keepFollowing" | "waitHour" | "waitThisDaypart" | "waitNextDaypart" | "partWays";

/** What an entity location request matched: a fixed reply, or a walk to one of its places, by id. */
export type EntityMove = EntityMoveReply | { goTo: string };

const WAIT_LENGTHS = { waitHour: "hour", waitThisDaypart: "thisDaypart", waitNextDaypart: "nextDaypart" } as const satisfies Partial<Record<EntityMoveReply, WaitLength>>;

type WaitReply = keyof typeof WAIT_LENGTHS;

const isWaitReply = (move: EntityMove | null): move is WaitReply => typeof move === "string" && move in WAIT_LENGTHS;

/** The fixed replies' lines. A wait's line also names when it ends, from the story clock. */
const FIXED_LABELS: Record<Exclude<EntityMoveReply, WaitReply>, string> = {
  stay: "Stay",
  comeAlong: "Come along",
  keepFollowing: "Keep following",
  partWays: "Part ways",
};

const FOLLOWER_REPLIES: readonly EntityMoveReply[] = ["keepFollowing", "waitHour", "waitThisDaypart", "waitNextDaypart", "partWays"];
const NEWCOMER_REPLIES: readonly EntityMoveReply[] = ["stay", "comeAlong"];

/** The replies an entity is offered (Q4, Q8): a follower keeps following, waits for one of three lengths, or
 *  parts ways; anyone else stays or comes along. */
export function entityMoveOptions(following: boolean): EntityMoveReply[] {
  return [...(following ? FOLLOWER_REPLIES : NEWCOMER_REPLIES)];
}

/** A parsed reply narrowed back from a pass outcome. */
export const isEntityMove = (value: unknown): value is EntityMove =>
  (typeof value === "string" && [...NEWCOMER_REPLIES, ...FOLLOWER_REPLIES].some((reply) => reply === value))
  || (typeof value === "object" && value !== null && typeof (value as { goTo?: unknown }).goTo === "string");

/** Minutes since that day's midnight. */
const minuteOfDay = (minute: number): number => ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

/** A story minute as a 24-hour clock. */
const clockText = (minute: number): string => {
  const inDay = minuteOfDay(minute);
  return `${String(Math.floor(inDay / 60)).padStart(2, "0")}:${String(inDay % 60).padStart(2, "0")}`;
};

const daypartOf = (minute: number): string => daypart(minuteOfDay(minute) / 60);

/** One reply's line at story minute `now`. */
export function entityMoveLabel(move: EntityMoveReply, now: number): string {
  if (!isWaitReply(move)) return FIXED_LABELS[move];
  const until = waitUntil(WAIT_LENGTHS[move], now);
  if (move === "waitHour") return `Wait here about an hour, until ${clockText(until)}, ${daypartOf(until)}`;
  // A minute past the edge, since edges round down from the daypart's fractional start.
  return `Wait here until ${clockText(until)}, when ${daypartOf(until + 1)} begins`;
}

/** The request's fixed time line (Q107): the clock and the daypart now. */
export const entityMoveTimeLine = (now: number): string => `The time is ${clockText(now)}, ${daypartOf(now)}.`;

/** Each line an entity is offered at story minute `now`, with the move it stands for: the fixed replies, then
 *  each place by name. */
export const entityMoveCandidates = (
  moves: readonly EntityMoveReply[], destinations: readonly GameLocation[], now: number,
): [string, EntityMove][] => [
  ...moves.map((move): [string, EntityMove] => [entityMoveLabel(move, now), move]),
  ...destinations.map((place): [string, EntityMove] => [place.name, { goTo: place.id }]),
];

/** The offered lines as a list, one per row. */
export const entityMoveOptionsText = (moves: readonly EntityMoveReply[], destinations: readonly GameLocation[], now: number): string =>
  entityMoveCandidates(moves, destinations, now).map(([line]) => `- ${line}`).join("\n");

/** One subject's state line in the entity location request: whether it already travels with the player. */
export const entityMoveStateText = (name: string, following: boolean): string =>
  following ? `${name} is following the player character.` : `${name} is not with the player character.`;

/** Where tracked characters stand and their engine state. Followers are the ones in Following. */
export type FollowerState = PositionBook;

/** The ids following the player in `state`. */
export const followersOf = (state: FollowerState): string[] => followerIds(state.individuals);

/** The runtime characters beside the world's entities, and which of them the scene list holds this turn. */
export interface RuntimeCast {
  runtime: readonly DiscoveredEntity[];
  inScene: ReadonlySet<string>;
}

const NO_RUNTIME_CAST: RuntimeCast = { runtime: [], inScene: new Set() };

/**
 * The entities that get a location request this turn: each follower, and each Individual at the player's place
 * whose row is not Strict. A runtime character counts only while the scene list holds it. In `entities` order.
 */
export function entityMoveSubjects(
  entities: readonly Entity[], state: FollowerState, playerLocationId: string | undefined, world: PositionWorld,
  cast: RuntimeCast = NO_RUNTIME_CAST,
): Entity[] {
  if (!playerLocationId) return [];
  const following = new Set(followersOf(state));
  const runtimeIds = new Set(cast.runtime.map((d) => d.entity.id));
  const scene = withPlayerAt(world, playerLocationId).scene;
  return entities.filter((entity) => {
    if (following.has(entity.id)) return true;
    const routine = world.routines.get(entity.id);
    const st = state.individuals[entity.id];
    if (!routine || !st || st.follow || state.positions[entity.id] !== playerLocationId) return false;
    if (runtimeIds.has(entity.id) && !cast.inScene.has(entity.id)) return false;
    return !isStrictNow(routine, st, scene.now);
  });
}

/** The places `entity` standing at `standingAt` can walk to alone: its allowed places among the router's
 *  effective destinations from there (Q105). */
export function entityMoveDestinations(
  entity: Entity, standingAt: string, state: FollowerState, world: PositionWorld, locations: GameLocation[], connections: Connection[],
): GameLocation[] {
  const routine = world.routines.get(entity.id);
  const own = routine ? allowedPlaces(routine, state.individuals[entity.id], world.scene) : new Set<string>();
  const byId = new Map(locations.map((place) => [place.id, place]));
  return [...effectiveDestinations(standingAt, locations, connections).keys()].flatMap((id) => {
    const place = own.has(id) ? byId.get(id) : undefined;
    return place ? [place] : [];
  });
}

/** `positions` with each of `ids` at `locationId`. */
const placeAt = (positions: Readonly<EntityPositions>, ids: readonly string[], locationId: string): EntityPositions => ({
  ...positions, ...Object.fromEntries(ids.map((id) => [id, locationId])),
});

/** Where each runtime character stands: its anchor location. */
export function runtimePositions(discovered: readonly DiscoveredEntity[]): EntityPositions {
  return Object.fromEntries(discovered.flatMap((d) => (d.locationId ? [[d.entity.id, d.locationId]] : [])));
}

/** `discovered` with each character `positions` names moved there. The same array when none moves. */
export function withRuntimePositions(discovered: DiscoveredEntity[], positions: Readonly<EntityPositions>): DiscoveredEntity[] {
  if (!discovered.some((d) => positions[d.entity.id] !== undefined && positions[d.entity.id] !== d.locationId)) return discovered;
  return discovered.map((d) => {
    const at = positions[d.entity.id];
    return at === undefined || at === d.locationId ? d : { ...d, locationId: at };
  });
}

/** Where the player was and where they stand now. */
export interface PlayerMove {
  from: string;
  to: string | undefined;
}

/** A character walking alone to `to`. */
export interface EntityGoTo {
  id: string;
  to: string;
}

/** A follower left waiting for one of the offered lengths. */
export interface EntityWait {
  id: string;
  length: WaitLength;
}

/** What one turn's entity requests answered, by entity id. Only `comeAlong` joins the followers. */
export interface EntityMoveIntents {
  wait: readonly EntityWait[];
  partWays: readonly string[];
  comeAlong: readonly string[];
  goTo: readonly EntityGoTo[];
}

export const NO_ENTITY_MOVES: EntityMoveIntents = { wait: [], partWays: [], comeAlong: [], goTo: [] };

/** The replies that wait on the player's move in suggest mode: Go applies them, Dismiss drops them. */
export type EntityMoveOffer = Pick<EntityMoveIntents, "comeAlong">;

export const NO_ENTITY_OFFER: EntityMoveOffer = { comeAlong: [] };

export const hasEntityOffer = (offer: EntityMoveOffer): boolean => offer.comeAlong.length > 0;

/** The replies `intents` holds that wait on the player's move. */
export const offerOf = ({ comeAlong }: EntityMoveIntents): EntityMoveOffer => ({ comeAlong });

/** One entity's matched reply, or null when its request answered nothing usable. */
export interface EntityReply {
  entity: Entity;
  move: EntityMove | null;
}

/** A parsed reply narrowed back from a pass outcome. */
export const isEntityReply = (value: unknown): value is EntityReply => {
  if (typeof value !== "object" || value === null) return false;
  const { entity, move } = value as { entity?: unknown; move?: unknown };
  return typeof entity === "object" && entity !== null && (move === null || isEntityMove(move));
};

/** The replies that change anything, by entity id. "Stay" and "keep following" change nothing. */
export function entityMoveIntents(replies: readonly EntityReply[]): EntityMoveIntents {
  const answering = (reply: EntityMoveReply) => replies.filter(({ move }) => move === reply).map(({ entity }) => entity.id);
  const wait = replies.flatMap(({ entity, move }) => isWaitReply(move) ? [{ id: entity.id, length: WAIT_LENGTHS[move] }] : []);
  const parting = answering("partWays");
  const comeAlong = answering("comeAlong");
  const goTo = replies.flatMap(({ entity, move }) => typeof move === "object" && move ? [{ id: entity.id, to: move.goTo }] : []);
  return wait.length || parting.length || comeAlong.length || goTo.length ? { wait, partWays: parting, comeAlong, goTo } : NO_ENTITY_MOVES;
}

/** `state` with the replies that need no player move applied: a wait leaves its follower waiting for that
 *  length, Part ways sends it back to its routine, and each walk to an allowed place applies with a hold. The
 *  same state when there is none. */
export function applyAtOnce(state: FollowerState, intents: EntityMoveIntents, from: string, world: PositionWorld): FollowerState {
  const { scene } = withPlayerAt(world, from);
  let next = state;
  for (const { id, length } of intents.wait) next = startWaiting(next, id, length, scene.now);
  for (const id of intents.partWays) next = partWays(next, id);
  for (const { id, to } of intents.goTo) {
    const routine = world.routines.get(id);
    if (!routine || !allowedPlaces(routine, next.individuals[id], scene).has(to)) continue;
    next = moveIndividualByScript(next, routine, to, scene);
  }
  return next;
}

/** What an entity location request offers `entity`, standing at the player's `locationId`: the fixed replies, and
 *  the places it can walk to. A follower walks nowhere on its own. */
export function entityMoveOffers(
  entity: Entity, following: boolean, locationId: string, state: FollowerState, world: PositionWorld,
  locations: GameLocation[], connections: Connection[],
): { moves: EntityMoveReply[]; destinations: GameLocation[] } {
  return {
    moves: entityMoveOptions(following),
    destinations: following ? [] : entityMoveDestinations(entity, locationId, state, world, locations, connections),
  };
}

/** Each entity the turn asks whether it moves, with what it is offered. `cast` is the entities as they stand in
 *  play; each route reads the same entity in `authored`. */
export function entityMoveRequests(
  cast: readonly Entity[], authored: readonly Entity[], state: FollowerState, playerLocationId: string | undefined,
  world: PositionWorld, locations: GameLocation[], connections: Connection[], runtimeCast?: RuntimeCast,
): { name: string; entity: Entity; moves: EntityMoveReply[]; destinations: GameLocation[]; moveClock: number }[] {
  if (!playerLocationId) return [];
  const authoredById = new Map(authored.map((entity) => [entity.id, entity]));
  const following = new Set(followersOf(state));
  return entityMoveSubjects(cast, state, playerLocationId, world, runtimeCast).map((standing) => {
    const entity = authoredById.get(standing.id) ?? standing;
    return {
      name: entity.name,
      entity,
      ...entityMoveOffers(entity, following.has(entity.id), playerLocationId, state, world, locations, connections),
      moveClock: world.scene.now,
    };
  });
}

/** The player arriving at `to`: each of `offer.comeAlong` starts following, then the engine leads every follower
 *  there, leaving one that may not enter waiting. Go on an offered move applies this with its offer. */
export function moveWithPlayer(state: FollowerState, offer: EntityMoveOffer, to: string, world: PositionWorld): FollowerState {
  const at = withPlayerAt(world, to);
  let next = state;
  for (const id of offer.comeAlong) {
    const routine = world.routines.get(id);
    if (routine) next = startFollowing(next, routine, at.scene);
  }
  return placeAll(next, at);
}

/** The positions in `next` that differ from `base`: what a join moved. */
export function movedPositions(next: Readonly<EntityPositions>, base: Readonly<EntityPositions>): EntityPositions {
  return Object.fromEntries(Object.entries(next).filter(([id, at]) => base[id] !== at));
}

/**
 * One turn's join of the entity replies to the player's move: "stay here" and each walk apply where the player
 * stood, then "come along" joins, then the engine places everyone for where the player stands now. "Come along"
 * needs a move; without one it is dropped.
 */
export function joinEntityMoves(state: FollowerState, move: PlayerMove, intents: EntityMoveIntents, world: PositionWorld): FollowerState {
  const left = applyAtOnce(state, intents, move.from, world);
  if (!move.to || move.to === move.from) return placeAll(left, withPlayerAt(world, move.from));
  return moveWithPlayer(left, intents, move.to, world);
}

/**
 * `state` with code's entity writes applied in call order, the player standing at `playerAt`. `move` ends a
 * follow or a wait and holds the character there; `follow` makes any Individual follow, past Strict and
 * Traversable; `unfollow` is Part ways. A Group takes none of them.
 */
export function applyEntityCodeWrites(
  state: FollowerState, writes: readonly EntityCodeWrite[] | undefined, playerAt: string | undefined, world: PositionWorld,
): FollowerState {
  const { scene } = withPlayerAt(world, playerAt);
  let next = state;
  for (const write of writes ?? []) {
    const routine = world.routines.get(write.entity);
    if (!routine) continue;
    switch (write.kind) {
      case "move":
        next = moveIndividualByScript(partWays(next, routine.id), routine, write.location, scene);
        break;
      case "unfollow":
        next = partWays(next, routine.id);
        break;
      case "follow":
        next = startFollowing(next, routine, scene, { script: true });
        if (playerAt && next.individuals[routine.id]?.follow?.mode === "following") next = { ...next, positions: placeAt(next.positions, [routine.id], playerAt) };
        break;
      case "meet": // lands on the met list at commit
        break;
    }
  }
  return next;
}

/** Where characters stand within one script chain, read by the next script before anything commits. */
export interface ChainPositions {
  positions: EntityPositions;
  followers: readonly string[];
  waiting: readonly string[];
}

/** `state` with code's entity writes laid over for the next script of the chain to read. `individual` says which
 *  ids take them. */
export function chainEntityWrites(
  state: ChainPositions, writes: readonly EntityCodeWrite[] | undefined, playerAt: string | undefined, individual: (id: string) => boolean,
): ChainPositions {
  let next = state;
  for (const write of writes ?? []) {
    const { entity } = write;
    if (write.kind === "meet" || !individual(entity)) continue;
    const without = (ids: readonly string[]) => ids.filter((id) => id !== entity);
    if (write.kind === "move") {
      next = { positions: placeAt(next.positions, [entity], write.location), followers: without(next.followers), waiting: without(next.waiting) };
    } else if (write.kind === "unfollow") {
      next = { ...next, followers: without(next.followers), waiting: without(next.waiting) };
    } else {
      next = {
        positions: playerAt ? placeAt(next.positions, [entity], playerAt) : next.positions,
        followers: next.followers.includes(entity) ? next.followers : [...next.followers, entity],
        waiting: without(next.waiting),
      };
    }
  }
  return next;
}
