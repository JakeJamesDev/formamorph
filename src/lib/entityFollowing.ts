import type { Connection, Entity, EntityPositions, GameLocation } from "@/types";
import { effectiveDestinations } from "@/lib/locationGraph";

/**
 * Followers and the entity location request's replies. A follower is at the player's location after every
 * player move; the turn commit joins the entity replies to the player's move in a fixed order (see
 * {@link joinEntityMoves}).
 */

/** One fixed reply an entity location request can give. */
export type EntityMoveReply = "stay" | "comeAlong" | "keepFollowing" | "stayHere";

/** What an entity location request matched: a fixed reply, or a walk to one of its locations, by id. */
export type EntityMove = EntityMoveReply | { goTo: string };

/** The closed list each reply is offered as. */
export const ENTITY_MOVE_LABELS: Record<EntityMoveReply, string> = {
  stay: "Stay",
  comeAlong: "Come along",
  keepFollowing: "Keep following",
  stayHere: "Stay here",
};

/** The replies an entity is offered: a follower keeps following or stays behind; anyone else stays or comes along. */
export function entityMoveOptions(following: boolean): EntityMoveReply[] {
  return following ? ["keepFollowing", "stayHere"] : ["stay", "comeAlong"];
}

/** A parsed reply narrowed back from a pass outcome. */
export const isEntityMove = (value: unknown): value is EntityMove =>
  (typeof value === "string" && value in ENTITY_MOVE_LABELS)
  || (typeof value === "object" && value !== null && typeof (value as { goTo?: unknown }).goTo === "string");

/** Each line an entity is offered, with the move it stands for: the fixed replies, then each place by name. */
export const entityMoveCandidates = (
  moves: readonly EntityMoveReply[], destinations: readonly GameLocation[] = [],
): [string, EntityMove][] => [
  ...moves.map((move): [string, EntityMove] => [ENTITY_MOVE_LABELS[move], move]),
  ...destinations.map((place): [string, EntityMove] => [place.name, { goTo: place.id }]),
];

/** The `<MOVE OPTIONS>` chip: one offered line per row. */
export const entityMoveOptionsText = (moves: readonly EntityMoveReply[], destinations: readonly GameLocation[] = []): string =>
  entityMoveCandidates(moves, destinations).map(([line]) => `- ${line}`).join("\n");

/**
 * The places a Moves Between entity standing at `standingAt` can walk to: each of its own locations among the
 * router's effective destinations from there. Empty for any other Movement.
 */
export function entityMoveDestinations(
  entity: Entity, standingAt: string, locations: GameLocation[], connections: Connection[],
): GameLocation[] {
  if (entity.movement !== "between") return [];
  const own = new Set(entity.locations);
  const byId = new Map(locations.map((place) => [place.id, place]));
  return [...effectiveDestinations(standingAt, locations, connections).keys()].flatMap((id) => {
    const place = own.has(id) ? byId.get(id) : undefined;
    return place ? [place] : [];
  });
}

/** The `<MOVE STATE>` chip: whether the entity already travels with the player. */
export const entityMoveStateText = (name: string, following: boolean): string =>
  following ? `${name} is following the player character.` : `${name} is not with the player character.`;

/** Where tracked entities stand and who follows the player. */
export interface FollowerState {
  positions: EntityPositions;
  followers: readonly string[];
}

/**
 * The entities that get a location request this turn: each follower, and each Can Follow or Moves Between
 * entity positioned at the player's location. In `entities` order. An entity without a position is at every
 * listed location, so it gets none.
 */
export function entityMoveSubjects(
  entities: readonly Entity[], state: FollowerState, playerLocationId: string | undefined,
): Entity[] {
  if (!playerLocationId) return [];
  const following = new Set(state.followers);
  return entities.filter((entity) =>
    following.has(entity.id)
    || ((entity.movement === "follow" || entity.movement === "between") && state.positions[entity.id] === playerLocationId),
  );
}

/** `positions` with each of `ids` at `locationId`. */
const placeAt = (positions: Readonly<EntityPositions>, ids: readonly string[], locationId: string): EntityPositions => ({
  ...positions, ...Object.fromEntries(ids.map((id) => [id, locationId])),
});

/** `state` with every follower at `locationId`. The same state when nobody follows or nobody moves. */
export function carryFollowers<S extends FollowerState>(state: S, locationId: string): S {
  const moving = state.followers.filter((id) => state.positions[id] !== locationId);
  return moving.length ? { ...state, positions: placeAt(state.positions, moving, locationId) } : state;
}

/** Where the player was and where they stand now. */
export interface PlayerMove {
  from: string;
  to: string | undefined;
}

/** A Moves Between entity's "come along": it goes with the player once, and only into one of `within`. */
export interface EntityComeOnce {
  id: string;
  within: readonly string[];
}

/** A Moves Between entity walking on its own to `to`. */
export interface EntityGoTo {
  id: string;
  to: string;
}

/** What one turn's entity requests answered, by entity id. Only `comeAlong` joins the followers. */
export interface EntityMoveIntents {
  stayHere: readonly string[];
  comeAlong: readonly string[];
  comeOnce: readonly EntityComeOnce[];
  goTo: readonly EntityGoTo[];
}

export const NO_ENTITY_MOVES: EntityMoveIntents = { stayHere: [], comeAlong: [], comeOnce: [], goTo: [] };

/** The replies that wait on the player's move in suggest mode: Go applies them, Dismiss drops them. */
export type EntityMoveOffer = Pick<EntityMoveIntents, "comeAlong" | "comeOnce">;

export const NO_ENTITY_OFFER: EntityMoveOffer = { comeAlong: [], comeOnce: [] };

