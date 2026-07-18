import { describe, it, expect } from 'vitest';
import {
  normalizeStatChanges,
  applyAiStatChanges,
  applyTraitStatChanges,
  parseStatUpdates,
  applyAiMaxChanges,
  pageStatDeltas,
  appliedStatDeltas,
} from './statChanges';
import type { PlayerStat } from '@/types';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: '1',
  name: 'Health',
  type: 'number',
  description: '',
  min: 0,
  max: 100,
  value: 50,
  regen: 0,
  descriptors: [],
  ...over,
});

describe('pageStatDeltas', () => {
  const resolve = (value: number, over: Partial<PlayerStat> = {}) =>
    stat({ name: 'Resolve', min: 0, max: 10, value, ...over });
  const coin = (value: number, over: Partial<PlayerStat> = {}) =>
    stat({ name: 'Coin', min: 0, max: 100, value, ...over });

  it('diffs each stat against the previous turn', () => {
    const cur = [resolve(7), coin(20)];
    const prev = [resolve(5), coin(30)];
    expect(pageStatDeltas(cur, prev)).toEqual({ resolve: 2, coin: -10 });
  });

  it('falls back to `starting` when there is no previous turn (the opening turn)', () => {
    const cur = [resolve(5, { starting: 3 }), coin(30, { starting: 25 })];
    expect(pageStatDeltas(cur, undefined)).toEqual({ resolve: 2, coin: 5 });
  });

  it('falls back to `min` when the opening turn has no `starting`', () => {
    expect(pageStatDeltas([resolve(4)], undefined)).toEqual({ resolve: 4 }); // min 0
  });

  it('uses `starting` for a stat absent from the previous turn (newly added mid-game)', () => {
    const cur = [resolve(7), coin(30, { starting: 25 })];
    const prev = [resolve(5)]; // Coin did not exist last turn
    expect(pageStatDeltas(cur, prev)).toEqual({ resolve: 2, coin: 5 });
  });

  it('reports 0 for an unchanged stat', () => {
    expect(pageStatDeltas([resolve(5)], [resolve(5)])).toEqual({ resolve: 0 });
  });
});

describe('appliedStatDeltas', () => {
  const stat = (name: string, value: number, over: Partial<PlayerStat> = {}): PlayerStat => ({
    id: name, name, type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], value, ...over,
  });

  it('reports the actual value movement, keyed by lowercased name, omitting unchanged stats', () => {
    const before = [stat('Health', 80), stat('Coin', 20)];
    const after = [stat('Health', 90), stat('Coin', 20)];
    expect(appliedStatDeltas(before, after)).toEqual({ health: 10 });
  });

  it('is empty when a change was clamped away (the capped-stat bug)', () => {
    // AI asked for +10 Health but it was already at max — applyAiStatChanges clamps, so the value held.
    const before = [stat('Health', 100)];
    const after = applyAiStatChanges(before, { health: 10 }); // clamps to 100
    expect(appliedStatDeltas(before, after)).toEqual({});
  });

  it('matches the raw request only when nothing is clamped', () => {
    const before = [stat('Rampage', 30)];
    const after = applyAiStatChanges(before, { rampage: 5 });
    expect(appliedStatDeltas(before, after)).toEqual({ rampage: 5 });
  });
});

describe('normalizeStatChanges', () => {
  it('merges objects, lowercases keys, and sums repeated names', () => {
    expect(normalizeStatChanges([{ Health: 5 }, { health: -2 }, { Mana: 3 }])).toEqual({
      health: 3,
      mana: 3,
    });
  });

  it('returns {} for an empty array', () => {
    expect(normalizeStatChanges([])).toEqual({});
  });
});

