/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { overlayStatCodeResult, runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { ChoiceWorldOption, PlayerStat, Script, ScriptTiming } from '@/types';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

/** A code write to `options` moves an Option's stat rows the way the in-play tab does (Q5, story 27). */

const script = (code: string, timing: ScriptTiming): Script => ({ id: `${timing}:${code}`, timing, code });
const gold = (over: Partial<PlayerStat> = {}): PlayerStat => ({
  id: 'gold', name: 'Gold', type: 'number', description: '', min: 0, max: 200, value: 150, regen: 3, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 1, aiMaxDelta: 0, ...over,
});

const DIFF: ChoiceWorldOption = {
  id: 'diff', name: 'Difficulty', type: 'choice', shownToPlayer: false, midGame: true, default: 'easy',
  values: [
    { id: 'easy', name: 'Easy', statChanges: [{ statId: 'gold', type: 'max', value: 100 }, { statId: 'gold', type: 'regen', value: 2 }] },
    { id: 'hard', name: 'Hard', statChanges: [{ statId: 'gold', type: 'max', value: -50 }, { statId: 'gold', type: 'regen', value: -1 }] },
  ],
};

const turnOf = (over: Partial<FlatStatCodeTurn> = {}): StatCodeTurn => statCodeTurnOf({
  stats: [gold()], previous: [gold()], enabled: {}, asks: [], regenApplied: {}, clock: {},
  ownerTraits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [], options: [DIFF] } },
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
});

describe('a code write to options with stat rows', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('re-derives max and regen under the written value, clamping the value into the new max', async () => {
    const out = await runStatCodeTurn(turnOf({ worldScripts: [script('options.Difficulty = "Hard";', 'after')] }));
    expect(out.optionWrites).toEqual([{ id: 'diff', value: 'hard' }]);
    const landed = overlayStatCodeResult([gold()], out, []);
    expect(landed[0]).toMatchObject({ value: 50, max: 50, regen: 0 });
  });

  it('lets a later script of the timing read the moved max', async () => {
    const reader: PlayerStat = { ...gold({ id: 'seen', name: 'Seen', max: 1000, baseMax: 1000, value: 0, regen: 0, baseRegen: 0 }), scripts: [script('return stats.Gold.max;', 'after')] };
    const out = await runStatCodeTurn(turnOf({
      stats: [gold(), reader], previous: [gold(), reader],
      worldScripts: [script('options.Difficulty = "Hard";', 'after')],
    }));
    expect(out.stats.find((s) => s.id === 'seen')?.value).toBe(50);
  });
});
