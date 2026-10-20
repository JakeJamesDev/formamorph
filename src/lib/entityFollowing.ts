import type { Entity, EntityPositions } from "@/types";

/**
 * Followers and the entity location request's replies. A follower is at the player's location after every
 * player move; the turn commit joins the entity replies to the player's move in a fixed order (see
 * {@link joinEntityMoves}).
 */

/** One reply an entity location request can give. */
export type EntityMoveReply = "stay" | "comeAlong" | "keepFollowing" | "stayHere";

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

/** The `<MOVE OPTIONS>` chip: one offered reply per line. */
export const entityMoveOptionsText = (moves: readonly EntityMoveReply[]): string =>
  moves.map((move) => `- ${ENTITY_MOVE_LABELS[move]}`).join("\n");

/** The `<MOVE STATE>` chip: whether the entity already travels with the player. */
export const entityMoveStateText = (name: string, following: boolean): string =>
  following ? `${name} is following the player character.` : `${name} is not with the player character.`;

/** Where tracked entities stand and who follows the player. */
export interface FollowerState {
  positions: EntityPositions;
  followers: readonly string[];
}

/**
 * The entities that get a location request this turn: each follower, and each Can Follow entity positioned at
 * the player's location. In `entities` order. An entity without a position is at every listed location, so
 * it gets none.
 */
export function entityMoveSubjects(
  entities: readonly Entity[], state: FollowerState, playerLocationId: string | undefined,
): Entity[] {
  if (!playerLocationId) return [];
  const following = new Set(state.followers);
  return entities.filter((entity) =>
    following.has(entity.id) || (entity.movement === "follow" && state.positions[entity.id] === playerLocationId),
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

/** What one turn's entity requests answered, by entity id. */
export interface EntityMoveIntents {
  stayHere: readonly string[];
  comeAlong: readonly string[];
}

export const NO_ENTITY_MOVES: EntityMoveIntents = { stayHere: [], comeAlong: [] };

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

/** The player arriving at `to`: the followers come along, then each of `joining` joins them. Go on an offered
 *  move applies this with the entities its offer held. */
export function moveWithPlayer<S extends FollowerState>(state: S, joining: readonly string[], to: string): S {
  return joinFollowers(carryFollowers(state, to), joining, to);
}

/** The positions in `next` that differ from `base`: what a join moved. */
export function movedPositions(next: Readonly<EntityPositions>, base: Readonly<EntityPositions>): EntityPositions {
  return Object.fromEntries(Object.entries(next).filter(([id, at]) => base[id] !== at));
}

/**
 * One turn's join of the entity replies to the player's move: "stay here" leaves its entity where the player
 * stood, the followers move with the player, then "come along" joins at the destination. "Come along" needs a
 * move; without one it is dropped.
 */
export function joinEntityMoves<S extends FollowerState>(state: S, move: PlayerMove, intents: EntityMoveIntents): S {
  const left = leaveBehind(state, intents.stayHere, move.from);
  if (!move.to || move.to === move.from) return left;
  return moveWithPlayer(left, intents.comeAlong, move.to);
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
