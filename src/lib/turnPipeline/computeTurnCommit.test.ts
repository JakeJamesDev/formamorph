import { describe, it, expect, beforeEach } from 'vitest';
import { planTurn } from './planTurn';
import { commitEntityMoves, computeTurnCommit, withCodeLines, withCodeWrites } from './computeTurnCommit';
import {
  entityMoveSubjects, followersOf, moveWithPlayer, runtimePositions, withRuntimePositions, type FollowerState,
} from '@/lib/entityFollowing';
import { castRoutines } from '@/lib/entityKind';
import { placeAll, positionWorld, withPlayerAt } from '@/lib/positionPlay';
import { dueDiscoveries } from '@/lib/backgroundPassQueue/backgroundPassQueue';
import { pruneDiscoveredToHistory } from '@/lib/runtimeCharacters';
import { TURN_PASSES } from './turnPasses';
import { testInput } from './turnTestInputs';
import type { TurnMaterial, TurnPassId, TurnPassSubject, TurnPlanInput, TurnSettings } from './turnPlan';
import type { TurnPassOutcome, TurnResult, TurnRun } from './turnRunner';
import { CLOCK_TEXT_FORMAT, FLAT_HOURS_PER_TURN, storyMinute, type WorldCalendar } from '@/lib/gameClock';
import { SchemaRefused, withTextFallback } from '@/lib/aiRequest/responseSchema';
import type { TurnCommitContext } from './computeTurnCommit';
import type { WorldWrites } from '@/lib/statCodeExecutor';
import { parseTurnContent, serializeTurnContent } from '@/lib/turnDigest';
import type { Entity, EntityStart, GameLocation, TurnToolCall } from '@/types';

/**
 * The commit computation as a pure function: outcomes in, one state delta out. Outcomes are parsed by the
 * real pass records, so a test feeds the model's raw text and the commit reads it exactly as a live turn
 * would.
 */

const NARRATION = 'The gulls scatter as you step onto the boards.';

const material = (over: Partial<TurnMaterial> = {}): TurnMaterial => ({
  action: 'I read the notices.',
  effectiveAction: 'I read the notices.',
  turnId: 'turn-1',
  ctx: { '<WORLD DESCRIPTION>': 'Sedge Landing' },
  baseCtx: { '<WORLD DESCRIPTION>': 'Sedge Landing' },
  sceneEntityTokens: {},
  destinations: ['The Long Pier'],
  narrationSystemPrompt: 'NARRATION SYSTEM',
  narrationSystemPromptRuns: [],
  historyRuns: [],
  trimmedHistory: [],
  narration: NARRATION,
  lastStory: 'Previously…',
  plannerRecap: '',
  turnPlan: '',
  activeCharacterGuidance: 'up to 3',
  directorScene: '',
  npcCastSize: 0,
  intents: [],
  overflow: [],
  sceneCast: [],
  ...over,
});

/** One answered request, read through the pass that asked for it — never through a copy of its parser. */
const answered = (
  id: TurnPassId,
  raw: string,
  input: TurnPlanInput,
  mat: TurnMaterial,
  subject?: TurnPassSubject,
  subjects?: TurnPassSubject[],
): TurnPassOutcome => {
  const pass = TURN_PASSES.find((p) => p.id === id);
  if (!pass) throw new Error(`no such pass: ${id}`);
  const scoped = scope(mat, id, subject, subjects);
  return {
    id,
    ...(subject ? { subject } : {}),
    request: pass.buildRequest(input, scoped),
    raw,
    parsed: pass.parseResponse(raw, scoped),
  };
};

/** A request that came back empty-handed — what a batched failure leaves behind. */
const failed = (
  id: TurnPassId, input: TurnPlanInput, mat: TurnMaterial, subject?: TurnPassSubject, subjects?: TurnPassSubject[],
): TurnPassOutcome => {
  const pass = TURN_PASSES.find((p) => p.id === id);
  if (!pass) throw new Error(`no such pass: ${id}`);
  return {
    id,
    ...(subject ? { subject } : {}),
    request: pass.buildRequest(input, scope(mat, id, subject, subjects)),
    raw: '',
    parsed: null,
    error: new Error('network'),
  };
};

interface Answer {
  id: TurnPassId;
  raw?: string;
  subject?: TurnPassSubject;
  /** Who a pass that asks about several subjects at once covers. */
  subjects?: TurnPassSubject[];
  failed?: boolean;
}

/** The material a pass builds and parses against: its one subject, or its list of them. */
const scope = (mat: TurnMaterial, id: TurnPassId, subject?: TurnPassSubject, subjects?: TurnPassSubject[]): TurnMaterial => ({
  ...mat, ...(subject ? { subject } : {}), ...(subjects ? { subjects: { ...mat.subjects, [id]: subjects } } : {}),
});

const runOf = (answers: Answer[], over: Partial<TurnMaterial> = {}, settings: Partial<TurnSettings> = {}, inputOver: Partial<TurnPlanInput> = {}) => {
  const input = testInput(inputOver, settings);
  const mat = material(over);
  const run: TurnRun = {
    material: mat,
    passes: answers.map((a) =>
      a.failed
        ? failed(a.id, input, mat, a.subject, a.subjects)
        : answered(a.id, a.raw ?? '', input, mat, a.subject, a.subjects),
    ),
  };
  return { plan: planTurn(input), run, result: { status: 'ok', run } as TurnResult };
};

let nextId = 0;
beforeEach(() => {
  nextId = 0;
});
const context = (over: Partial<TurnCommitContext> = {}): TurnCommitContext => ({
  participants: ['Maela'],
  locationId: 'loc-pier',
  discoveryLocationId: 'loc-pier',
  knownDiscoveredNames: [],
  notes: '',
  reasoning: { text: '', ms: 0 },
  gameTime: 10,
  newEntityId: () => `entity-${(nextId += 1)}`,
  ...over,
});