export const hasEntityOffer = (offer: EntityMoveOffer): boolean => offer.comeAlong.length > 0 || offer.comeOnce.length > 0;

/** The replies `intents` holds that wait on the player's move. */
export const offerOf = ({ comeAlong, comeOnce }: EntityMoveIntents): EntityMoveOffer => ({ comeAlong, comeOnce });

/** One entity's matched reply, or null when its request answered nothing usable. */
export interface EntityReply {
  entity: Entity;
  move: EntityMove | null;
}

/**
 * The replies that change anything, by entity id. "Stay" and "keep following" change nothing. A Moves Between
 * entity's "come along" moves it once, only into its own locations, and never adds it to the followers.
 */
export function entityMoveIntents(replies: readonly EntityReply[]): EntityMoveIntents {
  const answering = (reply: EntityMoveReply) => replies.filter(({ move }) => move === reply).map(({ entity }) => entity);
  const stayHere = answering("stayHere").map((entity) => entity.id);
  const coming = answering("comeAlong");
  const comeAlong = coming.filter((entity) => entity.movement !== "between").map((entity) => entity.id);
  const comeOnce = coming.filter((entity) => entity.movement === "between")
    .map((entity) => ({ id: entity.id, within: entity.locations ?? [] }));
  const goTo = replies.flatMap(({ entity, move }) => typeof move === "object" && move ? [{ id: entity.id, to: move.goTo }] : []);
  return stayHere.length || comeAlong.length || comeOnce.length || goTo.length
    ? { stayHere, comeAlong, comeOnce, goTo }
    : NO_ENTITY_MOVES;
}

/** `state` with the replies that need no player move applied: "stay here" leaves its entity at `from`, and
 *  each walk applies. The same state when there is none. */
export function applyAtOnce<S extends FollowerState>(state: S, intents: EntityMoveIntents, from: string): S {
  const left = leaveBehind(state, intents.stayHere, from);
  if (intents.goTo.length === 0) return left;
  return { ...left, positions: { ...left.positions, ...Object.fromEntries(intents.goTo.map(({ id, to }) => [id, to])) } };
}

/**
 * What an entity location request offers `entity`, standing at the player's `locationId`: the fixed replies,
 * and the places it can walk to. A follower walks nowhere on its own.
 */
export function entityMoveOffers(
  entity: Entity, following: boolean, locationId: string, locations: GameLocation[], connections: Connection[],
): { moves: EntityMoveReply[]; destinations: GameLocation[] } {
  return {
    moves: entityMoveOptions(following),
    destinations: following ? [] : entityMoveDestinations(entity, locationId, locations, connections),
  };
}

/** `state` with `ids` no longer following, each left at `locationId`. */
export function leaveBehind<S extends FollowerState>(state: S, ids: readonly string[], locationId: string): S {
  const leaving = ids.filter((id) => state.followers.includes(id));
  if (leaving.length === 0) return state;
  return { ...state, positions: placeAt(state.positions, leaving, locationId), followers: state.followers.filter((id) => !leaving.includes(id)) };
}

/** `state` with `ids` following the player, each at `locationId`. */
export function joinFollowers<S extends FollowerState>(state: S, ids: readonly string[], locationId: string): S {
  const joining = ids.filter((id) => !state.followers.includes(id));
  if (joining.length === 0) return state;
  return { ...state, positions: placeAt(state.positions, joining, locationId), followers: [...state.followers, ...joining] };
}

/** The player arriving at `to`: the followers come along, each of `offer.comeAlong` joins them, and each of
 *  `offer.comeOnce` whose locations hold `to` arrives too. Go on an offered move applies this with its offer. */
export function moveWithPlayer<S extends FollowerState>(state: S, offer: EntityMoveOffer, to: string): S {
  const joined = joinFollowers(carryFollowers(state, to), offer.comeAlong, to);
  const arriving = offer.comeOnce.filter((once) => once.within.includes(to) && joined.positions[once.id] !== to);
  return arriving.length ? { ...joined, positions: placeAt(joined.positions, arriving.map((once) => once.id), to) } : joined;
}

/** The positions in `next` that differ from `base`: what a join moved. */
export function movedPositions(next: Readonly<EntityPositions>, base: Readonly<EntityPositions>): EntityPositions {
  return Object.fromEntries(Object.entries(next).filter(([id, at]) => base[id] !== at));
}

/**
 * One turn's join of the entity replies to the player's move: "stay here" leaves its entity where the player
 * stood and each walk applies, the followers move with the player, then "come along" arrives at the
 * destination. "Come along" needs a move; without one it is dropped.
 */
export function joinEntityMoves<S extends FollowerState>(state: S, move: PlayerMove, intents: EntityMoveIntents): S {
  const left = applyAtOnce(state, intents, move.from);
  if (!move.to || move.to === move.from) return left;
  return moveWithPlayer(left, intents, move.to);
}

/** A saved state's followers against the cast that can still hold a position. The same state when nobody goes. */
export function reconcileGameStateFollowers<S extends { entityFollowers?: string[] }>(state: S, castIds: ReadonlySet<string>): S {
  const saved = state.entityFollowers;
  if (!saved) return state;
  const live = liveFollowers(saved, castIds);
  if (live === saved) return state;
  const { entityFollowers: _old, ...rest } = state;
  // `rest` is `S` minus an optional field, so it still satisfies `S`; TypeScript can't see that through Omit.
  return (live.length ? { ...rest, entityFollowers: [...live] } : rest) as S;
}

/** `followers` minus entities the world no longer has. The same array when none went. */
export function liveFollowers(followers: readonly string[], entityIds: ReadonlySet<string>): readonly string[] {
  return followers.every((id) => entityIds.has(id)) ? followers : followers.filter((id) => entityIds.has(id));
}
