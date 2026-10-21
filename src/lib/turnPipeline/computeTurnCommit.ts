import type { AITurnResult, Entity, TurnToolCall } from '@/types';
import type { StatClock, WorldWrites } from '@/lib/statCodeExecutor';
import { mergeWorldWrites } from '@/lib/worldWrites';
import type { WorldCalendar } from '@/lib/gameClock';
import { FLAT_HOURS_PER_TURN } from '@/lib/gameClock';
import { materializeDiscoveredEntity } from '@/lib/runtimeCharacters';
import { sameCharacterName } from '@/lib/entityMatch';
import { randomUUID } from '@/lib/uuid';
import type { parseStatUpdates } from '@/lib/statChanges';
import { readStatResponse, statResponseChanges, type StatResponse } from '@/lib/statRequest';
import {
  applyAtOnce, applyEntityCodeWrites, entityMoveIntents, isEntityMove, joinEntityMoves, NO_ENTITY_OFFER, offerOf, peelIntents,
  type EntityMoveIntents, type EntityMoveOffer, type FollowerState, type PeelOff, type PlayerMove,
} from '@/lib/entityFollowing';
import type { TurnPassId, TurnPlan } from './turnPlan';
import type { TurnPassOutcome, TurnResult } from './turnRunner';

/**
 * The Turn Commit: everything one finished turn changes, computed as one value before any of it is applied.
 * Pure — the view's apply step is thin setters over what this returns, so the merge logic between them
 * (which fields the stored turn carries, what the clock reads, who was discovered) is answerable by calling
 * this function.
 */

/** A character the turn discovered, anchored so it rolls back with the turn that found them. */
export interface TurnDiscovery {
  entity: Entity;
  locationId?: string;
  sourceTurnId: string;
}

/** What the view knows about this turn that the run itself does not carry. */
export interface TurnCommitContext {
  /** Who took part, from the narration parse — stored on the turn and read back by the choices filter. */
  participants: string[];
  /** Where the turn took place, after any auto-resolved move. */
  locationId?: string;
  /** The name of that location. A router reply naming it is a suggestion to stay put, so nothing is offered. */
  currentLocationName?: string;
  /** Where a discovered character is anchored: the turn's location, or the one the turn began in. */
  discoveryLocationId?: string;
  /** Names already materialized, so a character narrated again is not added a second time. */
  knownDiscoveredNames: string[];
  /** The live scratchpad, frozen into this turn. */
  notes: string;
  reasoning: { text: string; ms: number };
  /** The planner's call on whether the player is in the picture. Undefined when no planner ran. */
  playerInFrame?: boolean;
  /** Story hours elapsed before this turn. */
  gameTime: number;
  /** Story hours a turn costs while Measured Clock is off: the player's Time Per Turn. Defaults to the flat
   *  hour. */
  fixedTurnHours?: number;
  /** The world's time frame as it stands; the opening turn replaces it with the hour it just measured. */
  calendar?: WorldCalendar;
  /** Ids for materialized entities — the one thing here that isn't a function of its inputs, so it enters
   *  as one. Defaults to a fresh UUID. */
  newEntityId?: () => string;
  /** What this turn's code wrote to the location, the clock and the cast before the commit. Each field beats
   *  the pass that answers it (Q13, Q15). */
  codeWrites?: WorldWrites;
  /** Names a code discovery leaves alone: every entity's, and the ones the player deleted. Absent ⇒ none. */
  heldNames?: readonly string[];
  /** Entity id → the name its diary entries go under, for the code's `diary` lines. */
  diaryNames?: Readonly<Record<string, string>>;
  /** The turn's Script World Tool calls, in call order. */
  toolCalls?: readonly TurnToolCall[];
  /** How an Everywhere Listed entity's "come along" peels a new follower off it. Absent ⇒ none peels. */
  peel?: PeelOff;
}

export interface TurnCommitInput {
  result: TurnResult;
  plan: TurnPlan;
  context: TurnCommitContext;
}