describe('computeTurnCommit — the stored turn', () => {
  it('carries the narration, choices, stat deltas and this turn\'s identity', () => {
    const { plan, result } = runOf([
      { id: 'narration', raw: NARRATION },
      { id: 'choices', raw: 'Wave at Maela\nWalk on' },
      { id: 'statUpdates', raw: 'Stamina: -5' },
    ]);
    const commit = computeTurnCommit({ result, plan, context: context({ participants: ['Maela', 'Bram'] }) });
    expect(commit).not.toBeNull();
    expect(commit?.turn).toMatchObject({
      narration: NARRATION,
      choices: ['Wave at Maela', 'Walk on'],
      stat_changes: [{ stamina: -5 }],
      turnId: 'turn-1',
      entities: ['Maela', 'Bram'],
      locationId: 'loc-pier',
    });
  });

  it('omits every optional field that this turn did not produce', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }]);
    const turn = computeTurnCommit({ result, plan, context: context() })?.turn;
    expect(turn && Object.keys(turn)).toEqual(['narration', 'choices', 'stat_changes', 'turnId', 'entities', 'locationId']);
  });

  it('stores no location for a world that has none', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }]);
    const turn = computeTurnCommit({ result, plan, context: context({ locationId: undefined }) })?.turn;
    expect(turn && 'locationId' in turn).toBe(false);
  });

  it('freezes this turn\'s notes and reasoning when there are any', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }]);
    const turn = computeTurnCommit({
      result,
      plan,
      context: context({ notes: 'Ask about the ferry.', reasoning: { text: 'weighing it', ms: 900 } }),
    })?.turn;
    expect(turn?.notes).toBe('Ask about the ferry.');
    expect(turn?.reasoning).toEqual({ text: 'weighing it', ms: 900 });
  });

  it('stores the planner\'s player-in-frame call, and nothing when no planner judged it', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }]);
    const commitWith = (playerInFrame: boolean | undefined) =>
      computeTurnCommit({ result, plan, context: context({ playerInFrame }) })?.turn;
    expect(commitWith(false)?.playerInFrame).toBe(false);
    expect(commitWith(true)?.playerInFrame).toBe(true);
    expect(commitWith(undefined)).not.toHaveProperty('playerInFrame');
  });

  it('stores the digest and the diaries the batch produced', () => {
    const { plan, result } = runOf([
      { id: 'narration', raw: NARRATION },
      { id: 'summary', raw: '  The player reached the pier.  ' },
      { id: 'diary', raw: 'I watched him arrive.', subject: { name: 'Maela' } },
      { id: 'diary', raw: '', subject: { name: 'Bram' } },
    ]);
    const turn = computeTurnCommit({ result, plan, context: context() })?.turn;
    expect(turn?.summary).toBe('The player reached the pier.');
    // An empty reply is stored so the participant isn't retried forever; a failed one is left to the drainer.
    expect(turn?.diaries).toEqual({ Maela: 'I watched him arrive.', Bram: '' });
  });

  it('leaves a failed diary out, so the idle drainer still owes it', () => {
    const { plan, result } = runOf([
      { id: 'narration', raw: NARRATION },
      { id: 'diary', raw: 'I watched him arrive.', subject: { name: 'Maela' } },
      { id: 'diary', subject: { name: 'Bram' }, failed: true },
    ]);
    const turn = computeTurnCommit({ result, plan, context: context() })?.turn;
    expect(turn?.diaries).toEqual({ Maela: 'I watched him arrive.' });
  });

  it('omits an empty digest rather than storing one', () => {
    const { plan, result } = runOf([
      { id: 'narration', raw: NARRATION },
      { id: 'summary', raw: '   ' },
    ]);
    const turn = computeTurnCommit({ result, plan, context: context() })?.turn;
    expect(turn && 'summary' in turn).toBe(false);
  });

  it('stores the turn\'s World Tool calls, and a save reads them back', () => {
    const toolCalls: TurnToolCall[] = [
      { toolId: 'tool-heal', args: { amount: 7 }, timing: 'after' },
      { toolId: 'tool-roll', args: {}, timing: 'call', writes: { stats: [{ owner: null, writes: [{ id: 'h', value: 15 }] }] } },
    ];
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }]);
    const turn = computeTurnCommit({ result, plan, context: context({ toolCalls }) })?.turn;
    expect(turn && parseTurnContent(serializeTurnContent(turn))?.toolCalls).toEqual(toolCalls);
  });

  it('carries the Inventory pass operations, and the stored turn keeps them for a re-roll', () => {
    const raw = 'transfer | Iron Sword | 1 | you | Maela';
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }, { id: 'inventory', raw }], {}, { inventoryDue: true });
    const commit = computeTurnCommit({ result, plan, context: context() });
    const ops = [{ op: 'transfer', item: 'Iron Sword', quantity: 1, owner: 'you', to: 'Maela' }];
    expect(commit?.inventoryOps).toEqual(ops);
    expect(commit && parseTurnContent(serializeTurnContent(commit.turn))?.inventoryOps).toEqual(ops);
  });

  it('stores no inventory operations when the pass changed nothing or failed', () => {
    for (const answer of [{ id: 'inventory', raw: 'NONE' }, { id: 'inventory', failed: true }] as Answer[]) {
      const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }, answer], {}, { inventoryDue: true });
      const commit = computeTurnCommit({ result, plan, context: context() });
      expect(commit?.inventoryOps).toEqual([]);
      expect(commit?.turn).not.toHaveProperty('inventoryOps');
    }
  });

  it('stores no Tool calls when the AI made none, and a turn saved without them loads unchanged', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }]);
    expect(computeTurnCommit({ result, plan, context: context({ toolCalls: [] }) })?.turn).not.toHaveProperty('toolCalls');
    const saved = '{"narration":"Hi.","choices":[],"stat_changes":[]}';
    expect(parseTurnContent(saved)).toEqual({ narration: 'Hi.', choices: [], stat_changes: [] });
  });
});

describe('computeTurnCommit — anchored clock replies', () => {
  /** The hours a clock reply costs when the turn starts at `hour` of day 2. */
  const hoursFrom = (raw: string, hour: number, calendar: WorldCalendar = { startHour: 0 }) => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }, { id: 'timePassed', raw }]);
    const day = calendar.hoursPerDay ?? 24;
    return computeTurnCommit({ result, plan, context: context({ gameTime: day + hour, calendar }) })?.turnHours;
  };
  const ANCHOR_AT = { dawn: 6, morning: 8, noon: 12, afternoon: 13, evening: 17, nightfall: 20, midnight: 24 };

  it('lands a sleep until dawn at dawn, whenever it began', () => {
    expect(hoursFrom('until dawn', 21)).toBe(9);
    expect(hoursFrom('until dawn', 2)).toBe(4);
    expect(hoursFrom('Until the dawn.', 21)).toBe(9);
  });

  it('runs every anchor forward to its next occurrence', () => {
    for (const [anchor, at] of Object.entries(ANCHOR_AT)) {
      expect([anchor, hoursFrom(`until ${anchor}`, 5)]).toEqual([anchor, at - 5]);
      expect([anchor, hoursFrom(`until ${anchor}`, (at + 1) % 24)]).toEqual([anchor, 23]);
    }
  });

  it('costs a full day for an anchor the clock already stands on', () => {
    expect(hoursFrom('until noon', 12)).toBe(24);
    expect(hoursFrom('until midnight', 0)).toBe(24);
  });

  it('carries the whole days beyond the first', () => {
    expect(hoursFrom('4d until morning', 21)).toBe(11 + 72); // a four-day journey reaching a morning
    expect(hoursFrom('1d until morning', 21)).toBe(11); // the next morning
    expect(hoursFrom('2w until dawn', 21)).toBe(9 + 13 * 24);
    expect(hoursFrom('50h until dawn', 21)).toBe(9 + 24);
  });

  it('trusts a sub-day count over an anchor more than 20 hours ahead', () => {
    expect(hoursFrom('0m until morning', 8.5)).toBe(0); // "Morning." said in the morning
    expect(hoursFrom('20m until nightfall', 21)).toBeCloseTo(1 / 3);
  });

  it('keeps the anchor when the guard does not apply', () => {
    expect(hoursFrom('until morning', 9)).toBe(23); // no count to trust
    expect(hoursFrom('30m until dawn', 10)).toBe(20); // exactly 20 hours ahead
    expect(hoursFrom('1d until morning', 9)).toBe(23); // a count of a day
  });

  it('charges a count with no anchor as stated', () => {
    expect(hoursFrom('3 days', 21)).toBe(72);
    expect(hoursFrom('45m', 21)).toBe(0.75);
    expect(hoursFrom('0', 21)).toBe(0);
  });

  it('charges the flat hour for an anchor it cannot read', () => {
    expect(hoursFrom('until teatime', 21)).toBe(FLAT_HOURS_PER_TURN);
  });

  it('divides a custom-length day by the same fractions', () => {
    const short = { startHour: 0, hoursPerDay: 12 };
    expect(hoursFrom('until dawn', 10, short)).toBe(5); // dawn falls at 3 of 12
    expect(hoursFrom('until noon', 1, short)).toBe(5);
    expect(hoursFrom('2d until dawn', 10, short)).toBe(5 + 12); // a day is 12 hours
    expect(hoursFrom('1h until dawn', 3.5, short)).toBe(1); // 11.5 of 12 hours ahead
    expect(hoursFrom('12h until dawn', 3.5, short)).toBe(11.5); // a count of one short day
  });

  it('measures the opening turn from the opening hour it seeds', () => {
    const { plan, result } = runOf(
      [{ id: 'narration', raw: NARRATION }, { id: 'openingTime', raw: 'evening' }, { id: 'timePassed', raw: 'until dawn' }],
      {},
      {},
      { isGameStarted: false },
    );
    const commit = computeTurnCommit({ result, plan, context: context({ gameTime: 0, calendar: { startHour: 8 } }) });
    expect(commit?.turnHours).toBe(11); // evening seeds 19:00
    expect(commit?.turn.timeDelta).toBe(11);
  });
});