describe('applyAiStatChanges', () => {
  it('applies a delta and clamps to max', () => {
    expect(applyAiStatChanges([stat({ value: 50, max: 100 })], { health: 60 })[0].value).toBe(100);
  });

  it('applies a negative delta and clamps to min', () => {
    expect(applyAiStatChanges([stat({ value: 50, min: 0 })], { health: -60 })[0].value).toBe(0);
  });

  it('respects noIncrease and noDecrease', () => {
    expect(applyAiStatChanges([stat({ value: 50, noIncrease: true })], { health: 10 })[0].value).toBe(50);
    expect(applyAiStatChanges([stat({ value: 50, noDecrease: true })], { health: -10 })[0].value).toBe(50);
  });

  it('looks up the delta by lowercased stat name', () => {
    expect(applyAiStatChanges([stat({ name: 'Mana', value: 10 })], { mana: 5 })[0].value).toBe(15);
  });

  it('only changes stats named in affectedStats', () => {
    const stats = [stat({ id: 'h', name: 'Health', value: 50 }), stat({ id: 'm', name: 'Mana', value: 10 })];
    const out = applyAiStatChanges(stats, { health: 5, mana: 5 }, ['Health']);
    expect(out[0].value).toBe(55);
    expect(out[1].value).toBe(10);
  });

  it('returns the same object reference for unchanged stats (no needless re-renders)', () => {
    const s = stat({ value: 50 });
    expect(applyAiStatChanges([s], { other: 5 })[0]).toBe(s);
  });
});

describe('applyTraitStatChanges', () => {
  it('applies a starting delta, clamped, and reports the change', () => {
    const { stats, changedIds } = applyTraitStatChanges(
      [stat({ id: 'h', value: 50 })],
      [{ statId: 'h', value: 20, type: 'starting' }],
    );
    expect(stats[0].value).toBe(70);
    expect(changedIds.has('h')).toBe(true);
  });

  it('lets one trait lower a floor another raised, back to the authored min but no further', () => {
    const { stats } = applyTraitStatChanges(
      [stat({ id: 'h', value: 50, min: 10 })],
      [
        { statId: 'h', value: 20, type: 'min' },
        { statId: 'h', value: -999, type: 'min' },
      ],
    );
    expect(stats[0].min).toBe(10); // the authored floor is the hard limit, however far the trait digs
  });

  it('ignores a lone negative min — traits never loosen a floor past the authored one', () => {
    const { stats } = applyTraitStatChanges(
      [stat({ id: 'h', value: 50, min: 10 })],
      [{ statId: 'h', value: -5, type: 'min' }],
    );
    expect(stats[0].min).toBe(10);
  });

  it('raising min pulls the value up to the new floor', () => {
    const { stats } = applyTraitStatChanges(
      [stat({ id: 'h', value: 50, min: 0 })],
      [{ statId: 'h', value: 60, type: 'min' }],
    );
    expect(stats[0].min).toBe(60);
    expect(stats[0].value).toBe(60);
  });

  it('lowering max below the value pulls the value down', () => {
    const { stats } = applyTraitStatChanges(
      [stat({ id: 'h', value: 90, max: 100 })],
      [{ statId: 'h', value: -20, type: 'max' }],
    );
    expect(stats[0].max).toBe(80);
    expect(stats[0].value).toBe(80);
  });

  it('raising max pulls the value up when it was sitting at the old max', () => {
    const { stats } = applyTraitStatChanges(
      [stat({ id: 'h', value: 100, max: 100 })],
      [{ statId: 'h', value: 50, type: 'max' }],
    );
    expect(stats[0].max).toBe(150);
    expect(stats[0].value).toBe(150);
  });

  it('regen adds to the regen rate without touching value', () => {
    const { stats } = applyTraitStatChanges(
      [stat({ id: 'h', value: 50, regen: 1 })],
      [{ statId: 'h', value: 2, type: 'regen' }],
    );
    expect(stats[0].regen).toBe(3);
    expect(stats[0].value).toBe(50);
  });

  it('does not mutate the input stats', () => {
    const s = stat({ id: 'h', value: 50, min: 0 });
    applyTraitStatChanges([s], [{ statId: 'h', value: 60, type: 'min' }]);
    expect(s.value).toBe(50);
    expect(s.min).toBe(0);
  });

  it('ignores changes for unknown stat ids', () => {
    const { stats, changedIds } = applyTraitStatChanges(
      [stat({ id: 'h', value: 50 })],
      [{ statId: 'x', value: 10, type: 'starting' }],
    );
    expect(stats[0].value).toBe(50);
    expect(changedIds.size).toBe(0);
  });
});

