import { describe, it, expect } from 'vitest';
import { planTurn, passesInStage, planHasPass } from './planTurn';
import { TURN_PASSES } from './turnPasses';
import type { TurnPassId, TurnPlanInput, TurnSettings } from './turnPlan';
import { TEST_PROMPTS, testInput } from './turnTestInputs';

// The planner decides which passes a turn dispatches. These tests pin each pass's eligibility rule to the
// behavior the turn had before the Turn Pipeline extraction; the request contents those rules produce are
// checked against the recorded run in turnPlanParity.test.ts.

const input = testInput;

const ids = (over: Partial<TurnPlanInput> = {}, settings: Partial<TurnSettings> = {}): TurnPassId[] =>
  planTurn(input(over, settings)).passes.map((p) => p.id);

describe('planTurn', () => {
  it('is pure: the same inputs produce the same plan', () => {
    const a = planTurn(input());
    const b = planTurn(input());
    expect(a.passes.map((p) => p.id)).toEqual(b.passes.map((p) => p.id));
    expect({ ...a, input: null, passes: null }).toEqual({ ...b, input: null, passes: null });
  });

  it('dispatches every pass, in stage order, with everything enabled', () => {
    expect(ids()).toEqual([
      'locationAuto',
      'director',
      'character',
      'storyboard',
      'narration',
      'choices',
      'statUpdates',
      'summary',
      'timePassed',
      'diary',
      'discoverEntity',
    ]);
  });

  it('narrates on every turn, whatever else is switched off', () => {
    const bare = ids(
      { destinationCount: 0, locationCount: 1 },
      {
        thinkingMode: 'off',
        choicesEnabled: false,
        statUpdatesEnabled: false,
        locationChangeEnabled: false,
        aiClock: false,
        memoryDigests: false,
        characterDiaries: false,
        describeCharacters: false,
      },
    );
    expect(bare).toEqual(['narration']);
  });

  it('groups passes by stage', () => {
    const plan = planTurn(input());
    expect(passesInStage(plan, 'preNarration').map((p) => p.id)).toEqual(['locationAuto']);
    expect(passesInStage(plan, 'planning').map((p) => p.id)).toEqual(['director', 'character', 'storyboard']);
    expect(passesInStage(plan, 'narration').map((p) => p.id)).toEqual(['narration']);
    expect(planHasPass(plan, 'choices')).toBe(true);
    expect(planHasPass(plan, 'thinking')).toBe(false);
  });

  describe('the concurrency knob', () => {
    it('reports the setting on the plan', () => {
      expect(planTurn(input()).concurrency).toBe('parallel');
      expect(planTurn(input({}, { concurrentTurnRequests: false })).concurrency).toBe('serial');
    });

    it('leaves the digest, diary and discovery passes to the drainers when dispatching serially', () => {
      const serial = ids({}, { concurrentTurnRequests: false });
      expect(serial).not.toContain('summary');
      expect(serial).not.toContain('diary');
      expect(serial).not.toContain('discoverEntity');
      // The player-facing passes still run either way.
      expect(serial).toEqual(['locationAuto', 'director', 'character', 'storyboard', 'narration', 'choices', 'statUpdates', 'timePassed']);
    });
  });

  describe('the opening turn', () => {
    it('proxies the action for every consumer but the narration', () => {
      const plan = planTurn(input({ isGameStarted: false, action: 'Begin at the dock.' }));
      expect(plan.isOpeningTurn).toBe(true);
      expect(plan.effectiveAction).toBe('START GAME');
      expect(planTurn(input()).effectiveAction).toBe('I read the notices.');
    });

    it('measures the story-opening hour, and only then', () => {
      expect(ids({ isGameStarted: false })).toContain('openingTime');
      expect(ids()).not.toContain('openingTime');
      // A clock-less game never asks.
      expect(ids({ isGameStarted: false }, { aiClock: false })).not.toContain('openingTime');
    });

    it('routes no location change: there is no prior place to leave', () => {
      const opening = ids({ isGameStarted: false });
      expect(opening).not.toContain('locationAuto');
      expect(ids({ isGameStarted: false }, { locationAutoApply: false })).not.toContain('locationSuggest');
    });
  });

  describe('the location passes', () => {
    it('resolves the move up front with auto-apply, and offers it afterward without', () => {
      expect(ids()).toContain('locationAuto');
      expect(ids()).not.toContain('locationSuggest');
      const suggest = ids({}, { locationAutoApply: false });
      expect(suggest).toContain('locationSuggest');
      expect(suggest).not.toContain('locationAuto');
    });

    it('skips the up-front router when nowhere is navigable from here', () => {
      // The reply is matched against the destination list, so an empty one can only ever be discarded.
      expect(ids({ destinationCount: 0 })).not.toContain('locationAuto');
    });

    it('skips the suggestion when the world has a single place', () => {
      expect(ids({ locationCount: 1 }, { locationAutoApply: false })).not.toContain('locationSuggest');
    });

    it('skips both when the feature is off or the prompt is empty', () => {
      expect(ids({}, { locationChangeEnabled: false })).not.toContain('locationAuto');
      expect(ids({ prompts: { ...TEST_PROMPTS, locationChange: '' } })).not.toContain('locationAuto');
      expect(ids({ prompts: { ...TEST_PROMPTS, locationChange: '' } }, { locationAutoApply: false })).not.toContain('locationSuggest');
    });

    it('skips the up-front router when the player is nowhere', () => {
      expect(ids({ hasCurrentLocation: false })).not.toContain('locationAuto');
    });
  });

  describe('the planning stages', () => {
    it('runs the staged trio only in staged mode', () => {
      for (const mode of ['off', 'precall', 'inline'] as const) {
        const staged = ids({}, { thinkingMode: mode }).filter((id) => id === 'director' || id === 'character' || id === 'storyboard');
        expect(staged).toEqual([]);
      }
    });

    it('runs the single precall planner only in precall mode', () => {
      expect(ids({}, { thinkingMode: 'precall' })).toContain('thinking');
      for (const mode of ['off', 'inline', 'staged'] as const) {
        expect(ids({}, { thinkingMode: mode })).not.toContain('thinking');
      }
    });

    it('spends no request on inline thinking — it rides the narration', () => {
      const plan = planTurn(input({}, { thinkingMode: 'inline' }));
      expect(plan.inlineThinking).toBe(true);
      expect(plan.passes.filter((p) => p.stage === 'planning')).toEqual([]);
      expect(planTurn(input()).inlineThinking).toBe(false);
    });
  });

  describe('the post-narration passes', () => {
    it('asks for stat updates only when the world has live stats to move', () => {
      expect(ids()).toContain('statUpdates');
      expect(ids({}, { statCount: 0 })).not.toContain('statUpdates');
      expect(ids({}, { statUpdatesEnabled: false })).not.toContain('statUpdates');
    });

    it('offers choices only when they are enabled', () => {
      expect(ids({}, { choicesEnabled: false })).not.toContain('choices');
    });

    it('measures the turn only when the clock is on', () => {
      expect(ids({}, { aiClock: false })).not.toContain('timePassed');
    });

    it('digests the turn only when memory digests are on', () => {
      expect(ids({}, { memoryDigests: false })).not.toContain('summary');
    });

    it('writes diaries only when staged planning will read them back', () => {
      expect(ids()).toContain('diary');
      expect(ids({}, { characterDiaries: false })).not.toContain('diary');
      for (const mode of ['off', 'precall', 'inline'] as const) {
        expect(ids({}, { thinkingMode: mode })).not.toContain('diary');
      }
    });

    it('describes new characters only when the setting asks for it', () => {
      expect(ids({}, { describeCharacters: false })).not.toContain('discoverEntity');
    });
  });

  it('marks the passes that run once per subject', () => {
    const fanOut = TURN_PASSES.filter((p) => p.fanOut).map((p) => p.id);
    expect(fanOut).toEqual(['character', 'diary', 'discoverEntity']);
  });

  it('dispatches each pass at most once, fan-outs aside', () => {
    const seen = planTurn(input()).passes.filter((p) => !p.fanOut).map((p) => p.id);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