/** One turn's complete state delta. */
export interface TurnCommit {
  statResponse: StatResponse | null;
  /** The turn as it is stored, ready to replace the streamed assistant message. */
  turn: AITurnResult;
  /** Value deltas, one single-key object per stat, as the stat applier takes them. */
  statChanges: Record<string, number>[];
  /** Cap deltas, which re-clamp the current value into the new range. Empty when none moved. */
  statMaxChanges: Record<string, number>;
  /** The destination the suggest pass matched, offered to the player. Null when there is nothing to offer. */
  suggestedLocation: string | null;
  /** Hours this turn charges the clock: what the pass measured, or the flat hour. */
  turnHours: number;
  /** Where the story clock stands for this turn's stat code. */
  clock: StatClock;
  isOpeningTurn: boolean;
  /** The story's opening hour, on the opening turn only. Null means the shipped default stands. */
  openingHour: number | null;
  discoveries: TurnDiscovery[];
  /** The location code moved the turn to, which the apply step moves play to. `turn.locationId` holds a router
   *  move too, so this tells the two apart. Null when code moved nothing. */
  codeMove: string | null;
  /** Every code write this commit holds, so a later batch lays over them. Null when it holds none. */
  codeWrites: WorldWrites | null;
  /** What the entity location requests answered, by entity id. */
  entityMoves: EntityMoveIntents;
}

/** Every outcome one pass produced, in dispatch order. A failed request is left out — it answered nothing. */
const answers = (passes: readonly TurnPassOutcome[], id: TurnPassId): TurnPassOutcome[] =>
  passes.filter((outcome) => outcome.id === id && !outcome.error);

/** What a pass that runs once read, or null when it did not run or failed. */
const answerOf = <T>(passes: TurnPassOutcome[], id: TurnPassId): T | null => {
  const outcome = answers(passes, id)[0];
  return outcome ? (outcome.parsed as T) : null;
};

/**
 * Fold a finished run into the state it changes. Answers null when there is nothing to apply: a stopped
 * turn, a failed one, or a turn whose narration came back empty — none of those advance the story, and each
 * leaves the location, the clock and the stats exactly as they were.
 */