describe('computeTurnCommit — schema clock replies', () => {
  const hoursFrom = (raw: string, hour: number, calendar: WorldCalendar = { startHour: 0 }) => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }, { id: 'timePassed', raw }]);
    return computeTurnCommit({ result, plan, context: context({ gameTime: (calendar.hoursPerDay ?? 24) + hour, calendar }) })?.turnHours;
  };
  const json = (lastsUntil: string, unit: string, count: number) => JSON.stringify({ lasts_until: lastsUntil, unit, count });

  it.each([
    ['an anchor', json('dawn', 'hours', 8), '8h until dawn', 21, 9],
    ['an anchor after midnight', json('dawn', 'hours', 3), '3h until dawn', 2, 4],
    ['a day carry', json('morning', 'days', 4), '4d until morning', 21, 11 + 72],
    ['the next morning', json('morning', 'days', 1), '1d until morning', 21, 11],
    ['a count with none', json('none', 'minutes', 45), '45m', 21, 0.75],
    ['a stated length', json('none', 'weeks', 3), '3w', 21, 504],
    ['the guard on a count of 0', json('morning', 'minutes', 0), '0m until morning', 8.5, 0],
    ['the guard on a sub-day count', json('nightfall', 'minutes', 20), '20m until nightfall', 21, 1 / 3],
  ])('resolves %s like its text twin', (_label, schemaReply, textReply, hour, hours) => {
    expect(hoursFrom(schemaReply, hour)).toBeCloseTo(hours);
    expect(hoursFrom(textReply, hour)).toBeCloseTo(hours);
  });

  it('reads a fenced schema reply', () => {
    expect(hoursFrom('```json\n{"lasts_until": "dawn", "unit": "hours", "count": 7}\n```', 21)).toBe(9);
  });

  it('divides a custom-length day by the same fractions', () => {
    expect(hoursFrom(json('dawn', 'hours', 4), 10, { startHour: 0, hoursPerDay: 12 })).toBe(5);
  });

  it('keeps the anchor when only the count is unreadable', () => {
    expect(hoursFrom('{"lasts_until": "dawn", "unit": "fortnights", "count": 2}', 21)).toBe(9);
  });

  it('charges the flat hour for a reply with neither an anchor nor a count', () => {
    expect(hoursFrom('{"lasts_until": "teatime", "unit": "hours", "count": -1}', 21)).toBe(FLAT_HOURS_PER_TURN);
    expect(hoursFrom('{}', 21)).toBe(FLAT_HOURS_PER_TURN);
    expect(hoursFrom('{"lasts_until": "none", "unit": "hours", "count": 1.5}', 21)).toBe(FLAT_HOURS_PER_TURN);
  });

  it('never reads a schema reply as text', () => {
    expect(hoursFrom('{"lasts": "until dawn", "took": "3h"}', 21)).toBe(FLAT_HOURS_PER_TURN);
  });

  it('moves the clock by the text answer when the endpoint refuses the schema', async () => {
    const clock = TURN_PASSES.find((p) => p.id === 'timePassed')!;
    const request = clock.buildRequest(testInput({}, { aiClock: true }), material());
    const sent: { schema: boolean; format: string }[] = [];
    const raw = await withTextFallback(request, async (args) => {
      sent.push({ schema: Boolean(args.responseSchema), format: args.messages[0].content.endsWith(CLOCK_TEXT_FORMAT) ? 'text' : 'schema' });
      if (args.responseSchema) throw new SchemaRefused({ url: 'http://endpoint', model: 'm' }, new Error('400'));
      return 'until dawn';
    }, () => {});
    expect(sent).toEqual([{ schema: true, format: 'schema' }, { schema: false, format: 'text' }]);
    expect(hoursFrom(raw, 21)).toBe(9);
  });
});

describe('computeTurnCommit — the clock', () => {
  it('charges the measured duration and stores it', () => {
    const { plan, result } = runOf([
      { id: 'narration', raw: NARRATION },
      { id: 'timePassed', raw: '30m' },
    ]);
    const commit = computeTurnCommit({ result, plan, context: context({ gameTime: 10 }) });
    expect(commit?.turnHours).toBe(0.5);
    expect(commit?.turn.timeDelta).toBe(0.5);
    expect(commit?.clock).toEqual({ deltaHours: 0.5, elapsedHours: 10.5, calendar: undefined });
  });

  it('falls back to the flat hour when the pass answers with nothing readable, and stores no delta', () => {
    const { plan, result } = runOf([
      { id: 'narration', raw: NARRATION },
      { id: 'timePassed', raw: 'no idea' },
    ]);
    const commit = computeTurnCommit({ result, plan, context: context({ gameTime: 10 }) });
    expect(commit?.turnHours).toBe(FLAT_HOURS_PER_TURN);
    expect(commit?.turn && 'timeDelta' in commit.turn).toBe(false);
    expect(commit?.clock.elapsedHours).toBe(11);
  });

  it('charges the flat hour when the clock pass never ran', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }], {}, { aiClock: false });
    const commit = computeTurnCommit({ result, plan, context: context({ gameTime: 4 }) });
    expect(commit?.turnHours).toBe(FLAT_HOURS_PER_TURN);
    expect(commit?.clock.elapsedHours).toBe(5);
  });

  it('charges the player\'s Time Per Turn when the clock pass never ran, and stores it on the turn', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }], {}, { aiClock: false });
    const commit = computeTurnCommit({ result, plan, context: context({ gameTime: 4, fixedTurnHours: 0.25 }) });
    expect(commit?.turnHours).toBe(0.25);
    expect(commit?.turn.timeDelta).toBe(0.25);
    expect(commit?.clock.elapsedHours).toBe(4.25);
  });

  it('holds the clock still on a Time Per Turn of zero', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }], {}, { aiClock: false });
    const commit = computeTurnCommit({ result, plan, context: context({ gameTime: 4, fixedTurnHours: 0 }) });
    expect(commit?.turnHours).toBe(0);
    expect(commit?.turn.timeDelta).toBe(0);
    expect(commit?.clock.elapsedHours).toBe(4);
  });

  it('never runs the clock backward on a negative Time Per Turn', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }], {}, { aiClock: false });
    const commit = computeTurnCommit({ result, plan, context: context({ gameTime: 4, fixedTurnHours: -2 }) });
    expect(commit?.turnHours).toBe(0);
    expect(commit?.clock.elapsedHours).toBe(4);
  });

  it('keeps the flat hour for an unreadable reply while Measured Clock is on, whatever the Time Per Turn', () => {
    const { plan, result } = runOf([
      { id: 'narration', raw: NARRATION },
      { id: 'timePassed', raw: 'no idea' },
    ]);
    const commit = computeTurnCommit({ result, plan, context: context({ gameTime: 10, fixedTurnHours: 0 }) });
    expect(commit?.turnHours).toBe(FLAT_HOURS_PER_TURN);
  });

  it('builds the opening turn\'s clock from the hour it just measured, not the world default', () => {
    const { plan, result } = runOf(
      [
        { id: 'narration', raw: NARRATION },
        { id: 'openingTime', raw: 'evening' },
      ],
      {},
      {},
      { isGameStarted: false },
    );
    const commit = computeTurnCommit({
      result,
      plan,
      context: context({ gameTime: 0, calendar: { startHour: 8 } }),
    });
    expect(commit?.isOpeningTurn).toBe(true);
    expect(commit?.openingHour).toBe(19);
    expect(commit?.clock.calendar).toEqual({ startHour: 19 });
  });

  it('keeps the world calendar when the opening pass answers with nothing readable', () => {
    const { plan, result } = runOf(
      [
        { id: 'narration', raw: NARRATION },
        { id: 'openingTime', raw: 'somewhen' },
      ],
      {},
      {},
      { isGameStarted: false },
    );
    const commit = computeTurnCommit({ result, plan, context: context({ calendar: { startHour: 8 } }) });
    expect(commit?.openingHour).toBeNull();
    expect(commit?.clock.calendar).toEqual({ startHour: 8 });
  });

  it('never reads an opening hour on a turn that is not the opening one', () => {
    const { plan, result } = runOf([
      { id: 'narration', raw: NARRATION },
      { id: 'openingTime', raw: 'evening' },
    ]);
    const commit = computeTurnCommit({ result, plan, context: context({ calendar: { startHour: 8 } }) });
    expect(commit?.isOpeningTurn).toBe(false);
    expect(commit?.openingHour).toBeNull();
    expect(commit?.clock.calendar).toEqual({ startHour: 8 });
  });
});

