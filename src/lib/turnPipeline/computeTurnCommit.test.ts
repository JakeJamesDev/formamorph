import { describe, it, expect, beforeEach } from 'vitest';
import { planTurn } from './planTurn';
import { computeTurnCommit } from './computeTurnCommit';
import { TURN_PASSES } from './turnPasses';
import { testInput } from './turnTestInputs';
import type { TurnMaterial, TurnPassId, TurnPassSubject, TurnPlanInput, TurnSettings } from './turnPlan';
import type { TurnPassOutcome, TurnResult, TurnRun } from './turnRunner';
import { FLAT_HOURS_PER_TURN } from '@/lib/gameClock';
import type { TurnCommitContext } from './computeTurnCommit';

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
  ...over,
});

/** One answered request, read through the pass that asked for it — never through a copy of its parser. */
const answered = (
  id: TurnPassId,
  raw: string,
  input: TurnPlanInput,
  mat: TurnMaterial,
  subject?: TurnPassSubject,
): TurnPassOutcome => {
  const pass = TURN_PASSES.find((p) => p.id === id);
  if (!pass) throw new Error(`no such pass: ${id}`);
  const scoped: TurnMaterial = { ...mat, ...(subject ? { subject } : {}) };
  return {
    id,
    ...(subject ? { subject } : {}),
    request: pass.buildRequest(input, scoped),
    raw,
    parsed: pass.parseResponse(raw, scoped),
  };
};

/** A request that came back empty-handed — what a batched failure leaves behind. */
const failed = (id: TurnPassId, input: TurnPlanInput, mat: TurnMaterial, subject?: TurnPassSubject): TurnPassOutcome => {
  const pass = TURN_PASSES.find((p) => p.id === id);
  if (!pass) throw new Error(`no such pass: ${id}`);
  return {
    id,
    ...(subject ? { subject } : {}),
    request: pass.buildRequest(input, { ...mat, ...(subject ? { subject } : {}) }),
    raw: '',
    parsed: null,
    error: new Error('network'),
  };
};

interface Answer {
  id: TurnPassId;
  raw?: string;
  subject?: TurnPassSubject;
  failed?: boolean;
}

const runOf = (answers: Answer[], over: Partial<TurnMaterial> = {}, settings: Partial<TurnSettings> = {}, inputOver: Partial<TurnPlanInput> = {}) => {
  const input = testInput(inputOver, settings);
  const mat = material(over);
  const run: TurnRun = {
    material: mat,
    passes: answers.map((a) =>
      a.failed
        ? failed(a.id, input, mat, a.subject)
        : answered(a.id, a.raw ?? '', input, mat, a.subject),
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
});
