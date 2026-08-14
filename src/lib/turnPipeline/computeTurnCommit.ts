import type { AITurnResult, Entity } from '@/types';
import type { StatClock } from '@/lib/statCodeExecutor';
import type { WorldCalendar } from '@/lib/gameClock';
import { FLAT_HOURS_PER_TURN } from '@/lib/gameClock';
import { materializeDiscoveredEntity } from '@/lib/runtimeCharacters';
import { sameCharacterName } from '@/lib/entityMatch';
import { randomUUID } from '@/lib/uuid';
import type { parseStatUpdates } from '@/lib/statChanges';
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
  /** Story hours elapsed before this turn. */
  gameTime: number;
  /** The world's time frame as it stands; the opening turn replaces it with the hour it just measured. */
  calendar?: WorldCalendar;
  /** Ids for materialized entities — the one thing here that isn't a function of its inputs, so it enters
   *  as one. Defaults to a fresh UUID. */
  newEntityId?: () => string;
}

export interface TurnCommitInput {
  result: TurnResult;
  plan: TurnPlan;
  context: TurnCommitContext;
}

/** One turn's complete state delta. */
export interface TurnCommit {
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
}

/** Every outcome one pass produced, in dispatch order. A failed request is left out — it answered nothing. */
const answers = (passes: TurnPassOutcome[], id: TurnPassId): TurnPassOutcome[] =>
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
  const statChanges = Object.entries(stats?.values ?? {}).map(([name, delta]) => ({ [name]: delta }));
  const statMaxChanges = stats?.maxes ?? {};

  // The measured duration, or the flat hour the game has always charged. An unreadable, out-of-range or
  // absent reply resolves to the flat hour rather than to zero, so a bad answer cannot freeze the clock.
  const measuredHours = answerOf<number | null>(passes, 'timePassed');
  const turnHours = measuredHours ?? FLAT_HOURS_PER_TURN;

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

  const turn: AITurnResult = {
    narration,
    choices,
    stat_changes: statChanges,
    turnId: material.turnId,
    entities: context.participants,
    ...(context.locationId !== undefined ? { locationId: context.locationId } : {}),
    ...(context.notes ? { notes: context.notes } : {}),
    ...(context.reasoning.text ? { reasoning: context.reasoning } : {}),
    ...(summary ? { summary } : {}),
    ...(measuredHours !== null ? { timeDelta: turnHours } : {}),
    ...(Object.keys(diaries).length ? { diaries } : {}),
  };

  return {
    turn,
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
  };
}