describe('computeTurnCommit — stats and the move', () => {
  it('splits value deltas from cap deltas', () => {
    const { plan, result } = runOf([
      { id: 'narration', raw: NARRATION },
      { id: 'statUpdates', raw: 'Stamina: -5\nResolve: +2\nStamina: max +10' },
    ]);
    const commit = computeTurnCommit({ result, plan, context: context() });
    expect(commit?.statChanges).toEqual([{ stamina: -5 }, { resolve: 2 }]);
    expect(commit?.statMaxChanges).toEqual({ stamina: 10 });
  });

  it('reports no stat movement when the pass never ran', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }], {}, { statUpdatesEnabled: false });
    const commit = computeTurnCommit({ result, plan, context: context() });
    expect(commit?.statChanges).toEqual([]);
    expect(commit?.statMaxChanges).toEqual({});
    expect(commit?.turn.stat_changes).toEqual([]);
  });

  it('offers the destination the suggest pass matched', () => {
    const { plan, result } = runOf(
      [
        { id: 'narration', raw: NARRATION },
        { id: 'locationSuggest', raw: 'The Long Pier' },
      ],
      {},
      { locationAutoApply: false },
    );
    expect(computeTurnCommit({ result, plan, context: context() })?.suggestedLocation).toBe('The Long Pier');
  });

  it('offers nothing when the reply names where the player already stands', () => {
    const { plan, result } = runOf(
      [
        { id: 'narration', raw: NARRATION },
        { id: 'locationSuggest', raw: 'The Long Pier' },
      ],
      {},
      { locationAutoApply: false },
    );
    const commit = computeTurnCommit({ result, plan, context: context({ currentLocationName: 'The Long Pier' }) });
    expect(commit?.suggestedLocation).toBeNull();
  });

  it('offers nothing when the suggest reply names no known destination', () => {
    const { plan, result } = runOf(
      [
        { id: 'narration', raw: NARRATION },
        { id: 'locationSuggest', raw: 'the moon' },
      ],
      {},
      { locationAutoApply: false },
    );
    expect(computeTurnCommit({ result, plan, context: context() })?.suggestedLocation).toBeNull();
  });
});

