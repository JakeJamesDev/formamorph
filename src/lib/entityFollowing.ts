import type { Connection, DiscoveredEntity, Entity, EntityPositions, GameLocation } from "@/types";
import { effectiveDestinations } from "@/lib/locationGraph";
import type { EntityCodeWrite } from "@/lib/statCodeExecutor";
import { isEverywhere } from "@/lib/entityPresence";

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

/** The runtime characters beside the world's entities, and which of them the scene list holds this turn. */
export interface RuntimeCast {
  runtime: readonly DiscoveredEntity[];
  inScene: ReadonlySet<string>;
}

const NO_RUNTIME_CAST: RuntimeCast = { runtime: [], inScene: new Set() };

/**
 * The entities that get a location request this turn: each follower; each Can Follow or Moves Between entity
 * positioned at the player's location; each runtime character there that the scene list holds; and each
 * Everywhere Listed Can Follow entity listed there, unless one of its peeled followers follows. In
 * `entities` order.
 */
export function entityMoveSubjects(
  entities: readonly Entity[], state: FollowerState, playerLocationId: string | undefined, cast: RuntimeCast = NO_RUNTIME_CAST,
): Entity[] {
  if (!playerLocationId) return [];
  const following = new Set(state.followers);
  const runtimeIds = new Set(cast.runtime.map((d) => d.entity.id));
  const peeledAway = new Set(cast.runtime.flatMap((d) => (d.peeledFrom && following.has(d.entity.id) ? [d.peeledFrom] : [])));
  return entities.filter((entity) => {
    if (following.has(entity.id)) return true;
    const at = state.positions[entity.id];
    if (runtimeIds.has(entity.id)) return at === playerLocationId && cast.inScene.has(entity.id);
    if (entity.movement !== "follow" && entity.movement !== "between") return false;
    if (at !== undefined) return at === playerLocationId;
    return entity.movement === "follow" && isEverywhere(entity) && !!entity.locations?.includes(playerLocationId) && !peeledAway.has(entity.id);
  });
}

/** Turns an Everywhere Listed entity's "come along" into a new runtime character that follows instead. */
export interface PeelOff {
  sources: ReadonlyMap<string, Entity>;
  /** The new character's id for a source: the same id for the same source all turn. */
  idFor(sourceId: string): string;
}

/** The peel-off for one turn: every Everywhere Listed Can Follow entity, each with one id minted on first ask. */
export function turnPeelOff(entities: readonly Entity[], newId: () => string): PeelOff {
  const sources = new Map(entities.filter((e) => e.movement === "follow" && isEverywhere(e)).map((e) => [e.id, e]));
  const ids = new Map<string, string>();
  return {
    sources,
    idFor: (sourceId) => {
      const id = ids.get(sourceId) ?? newId();
      ids.set(sourceId, id);
      return id;
    },
  };
}

/** `intents` with each source's "come along" given to its new character. The same intents when none peels. */
export function peelIntents<I extends EntityMoveIntents>(intents: I, peel: PeelOff | undefined): I {
  if (!peel || !intents.comeAlong.some((id) => peel.sources.has(id))) return intents;
  return { ...intents, comeAlong: intents.comeAlong.map((id) => (peel.sources.has(id) ? peel.idFor(id) : id)) };
}

/** The runtime character peeled off `source`: its name and its summary. */
export function peeledEntity(source: Entity, id: string): Entity {
  const summary = source.aiSummary?.trim() ?? "";
  return { id, name: source.name, aiDescription: summary || source.aiDescription?.trim() || "", ...(summary ? { aiSummary: summary } : {}) };
}

/** The runtime characters `state` has following that `peel` minted and `known` lacks, each where it stands. */
export function peeledCharacters(
  state: FollowerState, peel: PeelOff | undefined, known: ReadonlySet<string>, sourceTurnId: string,
): DiscoveredEntity[] {
  if (!peel) return [];
  return [...peel.sources.values()].flatMap((source) => {
    const id = peel.idFor(source.id);
    const locationId = state.positions[id];
    if (known.has(id) || !state.followers.includes(id) || locationId === undefined) return [];
    return [{ entity: peeledEntity(source, id), locationId, sourceTurnId, peeledFrom: source.id }];
  });
}

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

/**
 * `state` with code's entity writes applied in call order, the player standing at `playerAt`. `move` places
 * the entity and ends its following; `follow` joins it at the player's side; `unfollow` leaves a follower
 * there. A move or a follow on an untracked entity gives it a position, so it is tracked from then on.
 */
export function applyEntityCodeWrites<S extends FollowerState>(
  state: S, writes: readonly EntityCodeWrite[] | undefined, playerAt: string | undefined,
): S {
  let next = state;
  for (const write of writes ?? []) {
    const { entity } = write;
    const following = next.followers.includes(entity);
    const without = () => next.followers.filter((id) => id !== entity);
    const atPlayer = () => (playerAt ? placeAt(next.positions, [entity], playerAt) : next.positions);
    switch (write.kind) {
      case "move":
        next = { ...next, positions: placeAt(next.positions, [entity], write.location), followers: without() };
        break;
      case "unfollow":
        if (following) next = { ...next, positions: atPlayer(), followers: without() };
        break;
      case "follow":
        next = { ...next, positions: atPlayer(), followers: following ? next.followers : [...next.followers, entity] };
        break;
    }
  }
  return next;
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
