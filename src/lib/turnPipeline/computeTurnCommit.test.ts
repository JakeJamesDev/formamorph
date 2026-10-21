import { describe, it, expect, beforeEach } from 'vitest';
import { planTurn } from './planTurn';
import { commitEntityMoves, computeTurnCommit, withCodeLines, withCodeWrites } from './computeTurnCommit';
import {
  carryFollowers, entityMoveSubjects, moveWithPlayer, peeledCharacters, runtimePositions, turnPeelOff, withRuntimePositions, type FollowerState, type PeelOff,
} from '@/lib/entityFollowing';
import { entitiesInPlay } from '@/lib/entityPresence';
import { dueDiscoveries } from '@/lib/backgroundPassQueue/backgroundPassQueue';
import { pruneDiscoveredToHistory } from '@/lib/runtimeCharacters';
import { TURN_PASSES } from './turnPasses';
import { testInput } from './turnTestInputs';
import type { TurnMaterial, TurnPassId, TurnPassSubject, TurnPlanInput, TurnSettings } from './turnPlan';
import type { TurnPassOutcome, TurnResult, TurnRun } from './turnRunner';
import { FLAT_HOURS_PER_TURN } from '@/lib/gameClock';
import type { TurnCommitContext } from './computeTurnCommit';
import type { WorldWrites } from '@/lib/statCodeExecutor';
import { parseTurnContent, serializeTurnContent } from '@/lib/turnDigest';
import type { Entity, GameLocation, TurnToolCall } from '@/types';

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

  it('stores no Tool calls when the AI made none, and a turn saved without them loads unchanged', () => {
    const { plan, result } = runOf([{ id: 'narration', raw: NARRATION }]);
    expect(computeTurnCommit({ result, plan, context: context({ toolCalls: [] }) })?.turn).not.toHaveProperty('toolCalls');
    const saved = '{"narration":"Hi.","choices":[],"stat_changes":[]}';
    expect(parseTurnContent(saved)).toEqual({ narration: 'Hi.', choices: [], stat_changes: [] });
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
  const who = (id: string, moves: TurnPassSubject['moves']): TurnPassSubject => ({ name: id, entity: { id, name: id } as Entity, moves });
  const NEW = ['stay', 'comeAlong'] as const;
  const FOLLOWING = ['keepFollowing', 'stayHere'] as const;
  /** The commit an auto-mode turn with these entity replies produces. */
  const autoCommit = (replies: [TurnPassSubject, string | null][]) => {
    const { plan, result } = runOf([
      { id: 'narration', raw: NARRATION },
      ...replies.map(([subject, raw]): Answer => (raw === null
        ? { id: 'entityLocationAuto', subject, failed: true }
        : { id: 'entityLocationAuto', raw, subject })),
    ]);
    return computeTurnCommit({ result, plan, context: context() })!;
  };
  /** Wenna stands at the inn; Albus and Corvin follow the player there. */
  const atInn = { positions: { wenna: 'inn', albus: 'inn', corvin: 'inn' }, followers: ['albus', 'corvin'] };

  it('reads each reply under its entity, and keeps only the ones that change something', () => {
    const commit = autoCommit([
      [who('wenna', [...NEW]), 'Come along'],
      [who('sylvie', [...NEW]), 'Stay'],
      [who('albus', [...FOLLOWING]), 'Stay here'],
      [who('corvin', [...FOLLOWING]), 'Keep following'],
      [who('mira', [...NEW]), null],
    ]);
    expect(commit.entityMoves).toEqual({ stayHere: ['albus'], comeAlong: ['wenna'], comeOnce: [], goTo: [] });
  });

  it('joins in order: stay here where the player stood, followers with the player, then come along', () => {
    const commit = autoCommit([[who('wenna', [...NEW]), 'Come along'], [who('albus', [...FOLLOWING]), 'Stay here']]);
    const { state, offer } = commitEntityMoves(atInn, commit, { from: 'inn', to: 'square' });
    expect(state.positions).toEqual({ wenna: 'square', albus: 'inn', corvin: 'square' });
    expect(state.followers).toEqual(['corvin', 'wenna']);
    expect(offer.comeAlong).toEqual([]);
  });

  it('keeps a follower following on every later move until it stays here', () => {
    const joined = commitEntityMoves(atInn, autoCommit([[who('wenna', [...NEW]), 'Come along']]), { from: 'inn', to: 'square' }).state;
    // Entity Movement off: no request, no reply, and the followers still come.
    const later = commitEntityMoves(joined, autoCommit([]), { from: 'square', to: 'keep' }).state;
    expect(later.positions).toMatchObject({ wenna: 'keep', albus: 'keep', corvin: 'keep' });
    expect(carryFollowers(later, 'chapel').positions).toMatchObject({ wenna: 'chapel', albus: 'chapel', corvin: 'chapel' });
  });

  it('drops come along when the player stays, and still applies stay here', () => {
    const commit = autoCommit([[who('wenna', [...NEW]), 'Come along'], [who('albus', [...FOLLOWING]), 'Stay here']]);
    const { state } = commitEntityMoves(atInn, commit, { from: 'inn', to: 'inn' });
    expect(state.followers).toEqual(['corvin']);
    expect(state.positions).toEqual(atInn.positions);
  });

  describe('a Moves Between entity', () => {
    const blackwell: TurnPassSubject = {
      name: 'Blackwell',
      entity: { id: 'blackwell', name: 'Blackwell', movement: 'between', locations: ['keep', 'wall', 'tower'] } as Entity,
      moves: [...NEW],
      destinations: [{ id: 'keep', name: 'The Keep' }, { id: 'tower', name: 'The Tower' }] as GameLocation[],
    };
    const atWall = { positions: { blackwell: 'wall', albus: 'wall' }, followers: ['albus'] };

    it('reads a place name as a move there', () => {
      expect(autoCommit([[blackwell, 'The Tower']]).entityMoves.goTo).toEqual([{ id: 'blackwell', to: 'tower' }]);
    });

    it('goes to a location at once, whether or not the player moves', () => {
      const commit = autoCommit([[blackwell, 'The Tower']]);
      expect(commitEntityMoves(atWall, commit, { from: 'wall', to: 'wall' }).state.positions.blackwell).toBe('tower');
      expect(commitEntityMoves(atWall, commit, { from: 'wall', to: 'keep' }).state.positions)
        .toEqual({ blackwell: 'tower', albus: 'keep' });
    });

    it('comes along once into one of its locations and never joins the followers', () => {
      const commit = autoCommit([[blackwell, 'Come along']]);
      const went = commitEntityMoves(atWall, commit, { from: 'wall', to: 'keep' }).state;
      expect(went.positions).toEqual({ blackwell: 'keep', albus: 'keep' });
      expect(went.followers).toEqual(['albus']);
      // The next move carries the followers only.
      const next = commitEntityMoves(went, autoCommit([]), { from: 'keep', to: 'barrow' }).state;
      expect(next.positions).toEqual({ blackwell: 'keep', albus: 'barrow' });
    });

    it('stays when the player goes outside its locations', () => {
      const commit = autoCommit([[blackwell, 'Come along']]);
      const { state } = commitEntityMoves(atWall, commit, { from: 'wall', to: 'barrow' });
      expect(state.positions).toEqual({ blackwell: 'wall', albus: 'barrow' });
      expect(state.followers).toEqual(['albus']);
    });

    it('in suggest mode, goes to a location at once and holds come along for Go', () => {
      const { plan, result } = runOf(
        [
          { id: 'narration', raw: NARRATION },
          { id: 'locationSuggest', raw: 'The Long Pier' },
          { id: 'entityLocationSuggest', raw: 'The Tower', subject: blackwell },
          { id: 'entityLocationSuggest', raw: 'Come along', subject: { ...blackwell, entity: { ...blackwell.entity!, id: 'hale' } } },
        ],
        {},
        { locationAutoApply: false },
      );
      const commit = computeTurnCommit({ result, plan, context: context() })!;
      const start = { positions: { blackwell: 'wall', hale: 'wall' }, followers: [] };
      const offered = commitEntityMoves(start, commit, { from: 'wall', to: 'wall' });
      expect(offered.state.positions).toEqual({ blackwell: 'tower', hale: 'wall' });
      expect(offered.offer.comeOnce.map((once) => once.id)).toEqual(['hale']);
      expect(moveWithPlayer(offered.state, offered.offer, 'keep').positions).toEqual({ blackwell: 'tower', hale: 'keep' });
      expect(moveWithPlayer(offered.state, offered.offer, 'pier').positions).toEqual({ blackwell: 'tower', hale: 'wall' });
      // A code write on the waiting entity takes it off the offer.
      const coded = withCodeWrites(commit, { entities: [{ entity: 'hale', kind: 'move', location: 'gate' }] }, context());
      const written = commitEntityMoves(start, coded, { from: 'wall', to: 'wall' });
      expect(written.offer.comeOnce).toEqual([]);
      expect(written.state.positions).toEqual({ blackwell: 'tower', hale: 'gate' });
    });
  });

  describe('in suggest mode', () => {
    const suggestCommit = (location: string, replies: [TurnPassSubject, string][]) => {
      const { plan, result } = runOf(
        [
          { id: 'narration', raw: NARRATION },
          { id: 'locationSuggest', raw: location },
          ...replies.map(([subject, raw]): Answer => ({ id: 'entityLocationSuggest', raw, subject })),
        ],
        {},
        { locationAutoApply: false },
      );
      return computeTurnCommit({ result, plan, context: context() })!;
    };
    const commit = suggestCommit('The Long Pier', [[who('wenna', [...NEW]), 'Come along'], [who('albus', [...FOLLOWING]), 'Stay here']]);
    const offered = commitEntityMoves(atInn, commit, { from: 'inn', to: 'inn' });

    it('applies stay here at once and holds come along with the offer', () => {
      expect(offered.state.followers).toEqual(['corvin']);
      expect(offered.state.positions).toEqual(atInn.positions);
      expect(offered.offer.comeAlong).toEqual(['wenna']);
    });

    it('brings the waiting entity along on Go', () => {
      const went = moveWithPlayer(offered.state, offered.offer, 'pier');
      expect(went.followers).toEqual(['corvin', 'wenna']);
      expect(went.positions).toEqual({ wenna: 'pier', albus: 'inn', corvin: 'pier' });
    });

    it('leaves everyone in place on Dismiss', () => {
      // Dismiss drops the offer: nothing beyond the at-once replies ever applies.
      expect(offered.state.positions.wenna).toBe('inn');
      expect(offered.state.followers).not.toContain('wenna');
    });

    it('lets a code move of the player beat the offer and carry come along with it', () => {
      const { state, offer } = commitEntityMoves(atInn, commit, { from: 'inn', to: 'keep' });
      expect(offer.comeAlong).toEqual([]);
      expect(state.followers).toEqual(['corvin', 'wenna']);
      expect(state.positions).toEqual({ wenna: 'keep', albus: 'inn', corvin: 'keep' });
    });

    it('applies nothing to wait on when no move is offered', () => {
      const stayCommit = suggestCommit('NONE', [[who('wenna', [...NEW]), 'Come along']]);
      const { state, offer } = commitEntityMoves(atInn, stayCommit, { from: 'inn', to: 'inn' });
      expect(offer.comeAlong).toEqual([]);
      expect(state).toBe(atInn);
    });

    it('drops an entity the code wrote from the offer, and applies the write at once', () => {
      const coded = withCodeWrites(commit, { entities: [{ entity: 'wenna', kind: 'unfollow' }] }, context());
      const { state, offer } = commitEntityMoves(atInn, coded, { from: 'inn', to: 'inn' });
      expect(offer.comeAlong).toEqual([]);
      expect(state.positions.wenna).toBe('inn');
      const follows = commitEntityMoves(atInn, withCodeWrites(commit, { entities: [{ entity: 'mira', kind: 'follow' }] }, context()), { from: 'inn', to: 'inn' });
      expect(follows.offer.comeAlong).toEqual(['wenna']);
      expect(follows.state.followers).toEqual(['corvin', 'mira']);
      expect(follows.state.positions).toMatchObject({ mira: 'inn' });
    });
  });

  describe('code entity writes', () => {
    const coded = (replies: [TurnPassSubject, string][], entities: NonNullable<WorldWrites['entities']>) =>
      withCodeWrites(autoCommit(replies), { entities }, context());

    it('apply after the replies and the followers, so code has the last word', () => {
      const commit = coded([[who('wenna', [...NEW]), 'Come along'], [who('albus', [...FOLLOWING]), 'Stay here']], [
        { entity: 'wenna', kind: 'unfollow' }, { entity: 'albus', kind: 'follow' }, { entity: 'corvin', kind: 'move', location: 'chapel' },
      ]);
      const { state } = commitEntityMoves(atInn, commit, { from: 'inn', to: 'square' });
      expect(state.positions).toEqual({ wenna: 'square', albus: 'square', corvin: 'chapel' });
      expect(state.followers).toEqual(['albus']);
    });

    it('start tracking a Free entity that has no position', () => {
      const { state } = commitEntityMoves(atInn, coded([], [{ entity: 'wight', kind: 'move', location: 'barrow' }]), { from: 'inn', to: 'inn' });
      expect(state.positions).toEqual({ ...atInn.positions, wight: 'barrow' });
      const joined = commitEntityMoves(atInn, coded([], [{ entity: 'sylvie', kind: 'follow' }]), { from: 'inn', to: 'keep' }).state;
      expect(joined.positions).toMatchObject({ sylvie: 'keep' });
      expect(joined.followers).toEqual(['albus', 'corvin', 'sylvie']);
    });

    it('leave an entity that is not following where it is on unfollow', () => {
      const { state } = commitEntityMoves(atInn, coded([], [{ entity: 'wenna', kind: 'unfollow' }, { entity: 'wight', kind: 'unfollow' }]), { from: 'inn', to: 'keep' });
      expect(state.positions).toEqual({ wenna: 'inn', albus: 'keep', corvin: 'keep' });
      expect(state.followers).toEqual(['albus', 'corvin']);
    });

    it('apply in call order, the later write winning', () => {
      const { state } = commitEntityMoves(atInn, coded([], [
        { entity: 'wenna', kind: 'follow' }, { entity: 'wenna', kind: 'move', location: 'tower' }, { entity: 'albus', kind: 'move', location: 'tower' },
        { entity: 'albus', kind: 'follow' },
      ]), { from: 'inn', to: 'inn' });
      expect(state.positions).toMatchObject({ wenna: 'tower', albus: 'inn' });
      expect(state.followers).toEqual(['corvin', 'albus']);
    });

    it('join the writes of every timing in run order', () => {
      const before = withCodeWrites(autoCommit([]), { entities: [{ entity: 'wenna', kind: 'move', location: 'tower' }] }, context());
      const after = withCodeWrites(before, { entities: [{ entity: 'wenna', kind: 'follow' }] }, context());
      const { state } = commitEntityMoves(atInn, after, { from: 'inn', to: 'keep' });
      expect(state.positions.wenna).toBe('keep');
      expect(state.followers).toContain('wenna');
    });
  });

  describe('peel-off from an Everywhere Listed entity', () => {
    const soldiers = {
      id: 'soldiers', name: 'Barrow Soldier', movement: 'follow', locations: ['barrow', 'inn'],
      aiSummary: 'A dead soldier in rusted mail.', aiDescription: 'The long description.',
    } as Entity;
    const cast = [soldiers, { id: 'wenna', name: 'Wenna', locations: ['inn'] } as Entity];
    const peelCommit = (replies: [TurnPassSubject, string][], peel: PeelOff, suggest?: string) => {
      const { plan, result } = runOf(
        [
          { id: 'narration', raw: NARRATION },
          ...(suggest ? [{ id: 'locationSuggest', raw: suggest } as Answer] : []),
          ...replies.map(([subject, raw]): Answer => ({ id: suggest ? 'entityLocationSuggest' : 'entityLocationAuto', raw, subject })),
        ],
        {},
        suggest ? { locationAutoApply: false } : {},
      );
      return computeTurnCommit({ result, plan, context: context({ peel }) })!;
    };
    const start: FollowerState = { positions: {}, followers: [] };

    it('adds a new follower with its name and summary at the destination, and leaves the original listed', () => {
      const peel = turnPeelOff(cast, () => 'peeled-1');
      const commit = peelCommit([[who('soldiers', [...NEW]), 'Come along']], peel);
      const { state } = commitEntityMoves(start, commit, { from: 'inn', to: 'square' });
      expect(state.followers).toEqual(['peeled-1']);
      expect(state.positions).toEqual({ 'peeled-1': 'square' });
      expect(peeledCharacters(state, peel, new Set(), 'turn-1')).toEqual([{
        entity: { id: 'peeled-1', name: 'Barrow Soldier', aiDescription: 'A dead soldier in rusted mail.', aiSummary: 'A dead soldier in rusted mail.' },
        locationId: 'square', sourceTurnId: 'turn-1', peeledFrom: 'soldiers',
      }]);
      expect(entitiesInPlay(cast, state.positions)[0].locations).toEqual(['barrow', 'inn']);
    });

    it('peels nobody when the player stays', () => {
      const peel = turnPeelOff(cast, () => 'peeled-1');
      const { state } = commitEntityMoves(start, peelCommit([[who('soldiers', [...NEW]), 'Come along']], peel), { from: 'inn', to: 'inn' });
      expect(state).toBe(start);
      expect(peeledCharacters(state, peel, new Set(), 'turn-1')).toEqual([]);
    });

    it('holds the peel with the suggest offer, so only Go creates the follower', () => {
      const peel = turnPeelOff(cast, () => 'peeled-1');
      const commit = peelCommit([[who('soldiers', [...NEW]), 'Come along']], peel, 'The Long Pier');
      const offered = commitEntityMoves(start, commit, { from: 'inn', to: 'inn' });
      expect(offered.offer.comeAlong).toEqual(['peeled-1']);
      expect(peeledCharacters(offered.state, peel, new Set(), 'turn-1')).toEqual([]);
      const went = moveWithPlayer(offered.state, offered.offer, 'pier');
      expect(peeledCharacters(went, peel, new Set(), 'turn-1').map((d) => d.locationId)).toEqual(['pier']);
    });

    it('asks the original again only once its follower stays behind', () => {
      const peel = turnPeelOff(cast, () => 'peeled-1');
      const joined = commitEntityMoves(start, peelCommit([[who('soldiers', [...NEW]), 'Come along']], peel), { from: 'inn', to: 'barrow' }).state;
      const runtime = peeledCharacters(joined, peel, new Set(), 'turn-1');
      const scene = { runtime, inScene: new Set<string>() };
      const everyone = [...entitiesInPlay(cast, joined.positions), ...runtime.map((d) => d.entity)];
      // At another listed location, with its follower beside the player: the follower is asked, the original isn't.
      expect(entityMoveSubjects(everyone, joined, 'barrow', scene).map((e) => e.id)).toEqual(['peeled-1']);

      const stayCommit = peelCommit([[who('peeled-1', [...FOLLOWING]), 'Stay here']], turnPeelOff(cast, () => 'peeled-2'));
      const left = commitEntityMoves(joined, stayCommit, { from: 'barrow', to: 'inn' }).state;
      expect(left.followers).toEqual([]);
      expect(left.positions['peeled-1']).toBe('barrow');
      expect(entityMoveSubjects(everyone, left, 'inn', scene).map((e) => e.id)).toEqual(['soldiers']);
    });
  });

  describe('a runtime character', () => {
    const stranger = { entity: { id: 'mira', name: 'Mira', aiDescription: 'A ferry hand.' }, locationId: 'inn', sourceTurnId: 't0' };

    it('is asked while the scene list holds it, and not when it is only anchored here', () => {
      const state = { positions: runtimePositions([stranger]), followers: [] };
      const asked = (inScene: string[]) =>
        entityMoveSubjects([stranger.entity], state, 'inn', { runtime: [stranger], inScene: new Set(inScene) }).map((e) => e.id);
      expect(asked(['mira'])).toEqual(['mira']);
      expect(asked([])).toEqual([]);
    });

    it('follows on come along, travels with the player, and stays where it stays behind', () => {
      const start = { positions: runtimePositions([stranger]), followers: [] as string[] };
      const joined = commitEntityMoves(start, autoCommit([[who('mira', [...NEW]), 'Come along']]), { from: 'inn', to: 'square' }).state;
      expect(joined.followers).toEqual(['mira']);
      const later = carryFollowers(joined, 'keep');
      const left = commitEntityMoves(later, autoCommit([[who('mira', [...FOLLOWING]), 'Stay here']]), { from: 'keep', to: 'pier' }).state;
      expect(left.followers).toEqual([]);
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