describe('computeTurnCommit — entity movement', () => {
  const who = (id: string, moves: TurnPassSubject['moves']): TurnPassSubject => ({ name: id, entity: { id, name: id } as Entity, moves, moveClock: storyMinute(4) });
  const NEW = ['stay', 'comeAlong'] as const;
  const FOLLOWING = ['keepFollowing', 'waitHour', 'waitThisDaypart', 'waitNextDaypart', 'partWays'] as const;
  // The wait to the end of this daypart, as offered at noon.
  const WAIT = 'Wait here until 13:00, when afternoon begins';
  /** The text reply for these subjects: one row each, a null line left out. */
  const rows = (replies: [TurnPassSubject, string | null][]) =>
    replies.flatMap(([subject, line]) => (line === null ? [] : [`${subject.name}: ${line}`])).join('\n');
  /** The commit an auto-mode turn produces whose one entity request asked about `subjects` and read `raw`. */
  const autoReply = (subjects: TurnPassSubject[], raw: string | null) => {
    const { plan, result } = runOf([
      { id: 'narration', raw: NARRATION },
      ...(subjects.length ? [raw === null
        ? { id: 'entityLocationAuto' as const, subjects, failed: true }
        : { id: 'entityLocationAuto' as const, raw, subjects }] : []),
    ]);
    return computeTurnCommit({ result, plan, context: context() })!;
  };
  /** The commit an auto-mode turn with these entity replies produces, in the text form. */
  const autoCommit = (replies: [TurnPassSubject, string | null][]) => autoReply(replies.map(([subject]) => subject), rows(replies));

  const NOON = storyMinute(4);
  // Every place sits in one town, so travel joins them all.
  const PLACES = [{ id: 'town', name: 'town' }, ...['inn', 'square', 'keep', 'chapel', 'tower', 'pier', 'wall', 'barrow', 'gate']
    .map((id) => ({ id, name: id, parentId: 'town' }))];
  const at = (id: string, place: string, traversable: Entity['traversable'], schedule: EntityStart['schedule'] = []): Entity =>
    ({ id, name: id, kind: 'unique', locations: [place], starts: [{ id: 's', place, weight: 1, schedule }], traversable });
  // Blackwell is a shipped Moves Between: a Wander over the keep, the wall and the tower, and no Traversable.
  const route = (id: string): Entity => at(id, 'wall', [], [{
    id: 'w', time: 'allDay', action: { kind: 'wander', places: ['keep', 'wall', 'tower'].map((place) => ({ place, weight: 1 })), idle: 600 },
  }]);
  const stranger = { entity: { id: 'mira', name: 'Mira', aiDescription: 'A ferry hand.' }, locationId: 'inn', sourceTurnId: 't0' };
  const CAST = [
    at('wenna', 'inn', 'anywhere'), at('albus', 'inn', 'anywhere'), at('corvin', 'inn', 'anywhere'), at('sylvie', 'keep', 'anywhere'),
    route('blackwell'), route('hale'), { id: 'moths', name: 'moths', kind: 'generic', locations: ['inn', 'gate'], starts: [{ id: 's1', place: 'inn', weight: 1, schedule: [] }, { id: 's2', place: 'gate', weight: 1, schedule: [] }] } as Entity,
  ];
  const world = positionWorld(castRoutines(CAST, [stranger]), NOON, 'inn', PLACES, [], () => 0);
  /** Everyone at `positions` with their engine state, `followers` following. */
  const book = (positions: Record<string, string>, followers: string[] = []): FollowerState => ({
    positions,
    uniques: Object.fromEntries(Object.keys(positions).map((id) => [id, {
      startId: id === 'mira' ? 'discovered' : 's', lastRun: NOON,
      ...((id === 'blackwell' || id === 'hale') && { rowId: 'w', idleEnd: NOON + 600 }),
      ...(followers.includes(id) && { follow: { mode: 'following' as const } }),
    }])),
    generics: {},
  });
  /** The world with only the characters `state` holds, so the engine places no one else. */
  const holding = (state: FollowerState) => ({
    ...world,
    uniques: new Map([...world.uniques].filter(([id]) => id in state.uniques)),
    generics: new Map([...world.generics].filter(([id]) => id in state.generics)),
  });
  const move = (state: FollowerState, commit: ReturnType<typeof autoCommit>, from: string, to: string | undefined) =>
    commitEntityMoves(state, commit, { from, to }, holding(state));
  /** Wenna stands at the inn; Albus and Corvin follow the player there. */
  const atInn = book({ wenna: 'inn', albus: 'inn', corvin: 'inn' }, ['albus', 'corvin']);

  it('reads each row of the one reply under its entity, and keeps only the ones that change something', () => {
    const commit = autoCommit([
      [who('wenna', [...NEW]), 'Come along'],
      [who('sylvie', [...NEW]), 'Stay'],
      [who('albus', [...FOLLOWING]), WAIT],
      [who('corvin', [...FOLLOWING]), 'Keep following'],
      // Omitted from the reply: Mira stays where she is.
      [who('mira', [...NEW]), null],
    ]);
    expect(commit.entityMoves).toEqual({ wait: [{ id: 'albus', length: 'thisDaypart' }], partWays: [], comeAlong: ['wenna'], goTo: [] });
  });

  it('reads three subjects with mixed replies in the schema form, ignoring one it did not ask about', () => {
    const subjects = [who('wenna', [...NEW]), who('albus', [...FOLLOWING]), who('corvin', [...FOLLOWING])];
    const commit = autoReply(subjects, JSON.stringify({ wenna: 'Come along', albus: 'Part ways', corvin: WAIT, sylvie: 'Come along' }));
    expect(commit.entityMoves).toEqual({ wait: [{ id: 'corvin', length: 'thisDaypart' }], partWays: ['albus'], comeAlong: ['wenna'], goTo: [] });
  });

  it('moves nobody when the one request fails, or the reply names no subject', () => {
    const subjects = [who('wenna', [...NEW]), who('albus', [...FOLLOWING])];
    const none = { wait: [], partWays: [], comeAlong: [], goTo: [] };
    expect(autoReply(subjects, null).entityMoves).toEqual(none);
    expect(autoReply(subjects, 'sylvie: Come along').entityMoves).toEqual(none);
    expect(autoReply(subjects, 'Come along').entityMoves).toEqual(none);
  });

  it('joins in order: a wait starts where the player stood, followers go with the player, then come along joins', () => {
    const commit = autoCommit([[who('wenna', [...NEW]), 'Come along'], [who('albus', [...FOLLOWING]), WAIT]]);
    const { state, offer } = move(atInn, commit, 'inn', 'square');
    expect(state.positions).toEqual({ wenna: 'square', albus: 'inn', corvin: 'square' });
    expect(followersOf(state)).toEqual(['wenna', 'corvin']);
    expect(state.uniques.albus.follow).toMatchObject({ mode: 'waiting' });
    expect(offer.comeAlong).toEqual([]);
  });

  it('keeps a follower following on every later move until it waits', () => {
    const joined = move(atInn, autoCommit([[who('wenna', [...NEW]), 'Come along']]), 'inn', 'square').state;
    // Entity Movement off: no request, no reply, and the followers still come.
    const later = move(joined, autoCommit([]), 'square', 'keep').state;
    expect(later.positions).toMatchObject({ wenna: 'keep', albus: 'keep', corvin: 'keep' });
    expect(placeAll(later, withPlayerAt(holding(later), 'chapel')).positions).toMatchObject({ wenna: 'chapel', albus: 'chapel', corvin: 'chapel' });
  });

  it('drops come along when the player stays, and still applies the wait', () => {
    const commit = autoCommit([[who('wenna', [...NEW]), 'Come along'], [who('albus', [...FOLLOWING]), WAIT]]);
    const { state } = move(atInn, commit, 'inn', 'inn');
    expect(followersOf(state)).toEqual(['corvin']);
    expect(state.uniques.albus.follow).toMatchObject({ mode: 'waiting' });
    expect(state.positions).toEqual(atInn.positions);
  });

  describe('a follower told to wait or part ways', () => {
    const ENDS = [
      ['Wait here about an hour, until 13:00, afternoon', 'hour', NOON + 60],
      [WAIT, 'thisDaypart', NOON + 60],
      ['Wait here until 17:00, when evening begins', 'nextDaypart', NOON + 300],
    ] as const;
    // Wenna starts at the inn with an empty schedule, and follows the player at the chapel.
    const atChapel = book({ wenna: 'chapel' }, ['wenna']);
    const worldAt = (now: number, playerAt: string) => ({ ...holding(atChapel), scene: { ...world.scene, now, playerAt } });

    it('reads each reply in the schema form and in the text form', () => {
      const wenna = [who('wenna', [...FOLLOWING])];
      const forms = (line: string) => [`wenna: ${line}`, JSON.stringify({ wenna: line })];
      for (const [line, length] of ENDS) {
        for (const raw of forms(line)) expect(autoReply(wenna, raw).entityMoves.wait).toEqual([{ id: 'wenna', length }]);
      }
      for (const raw of forms('Part ways')) expect(autoReply(wenna, raw).entityMoves.partWays).toEqual(['wenna']);
      for (const raw of forms('Keep following')) {
        expect(autoReply(wenna, raw).entityMoves).toEqual({ wait: [], partWays: [], comeAlong: [], goTo: [] });
      }
    });

    it('waits where it stood until the wait ends, then goes back to its routine', () => {
      for (const [line, , until] of ENDS) {
        const left = move(atChapel, autoCommit([[who('wenna', [...FOLLOWING]), line]]), 'chapel', 'pier').state;
        expect(left.positions.wenna).toBe('chapel');
        expect(left.uniques.wenna.follow).toEqual({ mode: 'waiting', until });
        expect(placeAll(left, worldAt(until - 1, 'pier')).positions.wenna).toBe('chapel');
        const after = placeAll(left, worldAt(until, 'pier'));
        expect(after.positions.wenna).toBe('inn');
        expect(after.uniques.wenna.follow).toBeUndefined();
      }
    });

    it('goes back to its routine at once on Part ways', () => {
      const left = move(atChapel, autoCommit([[who('wenna', [...FOLLOWING]), 'Part ways']]), 'chapel', 'pier').state;
      expect(left.positions.wenna).toBe('inn');
      expect(followersOf(left)).toEqual([]);
    });

    it('crosses a Far link with the player (Q49)', () => {
      const far = { ...holding(atChapel), scene: { ...world.scene, connections: [{ id: 'road', a: 'chapel', b: 'pier', aToB: {}, bToA: {}, distance: 'far' as const }] } };
      const { state } = commitEntityMoves(atChapel, autoCommit([[who('wenna', [...FOLLOWING]), 'Keep following']]), { from: 'chapel', to: 'pier' }, far);
      expect(state.positions.wenna).toBe('pier');
      expect(followersOf(state)).toEqual(['wenna']);
    });
  });

  describe('a character on a Wander row', () => {
    const blackwell: TurnPassSubject = {
      name: 'Blackwell',
      entity: route('blackwell'),
      moves: [...NEW], moveClock: NOON,
      destinations: [{ id: 'keep', name: 'The Keep' }, { id: 'tower', name: 'The Tower' }] as GameLocation[],
    };
    const atWall = book({ blackwell: 'wall', albus: 'wall' }, ['albus']);

    it('reads a place name as a move there', () => {
      expect(autoCommit([[blackwell, 'The Tower']]).entityMoves.goTo).toEqual([{ id: 'blackwell', to: 'tower' }]);
    });

    it('goes to a place of its row at once, whether or not the player moves', () => {
      const commit = autoCommit([[blackwell, 'The Tower']]);
      expect(move(atWall, commit, 'wall', 'wall').state.positions.blackwell).toBe('tower');
      expect(move(atWall, commit, 'wall', 'keep').state.positions).toEqual({ blackwell: 'tower', albus: 'keep' });
    });

    it('comes along into a place its routine allows, and waits where it stood at one it does not', () => {
      const commit = autoCommit([[blackwell, 'Come along']]);
      const went = move(atWall, commit, 'wall', 'keep').state;
      expect(went.positions).toEqual({ blackwell: 'keep', albus: 'keep' });
      expect(followersOf(went)).toEqual(['blackwell', 'albus']);
      const blocked = move(went, autoCommit([]), 'keep', 'barrow').state;
      expect(blocked.positions).toEqual({ blackwell: 'keep', albus: 'barrow' });
      expect(blocked.uniques.blackwell.follow).toMatchObject({ mode: 'waiting' });
    });

    it('in suggest mode, goes to a place at once and holds come along for Go', () => {
      const { plan, result } = runOf(
        [
          { id: 'narration', raw: NARRATION },
          { id: 'locationSuggest', raw: 'The Long Pier' },
          // Two subjects that share a name: the second is numbered in the request and read back by that key.
          { id: 'entityLocationSuggest', raw: 'Blackwell: The Tower\nBlackwell (2): Come along', subjects: [blackwell, { ...blackwell, entity: route('hale') }] },
        ],
        {},
        { locationAutoApply: false },
      );
      const commit = computeTurnCommit({ result, plan, context: context() })!;
      const start = book({ blackwell: 'wall', hale: 'wall' });
      const offered = move(start, commit, 'wall', 'wall');
      expect(offered.state.positions).toEqual({ blackwell: 'tower', hale: 'wall' });
      expect(offered.offer.comeAlong).toEqual(['hale']);
      expect(moveWithPlayer(offered.state, offered.offer, 'keep', holding(start)).positions).toEqual({ blackwell: 'tower', hale: 'keep' });
      expect(moveWithPlayer(offered.state, offered.offer, 'pier', holding(start)).positions).toEqual({ blackwell: 'tower', hale: 'wall' });
      // A code write on the waiting entity takes it off the offer.
      const coded = withCodeWrites(commit, { entities: [{ entity: 'hale', kind: 'move', location: 'gate' }] }, context());
      const written = move(start, coded, 'wall', 'wall');
      expect(written.offer.comeAlong).toEqual([]);
      expect(written.state.positions).toEqual({ blackwell: 'tower', hale: 'gate' });
    });
  });

  describe('in suggest mode', () => {
    const suggestCommit = (location: string, replies: [TurnPassSubject, string][]) => {
      const { plan, result } = runOf(
        [
          { id: 'narration', raw: NARRATION },
          { id: 'locationSuggest', raw: location },
          { id: 'entityLocationSuggest', raw: rows(replies), subjects: replies.map(([subject]) => subject) },
        ],
        {},
        { locationAutoApply: false },
      );
      return computeTurnCommit({ result, plan, context: context() })!;
    };
    const commit = suggestCommit('The Long Pier', [[who('wenna', [...NEW]), 'Come along'], [who('albus', [...FOLLOWING]), WAIT]]);
    const offered = move(atInn, commit, 'inn', 'inn');

    it('applies the wait at once and holds come along with the offer', () => {
      expect(followersOf(offered.state)).toEqual(['corvin']);
      expect(offered.state.positions).toEqual(atInn.positions);
      expect(offered.offer.comeAlong).toEqual(['wenna']);
    });

    it('brings the waiting entity along on Go', () => {
      const went = moveWithPlayer(offered.state, offered.offer, 'pier', holding(atInn));
      expect(followersOf(went)).toEqual(['wenna', 'corvin']);
      expect(went.positions).toEqual({ wenna: 'pier', albus: 'inn', corvin: 'pier' });
    });

    it('leaves everyone in place on Dismiss', () => {
      // Dismiss drops the offer: nothing beyond the at-once replies ever applies.
      expect(offered.state.positions.wenna).toBe('inn');
      expect(followersOf(offered.state)).not.toContain('wenna');
    });

    it('lets a code move of the player beat the offer and carry come along with it', () => {
      const { state, offer } = move(atInn, commit, 'inn', 'keep');
      expect(offer.comeAlong).toEqual([]);
      expect(followersOf(state)).toEqual(['wenna', 'corvin']);
      expect(state.positions).toEqual({ wenna: 'keep', albus: 'inn', corvin: 'keep' });
    });

    it('applies nothing to wait on when no move is offered', () => {
      const stayCommit = suggestCommit('NONE', [[who('wenna', [...NEW]), 'Come along']]);
      const { state, offer } = move(atInn, stayCommit, 'inn', 'inn');
      expect(offer.comeAlong).toEqual([]);
      expect(state).toEqual(atInn);
    });

    it('drops an entity the code wrote from the offer, and applies the write at once', () => {
      const coded = withCodeWrites(commit, { entities: [{ entity: 'wenna', kind: 'unfollow' }] }, context());
      const { state, offer } = move(atInn, coded, 'inn', 'inn');
      expect(offer.comeAlong).toEqual([]);
      expect(state.positions.wenna).toBe('inn');
      const withSylvie = book({ ...atInn.positions, sylvie: 'keep' }, ['albus', 'corvin']);
      const follows = move(withSylvie, withCodeWrites(commit, { entities: [{ entity: 'sylvie', kind: 'follow' }] }, context()), 'inn', 'inn');
      expect(follows.offer.comeAlong).toEqual(['wenna']);
      expect(followersOf(follows.state)).toEqual(['corvin', 'sylvie']);
      expect(follows.state.positions).toMatchObject({ sylvie: 'inn' });
    });

    it('keeps an entity the code only met in the offer, and leaves the state as it was', () => {
      const coded = withCodeWrites(commit, { entities: [{ entity: 'wenna', kind: 'meet' }] }, context());
      const { state, offer } = move(atInn, coded, 'inn', 'inn');
      expect(offer.comeAlong).toEqual(['wenna']);
      expect(state).toEqual(move(atInn, commit, 'inn', 'inn').state);
    });
  });

  describe('code entity writes', () => {
    const coded = (replies: [TurnPassSubject, string][], entities: NonNullable<WorldWrites['entities']>) =>
      withCodeWrites(autoCommit(replies), { entities }, context());

    it('apply after the replies and the followers, so code has the last word', () => {
      const commit = coded([[who('wenna', [...NEW]), 'Come along'], [who('albus', [...FOLLOWING]), WAIT]], [
        { entity: 'wenna', kind: 'unfollow' }, { entity: 'albus', kind: 'follow' }, { entity: 'corvin', kind: 'move', location: 'chapel' },
      ]);
      const { state } = move(atInn, commit, 'inn', 'square');
      expect(state.positions).toEqual({ wenna: 'square', albus: 'square', corvin: 'chapel' });
      expect(followersOf(state)).toEqual(['albus']);
    });

    it('move and follow every Unique entity, and no Generic entity', () => {
      const start = book({ ...atInn.positions, sylvie: 'keep' }, ['albus', 'corvin']);
      const { state } = move(start, coded([], [
        { entity: 'sylvie', kind: 'follow' }, { entity: 'moths', kind: 'follow' }, { entity: 'moths', kind: 'move', location: 'barrow' },
      ]), 'inn', 'keep');
      expect(state.positions).toMatchObject({ sylvie: 'keep' });
      expect(followersOf(state)).toEqual(['albus', 'corvin', 'sylvie']);
      expect('moths' in state.positions || 'moths' in state.uniques).toBe(false);
    });

    it('leave an entity that is not following where it is on unfollow', () => {
      const { state } = move(atInn, coded([], [{ entity: 'wenna', kind: 'unfollow' }, { entity: 'wight', kind: 'unfollow' }]), 'inn', 'keep');
      expect(state.positions).toEqual({ wenna: 'inn', albus: 'keep', corvin: 'keep' });
      expect(followersOf(state)).toEqual(['albus', 'corvin']);
    });

    it('apply in call order, the later write winning', () => {
      const { state } = move(atInn, coded([], [
        { entity: 'wenna', kind: 'follow' }, { entity: 'wenna', kind: 'move', location: 'tower' }, { entity: 'albus', kind: 'move', location: 'tower' },
        { entity: 'albus', kind: 'follow' },
      ]), 'inn', 'inn');
      expect(state.positions).toMatchObject({ wenna: 'tower', albus: 'inn' });
      expect(followersOf(state)).toEqual(['albus', 'corvin']);
    });

    it('join the writes of every timing in run order', () => {
      const before = withCodeWrites(autoCommit([]), { entities: [{ entity: 'wenna', kind: 'move', location: 'tower' }] }, context());
      const after = withCodeWrites(before, { entities: [{ entity: 'wenna', kind: 'follow' }] }, context());
      const { state } = move(atInn, after, 'inn', 'keep');
      expect(state.positions.wenna).toBe('keep');
      expect(followersOf(state)).toContain('wenna');
    });
  });

  describe('a runtime character', () => {
    it('is asked while the scene list holds it, and not when it is only anchored here', () => {
      const state = book(runtimePositions([stranger]));
      const asked = (inScene: string[]) =>
        entityMoveSubjects([stranger.entity], state, 'inn', world, { runtime: [stranger], inScene: new Set(inScene) }).map((e) => e.id);
      expect(asked(['mira'])).toEqual(['mira']);
      expect(asked([])).toEqual([]);
    });

    it('follows on come along, travels with the player, and waits where it stays behind', () => {
      const start = book(runtimePositions([stranger]));
      const joined = move(start, autoCommit([[who('mira', [...NEW]), 'Come along']]), 'inn', 'square').state;
      expect(followersOf(joined)).toEqual(['mira']);
      const later = placeAll(joined, withPlayerAt(holding(joined), 'keep'));
      const left = move(later, autoCommit([[who('mira', [...FOLLOWING]), WAIT]]), 'keep', 'pier').state;
      expect(followersOf(left)).toEqual([]);
      // Its anchor is its position, so the stored record moves with it.
      expect(withRuntimePositions([stranger], left.positions)).toEqual([{ ...stranger, locationId: 'keep' }]);
    });
  });
});