export function computeTurnCommit({ result, plan, context }: TurnCommitInput): TurnCommit | null {
  if (result.status !== 'ok') return null;
  const { material, passes } = result.run;
  const narration = material.narration;
  if (!narration) return null;

  const newEntityId = context.newEntityId ?? randomUUID;

  const choices = answerOf<string[]>(passes, 'choices') ?? [];

  const stats = answerOf<ReturnType<typeof parseStatUpdates>>(passes, 'statUpdates');
  const statOutcome = answers(passes, 'statUpdates')[0];
  const statResponse = statOutcome?.request.statRequest
    ? readStatResponse(statOutcome.raw, statOutcome.request.statRequest) : null;
  const statChanges = statResponse ? statResponseChanges(statResponse)
    : Object.entries(stats?.values ?? {}).map(([name, delta]) => ({ [name]: delta }));
  const statMaxChanges = stats?.maxes ?? {};

  // The measured duration when the clock pass ran. An unreadable, out-of-range or absent reply resolves to the
  // flat hour rather than to zero, so a bad answer cannot freeze a clock the player asked to measure. With the
  // pass off, the turn costs the player's Time Per Turn, which may be zero.
  const measuredHours = answerOf<number | null>(passes, 'timePassed');
  const clockPassRan = passes.some((outcome) => outcome.id === 'timePassed');
  const fixedHours = clockPassRan ? FLAT_HOURS_PER_TURN : Math.max(0, context.fixedTurnHours ?? FLAT_HOURS_PER_TURN);
  const turnHours = measuredHours ?? fixedHours;

  // Seed the story's opening hour, on the opening turn only: a retroactive answer would re-date every
  // memory stamp already written. An unreadable answer leaves it null, which reads as the shipped default.
  const openingHour = plan.isOpeningTurn ? answerOf<number | null>(passes, 'openingTime') : null;

  const summary = answerOf<string>(passes, 'summary') ?? '';

  // The router answers with one of the destination names, so a reply naming where the player already
  // stands is matched by name and dropped — there is no move to offer.
  const suggested = answerOf<string | null>(passes, 'locationSuggest');

  // A diary that came back empty is still stored, so its participant isn't retried forever; one whose
  // request failed is left unset for the idle drainer to backfill.
  const diaries: Record<string, string> = {};
  for (const outcome of answers(passes, 'diary')) {
    if (outcome.subject) diaries[outcome.subject.name] = outcome.parsed as string;
  }

  // Each character the narration invented, with the description that makes them durable. A blank one is
  // unusable, so that character stays due for the drainer instead of being materialized description-less.
  const discoveries: TurnDiscovery[] = [];
  for (const outcome of answers(passes, 'discoverEntity')) {
    const name = outcome.subject?.name;
    const description = outcome.parsed as string;
    if (!name || !description) continue;
    if (context.knownDiscoveredNames.some((known) => sameCharacterName(known, name))) continue;
    discoveries.push({
      entity: materializeDiscoveredEntity(name, description, newEntityId()),
      locationId: context.discoveryLocationId,
      sourceTurnId: material.turnId,
    });
  }

  const entityMoves = peelIntents(entityMovesOf(passes), context.peel);

  const turn: AITurnResult = {
    narration,
    choices,
    stat_changes: statChanges,
    turnId: material.turnId,
    entities: context.participants,
    ...(context.locationId !== undefined ? { locationId: context.locationId } : {}),
    ...(context.notes ? { notes: context.notes } : {}),
    ...(context.reasoning.text ? { reasoning: context.reasoning } : {}),
    ...(context.playerInFrame !== undefined ? { playerInFrame: context.playerInFrame } : {}),
    ...(summary ? { summary } : {}),
    // A turn without a stored delta reads back as the flat hour, so only a time that differs is stored.
    ...(measuredHours !== null || turnHours !== FLAT_HOURS_PER_TURN ? { timeDelta: turnHours } : {}),
    ...(Object.keys(diaries).length ? { diaries } : {}),
    ...(context.toolCalls?.length ? { toolCalls: [...context.toolCalls] } : {}),
  };

  return withCodeWrites({
    turn,
    statResponse,
    statChanges,
    statMaxChanges,
    suggestedLocation: suggested === context.currentLocationName ? null : suggested,
    turnHours,
    clock: {
      deltaHours: turnHours,
      // The END of the turn, so a long sleep that began in daylight reports the night the player just read.
      elapsedHours: context.gameTime + turnHours,
      // The opening turn's own frame, built from the hour just measured: without it the opening turn's stat
      // code reads the default start hour and an accumulating stat banks that wrong value for good.
      calendar: openingHour !== null ? { startHour: openingHour } : context.calendar,
    },
    isOpeningTurn: plan.isOpeningTurn,
    openingHour,
    discoveries,
    codeMove: null,
    codeWrites: null,
    entityMoves,
  }, context.codeWrites, context);
}

/** The entity replies that change anything, by entity id. A failed request, "stay" and "keep following"
 *  change nothing. */
export function entityMovesOf(passes: readonly TurnPassOutcome[]): EntityMoveIntents {
  return entityMoveIntents([...answers(passes, 'entityLocationAuto'), ...answers(passes, 'entityLocationSuggest')]
    .flatMap(({ subject, parsed }) => subject?.entity ? [{ entity: subject.entity, move: isEntityMove(parsed) ? parsed : null }] : []));
}

/**
 * A committed turn's entity replies laid over `state`, once the player's move is known: `from` is where the
 * turn began, `to` where the player stands after the router and the turn's code. While the commit offers a
 * move the player has not taken, "stay here" and each walk apply at once and "come along" waits in `offer`
 * for Go. The code's entity writes apply last, and an entity they name leaves the offer.
 */