describe('parseStatUpdates', () => {
  it('splits value changes from MAX changes and lowercases/sums keys', () => {
    const { values, maxes } = parseStatUpdates('Health: 5\nhealth: -2\nStamina: 10 MAX');
    expect(values).toEqual({ health: 3 });
    expect(maxes).toEqual({ stamina: 10 });
  });

  it('detects MAX as a whole word anywhere, not as a substring', () => {
    const { values, maxes } = parseStatUpdates('Mana: MAX 7\nGrit: 4 (almost maxed)');
    expect(maxes).toEqual({ mana: 7 });
    // "maxed" must NOT be treated as a MAX change
    expect(values).toEqual({ grit: 4 });
  });

  it('rounds decimals and ignores lines without a colon or number', () => {
    const { values } = parseStatUpdates('Health: 2.5\njust some prose\nMana:\nLuck: +3');
    expect(values).toEqual({ health: 3, luck: 3 });
  });

  it('returns empty maps for empty input', () => {
    expect(parseStatUpdates('')).toEqual({ values: {}, maxes: {} });
  });

  it('skips display-format echoes (a number followed by "/") instead of mis-applying them', () => {
    // A weak model sometimes echoes the shown value "25/100 (Winded)"; that must not apply as +25.
    expect(parseStatUpdates('Vigor: 25/100 (Winded)')).toEqual({ values: {}, maxes: {} });
    // But real deltas and MAX changes (no fraction) still parse.
    const { values, maxes } = parseStatUpdates('Vigor: -15\nResolve: +2\nHealth: 10 MAX');
    expect(values).toEqual({ vigor: -15, resolve: 2 });
    expect(maxes).toEqual({ health: 10 });
  });

  it('strips leading/trailing markdown a model copies from the bulleted stat list', () => {
    // Decorated names ("- **Vigor:**", "**Resolve:**") should match; decoration never changes the stat.
    const { values } = parseStatUpdates('- **Vigor:** 5\n**Resolve:** -3\n- Luck: 2');
    expect(values).toEqual({ vigor: 5, resolve: -3, luck: 2 });
    // Decoration + a fraction echo is still dropped (guard runs after the key resolves).
    expect(parseStatUpdates('- **Vigor:** 5/100')).toEqual({ values: {}, maxes: {} });
  });
});

describe('applyAiMaxChanges', () => {
  it('raises the max without changing the current value', () => {
    const out = applyAiMaxChanges([stat({ value: 50, max: 100 })], { health: 20 });
    expect(out[0].max).toBe(120);
    expect(out[0].value).toBe(50);
  });

  it('re-clamps the value down when the max drops below it', () => {
    const out = applyAiMaxChanges([stat({ value: 100, max: 100 })], { health: -40 });
    expect(out[0].max).toBe(60);
    expect(out[0].value).toBe(60);
  });

  it('floors the new max at the stat min', () => {
    const out = applyAiMaxChanges([stat({ value: 50, min: 0, max: 100 })], { health: -999 });
    expect(out[0].max).toBe(0);
    expect(out[0].value).toBe(0);
  });

  it('respects noIncreaseMax and noDecreaseMax', () => {
    const up = applyAiMaxChanges([stat({ max: 100, noIncreaseMax: true })], { health: 10 });
    expect(up[0].max).toBe(100);
    const down = applyAiMaxChanges([stat({ max: 100, noDecreaseMax: true })], { health: -10 });
    expect(down[0].max).toBe(100);
  });

  it('matches stat names case-insensitively and ignores unlisted stats', () => {
    const out = applyAiMaxChanges([stat({ name: 'Mana', max: 30 })], { mana: 5 });
    expect(out[0].max).toBe(35);
  });
});