describe('computeTurnCommit — discoveries', () => {
  it('materializes one entity per described character, anchored to this turn and location', () => {
    const { plan, result } = runOf([
      { id: 'narration', raw: NARRATION },
      { id: 'discoverEntity', raw: 'A weathered dockhand.', subject: { name: 'Bram' } },
      { id: 'discoverEntity', raw: 'A netmender who never looks up.', subject: { name: 'Sela' } },
    ]);
    const commit = computeTurnCommit({ result, plan, context: context({ discoveryLocationId: 'loc-pier' }) });
    expect(commit?.discoveries.map((d) => [d.entity.name, d.entity.aiDescription, d.locationId, d.sourceTurnId])).toEqual([
      ['Bram', 'A weathered dockhand.', 'loc-pier', 'turn-1'],
      ['Sela', 'A netmender who never looks up.', 'loc-pier', 'turn-1'],
    ]);
    expect(new Set(commit?.discoveries.map((d) => d.entity.id)).size).toBe(2);
  });

  it('mints its own entity ids when the caller supplies none', () => {
    const { plan, result } = runOf([
      { id: 'narration', raw: NARRATION },
      { id: 'discoverEntity', raw: 'A weathered dockhand.', subject: { name: 'Bram' } },
    ]);
    const commit = computeTurnCommit({ result, plan, context: { ...context(), newEntityId: undefined } });
    expect(commit?.discoveries[0].entity.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('drops a character whose description came back unusable, leaving them due for the drainer', () => {
    const { plan, result } = runOf([
      { id: 'narration', raw: NARRATION },
      { id: 'discoverEntity', raw: '   ', subject: { name: 'Bram' } },
      { id: 'discoverEntity', subject: { name: 'Sela' }, failed: true },
    ]);
    expect(computeTurnCommit({ result, plan, context: context() })?.discoveries).toEqual([]);
  });

  it('materializes each described name the turn produced, variants included', () => {
    // Today's behavior: the guard is against who is already known, not against the rest of this batch, and
    // the two names reached the pass as distinct participants.
    const { plan, result } = runOf([
      { id: 'narration', raw: NARRATION },
      { id: 'discoverEntity', raw: 'A weathered dockhand.', subject: { name: 'Bram Teel' } },
      { id: 'discoverEntity', raw: 'A weathered dockhand.', subject: { name: 'Bram' } },
    ]);
    expect(computeTurnCommit({ result, plan, context: context() })?.discoveries).toHaveLength(2);
  });

  it('does not re-add someone already discovered, however their name is written', () => {
    const { plan, result } = runOf([
      { id: 'narration', raw: NARRATION },
      { id: 'discoverEntity', raw: 'A weathered dockhand.', subject: { name: 'Bram Teel' } },
    ]);
    const commit = computeTurnCommit({ result, plan, context: context({ knownDiscoveredNames: ['bram teel'] }) });
    expect(commit?.discoveries).toEqual([]);
  });
});

describe('computeTurnCommit — turns that produced nothing to apply', () => {
  it('applies nothing from a stopped turn', () => {
    const { plan, run } = runOf([
      { id: 'narration', raw: NARRATION },
      { id: 'choices', raw: 'Wave at Maela' },
    ]);
    expect(computeTurnCommit({ result: { status: 'aborted', run }, plan, context: context() })).toBeNull();
  });

  it('applies nothing from a failed turn', () => {
    const { plan, run } = runOf([{ id: 'narration', raw: NARRATION }]);
    const result: TurnResult = { status: 'failed', kind: 'connection', error: new Error('offline'), run };
    expect(computeTurnCommit({ result, plan, context: context() })).toBeNull();
  });

  it('applies nothing when the narration came back empty', () => {
    const { plan, run } = runOf([{ id: 'narration', raw: '' }], { narration: '' });
    expect(computeTurnCommit({ result: { status: 'ok', run }, plan, context: context() })).toBeNull();
  });

  it('applies none of the code writes of a stopped turn', () => {
    const { plan, run } = runOf([{ id: 'narration', raw: NARRATION }]);
    const commit = computeTurnCommit({
      result: { status: 'aborted', run }, plan, context: context({ codeWrites: { location: 'loc-inn', minutes: 5, discover: [{ name: 'Tor', description: 'A smith.' }] } }),
    });
    expect(commit).toBeNull();
  });
});

describe('computeTurnCommit — code writes beat the passes', () => {
  it('moves the turn where code moved it and drops the suggest pass', () => {
    const { plan, result } = runOf(
      [{ id: 'narration', raw: NARRATION }, { id: 'locationSuggest', raw: 'The Long Pier' }], {}, { locationAutoApply: false },
    );
    const commit = computeTurnCommit({ result, plan, context: context({ codeWrites: { location: 'loc-inn' } }) });
    expect(commit?.turn.locationId).toBe('loc-inn');
    expect(commit?.codeMove).toBe('loc-inn');
    expect(commit?.suggestedLocation).toBeNull();
  });

  it('leaves the pass results as they are with no code write', () => {
    const { plan, result } = runOf(
      [{ id: 'narration', raw: NARRATION }, { id: 'locationSuggest', raw: 'The Long Pier' }, { id: 'timePassed', raw: '30m' }],
      {}, { locationAutoApply: false },
    );
    const commit = computeTurnCommit({ result, plan, context: context() });
    expect(commit).toMatchObject({ suggestedLocation: 'The Long Pier', codeMove: null, codeWrites: null, turnHours: 0.5 });
    expect(commit?.turn.locationId).toBe('loc-pier');
  });

  it('charges the minutes code advanced in place of what the clock pass measured', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }, { id: 'timePassed', raw: '30m' }]);
    const commit = computeTurnCommit({ result, plan, context: context({ gameTime: 10, codeWrites: { minutes: 90 } }) });
    expect(commit?.turnHours).toBe(1.5);
    expect(commit?.turn.timeDelta).toBe(1.5);
    expect(commit?.clock).toMatchObject({ deltaHours: 1.5, elapsedHours: 11.5 });
  });

  it('charges the minutes code advanced in place of Time Per Turn, zero included', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }]);
    const commit = computeTurnCommit({ result, plan, context: context({ gameTime: 10, fixedTurnHours: 2, codeWrites: { minutes: 0 } }) });
    expect(commit).toMatchObject({ turnHours: 0, clock: { elapsedHours: 10 } });
    expect(commit?.turn.timeDelta).toBe(0);
  });

  it('adds a bare discovered name to the turn\'s participants, where the drainer finds it due', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }]);
    const commit = computeTurnCommit({ result, plan, context: context({ codeWrites: { discover: [{ name: 'Tor' }] } }) });
    expect(commit?.turn.entities).toEqual(['Maela', 'Tor']);
    expect(commit?.discoveries).toEqual([]);
    const history = [{ role: 'assistant' as const, content: JSON.stringify(commit?.turn) }];
    expect(dueDiscoveries(history, ['Maela']).map((due) => [due.name, due.turnId, due.locationId])).toEqual([['Tor', 'turn-1', 'loc-pier']]);
  });

  it('creates a described character at the turn\'s discovery location, with no pass', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }]);
    const commit = computeTurnCommit({
      result, plan, context: context({ discoveryLocationId: 'loc-pier', codeWrites: { discover: [{ name: 'Tor', description: 'A smith.' }] } }),
    });
    expect(commit?.discoveries.map((d) => [d.entity.name, d.entity.aiDescription, d.entity.id, d.locationId, d.sourceTurnId])).toEqual([
      ['Tor', 'A smith.', 'entity-1', 'loc-pier', 'turn-1'],
    ]);
    expect(commit?.turn.entities).toEqual(['Maela', 'Tor']);
  });

  it('replaces the discover pass\'s record of a name code described', () => {
    const { plan, result } = runOf([
      { id: 'narration', raw: NARRATION },
      { id: 'discoverEntity', raw: 'A stranger.', subject: { name: 'Tor' } },
      { id: 'discoverEntity', raw: 'A weathered dockhand.', subject: { name: 'Bram' } },
    ]);
    const commit = computeTurnCommit({ result, plan, context: context({ codeWrites: { discover: [{ name: 'tor', description: 'A smith.' }] } }) });
    expect(commit?.discoveries.map((d) => [d.entity.name, d.entity.aiDescription])).toEqual([['Bram', 'A weathered dockhand.'], ['tor', 'A smith.']]);
  });

  it('loses both discover forms when a regenerate rewinds the turn', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }]);
    const commit = computeTurnCommit({
      result, plan, context: context({ codeWrites: { discover: [{ name: 'Tor' }, { name: 'Sela', description: 'A netmender.' }] } }),
    });
    const earlier = { role: 'assistant' as const, content: JSON.stringify({ narration: 'Before.', choices: [], stat_changes: [], turnId: 'turn-0', entities: [] }) };
    const played = [earlier, { role: 'user' as const, content: 'I read the notices.' }, { role: 'assistant' as const, content: JSON.stringify(commit?.turn) }];
    const discovered = commit?.discoveries ?? [];
    expect([dueDiscoveries(played, []).map((due) => due.name), pruneDiscoveredToHistory(discovered, played).map((d) => d.entity.name)])
      .toEqual([['Maela', 'Tor', 'Sela'], ['Sela']]);
    const rewound = played.slice(0, 1);
    expect([dueDiscoveries(rewound, []), pruneDiscoveredToHistory(discovered, rewound)]).toEqual([[], []]);
  });

  it('leaves alone a name an entity, an earlier discovery or a deletion holds', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }]);
    const commit = computeTurnCommit({
      result, plan, context: context({
        heldNames: ['Mira', 'Wick'], knownDiscoveredNames: ['Bram Teel'],
        codeWrites: { discover: [{ name: 'Mira' }, { name: 'Wick', description: 'A runner.' }, { name: 'bram teel', description: 'Again.' }] },
      }),
    });
    expect(commit?.turn.entities).toEqual(['Maela']);
    expect(commit?.discoveries).toEqual([]);
  });
});