export function commitEntityMoves<S extends FollowerState>(
  state: S,
  commit: Pick<TurnCommit, 'entityMoves' | 'suggestedLocation' | 'codeWrites'>,
  move: PlayerMove,
): { state: S; offer: EntityMoveOffer } {
  const { entityMoves } = commit;
  const code = commit.codeWrites?.entities;
  const moved = move.to !== undefined && move.to !== move.from;
  if (commit.suggestedLocation && !moved) {
    const written = new Set(code?.map((write) => write.entity));
    const offer = offerOf(entityMoves);
    return {
      state: applyEntityCodeWrites(applyAtOnce(state, entityMoves, move.from), code, move.from),
      offer: written.size ? {
        comeAlong: offer.comeAlong.filter((id) => !written.has(id)), comeOnce: offer.comeOnce.filter(({ id }) => !written.has(id)),
      } : offer,
    };
  }
  return { state: applyEntityCodeWrites(joinEntityMoves(state, move, entityMoves), code, move.to ?? move.from), offer: NO_ENTITY_OFFER };
}

/**
 * `commit` with `writes` laid over the code writes it already holds. A code write beats the pass for its
 * field: a move drops the suggest offer, an advance replaces the turn's duration, and a described discovery
 * replaces the pass's record of that name. Memory and diary lines join the turn beside the passes. The same
 * commit when `writes` is absent.
 */
export function withCodeWrites(commit: TurnCommit, writes: WorldWrites | undefined, context: TurnCommitContext): TurnCommit {
  if (!writes) return commit;
  const codeWrites = mergeWorldWrites(commit.codeWrites ?? undefined, writes) ?? null;
  let { turn, discoveries, suggestedLocation, codeMove, turnHours, clock } = commit;

  if (writes.location !== undefined) {
    codeMove = writes.location;
    turn = { ...turn, locationId: writes.location };
    suggestedLocation = null;
  }

  const minutes = codeWrites?.minutes;
  if (minutes !== undefined) {
    turnHours = minutes / 60;
    turn = { ...turn, timeDelta: turnHours };
    clock = { ...clock, deltaHours: turnHours, elapsedHours: (clock.elapsedHours ?? 0) - (clock.deltaHours ?? 0) + turnHours };
  }

  const newEntityId = context.newEntityId ?? randomUUID;
  const held = (name: string) => [...context.heldNames ?? [], ...context.knownDiscoveredNames].some((known) => sameCharacterName(known, name));
  let entities = turn.entities ?? [];
  for (const { name, description } of writes.discover ?? []) {
    if (held(name)) continue;
    if (!entities.some((known) => sameCharacterName(known, name))) entities = [...entities, name];
    if (description === undefined) continue;
    discoveries = [
      ...discoveries.filter((found) => !sameCharacterName(found.entity.name, name)),
      { entity: materializeDiscoveredEntity(name, description, newEntityId()), locationId: context.discoveryLocationId, sourceTurnId: turn.turnId ?? '' },
    ];
  }
  if (entities !== turn.entities) turn = { ...turn, entities };

  turn = withCodeLines(turn, writes, context.diaryNames);
  return { ...commit, turn, discoveries, suggestedLocation, codeMove, turnHours, clock, codeWrites };
}

/**
 * `turn` with the memory and diary lines of `writes` after the ones it holds, diary lines keyed by the entity
 * names `diaryNames` gives. The same turn when `writes` adds no line.
 */
export function withCodeLines(
  turn: AITurnResult, writes: WorldWrites | undefined, diaryNames?: Readonly<Record<string, string>>,
): AITurnResult {
  // Memory and diary lines go in their own fields, so the digest and diary passes still run for the turn (Q37).
  let out = turn;
  if (writes?.memory?.length) out = { ...out, codeMemory: [...turn.codeMemory ?? [], ...writes.memory] };
  if (writes?.diary?.length) {
    const codeDiaries: Record<string, string[]> = { ...turn.codeDiaries };
    for (const { entity, line } of writes.diary) {
      const name = diaryNames?.[entity] ?? entity;
      codeDiaries[name] = [...codeDiaries[name] ?? [], line];
    }
    out = { ...out, codeDiaries };
  }
  return out;
}