describe('withCodeWrites — the After the AI writes', () => {
  it('lays later writes over the ones the commit already carries', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }, { id: 'timePassed', raw: '30m' }]);
    const ctx = context({ gameTime: 10 });
    const early = computeTurnCommit({ result, plan, context: { ...ctx, codeWrites: { location: 'loc-inn', minutes: 30 } } });
    const commit = early && withCodeWrites(early, { location: 'loc-gate', minutes: 30, discover: [{ name: 'Tor', description: 'A smith.' }] }, ctx);
    expect(commit).toMatchObject({ codeMove: 'loc-gate', turnHours: 1, clock: { deltaHours: 1, elapsedHours: 11 } });
    expect(commit?.turn).toMatchObject({ locationId: 'loc-gate', timeDelta: 1 });
    expect(commit?.discoveries.map((d) => d.entity.name)).toEqual(['Tor']);
  });

  it('carries the Before pins and the later ones, in order', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }]);
    const ctx = context();
    const early = computeTurnCommit({ result, plan, context: { ...ctx, codeWrites: { pins: ['The bridge is out.'] } } });
    const commit = early && withCodeWrites(early, { pins: ['Mira owes a debt.'] }, ctx);
    expect(commit?.codeWrites?.pins).toEqual(['The bridge is out.', 'Mira owes a debt.']);
  });

  it('stores the memory and diary lines beside the passes, in run order, by entity name', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }, { id: 'summary', raw: 'The gate fell.' }]);
    const ctx = context({ diaryNames: { 'e-tor': 'Tor', 'e-mira': 'Mira' } });
    const early = computeTurnCommit({
      result, plan, context: { ...ctx, codeWrites: { memory: ['Tor lied.'], diary: [{ entity: 'e-tor', line: 'I lied.' }] } },
    });
    const commit = early && withCodeWrites(early, { memory: ['Mira ran.'], diary: [{ entity: 'e-mira', line: 'I ran.' }, { entity: 'e-tor', line: 'I hid.' }] }, ctx);
    expect(commit?.turn).toMatchObject({
      summary: 'The gate fell.',
      codeMemory: ['Tor lied.', 'Mira ran.'],
      codeDiaries: { Tor: ['I lied.', 'I hid.'], Mira: ['I ran.'] },
    });
  });

  it('keeps memory lines on the turn and out of the pins', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }]);
    const commit = computeTurnCommit({ result, plan, context: context({ codeWrites: { memory: ['Tor lied.'] } }) });
    expect(commit?.turn.codeMemory).toEqual(['Tor lied.']);
    expect(commit?.codeWrites?.pins).toBeUndefined();
  });

  it('hands back the same commit for no writes', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }]);
    const commit = computeTurnCommit({ result, plan, context: context() });
    expect(commit && withCodeWrites(commit, undefined, context())).toBe(commit);
  });
});

describe('withCodeLines — lines landed on a stored turn', () => {
  const stored = { narration: 'Rain starts.', choices: [], stat_changes: [], turnId: 't2', summary: 'The gate fell.' };
  const names = { 'e-tor': 'Tor', 'e-mira': 'Mira' };

  it('adds memory and diary lines after the ones the turn holds, by entity name', () => {
    const turn = { ...stored, codeMemory: ['Tor lied.'], codeDiaries: { Tor: ['I lied.'] } };
    expect(withCodeLines(turn, { memory: ['Mira ran.'], diary: [{ entity: 'e-mira', line: 'I ran.' }, { entity: 'e-tor', line: 'I hid.' }] }, names))
      .toEqual({ ...turn, codeMemory: ['Tor lied.', 'Mira ran.'], codeDiaries: { Tor: ['I lied.', 'I hid.'], Mira: ['I ran.'] } });
  });

  it('hands back the same turn for writes with no line', () => {
    expect(withCodeLines(stored, { pins: ['Kept.'], minutes: 30 }, names)).toBe(stored);
    expect(withCodeLines(stored, undefined, names)).toBe(stored);
  });
});
