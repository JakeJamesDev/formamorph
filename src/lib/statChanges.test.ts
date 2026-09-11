import { describe, it, expect } from 'vitest';
import {
  normalizeStatChanges,
  applyAiStatChanges,
  parseStatUpdates,
  applyAiMaxChanges,
  pageStatDeltas,
  appliedStatDeltas,
  applyRegen,
} from './statChanges';
import type { PlayerStat, Trait } from '@/types';

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

describe('applyRegen', () => {
  it('moves each stat by its regen times the hours, and reports the amount by id', () => {
    const out = applyRegen([stat({ id: 'a', value: 50, regen: 2 }), stat({ id: 'b', value: 10, regen: -1 })], 3, {});
    expect(out.stats.map(s => s.value)).toEqual([56, 7]);
    expect(out.applied).toEqual({ a: 6, b: -3 });
  });

  it('reports the clamped amount, so a stat at its cap applies nothing', () => {
    const out = applyRegen([stat({ id: 'a', value: 98, regen: 5 }), stat({ id: 'b', value: 100, regen: 5 })], 1, {});
    expect(out.stats.map(s => s.value)).toEqual([100, 100]);
    expect(out.applied).toEqual({ a: 2 });
  });

  it('leaves a disabled stat where it was', () => {
    const out = applyRegen([stat({ id: 'a', value: 50, regen: 2 })], 1, { a: false });
    expect(out.stats[0].value).toBe(50);
    expect(out.applied).toEqual({});
  });

  it('does not mutate its input', () => {
    const input = [stat({ id: 'a', value: 50, regen: 2 })];
    applyRegen(input, 1, {});
    expect(input[0].value).toBe(50);
  });
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

describe('applyAiMaxChanges under a code max', () => {
  // The cap underneath is base 55 + AI 5 = 60; the code holds the visible cap at 40.
  const coded = (over: Partial<PlayerStat> = {}) => stat({
    value: 40, min: 0, max: 40, baseMin: 0, baseMax: 55, baseRegen: 0, aiMaxDelta: 5, codeBounds: { max: 40 }, ...over,
  });

  it('holds the code max and books the ask underneath', () => {
    expect(applyAiMaxChanges([coded()], { health: 20 })[0]).toMatchObject({ max: 40, value: 40, aiMaxDelta: 25 });
    expect(applyAiMaxChanges([coded()], { health: -30 })[0]).toMatchObject({ max: 40, value: 40, aiMaxDelta: -25 });
  });

  it('books only what the floor lets the cap underneath move', () => {
    const floored = coded({ min: 50, baseMin: 50, value: 50, max: 50 });
    const once = applyAiMaxChanges([floored], { health: -30 })[0];
    expect(once.aiMaxDelta).toBe(-5);
    expect(applyAiMaxChanges([once], { health: -30 })[0]).toBe(once);
  });

  it('derives the cap underneath with the active traits', () => {
    const raise: Trait = { id: 't', name: 'Robust', statChanges: [{ statId: '1', value: 20, type: 'max' }] };
    const floored = coded({ min: 50, baseMin: 50, value: 50, max: 50 });
    expect(applyAiMaxChanges([floored], { health: -30 }, [raise])[0].aiMaxDelta).toBe(-25);
  });

  it('books nothing for an ask the flags refuse', () => {
    const refused = coded({ noIncreaseMax: true });
    expect(applyAiMaxChanges([refused], { health: 20 })[0]).toBe(refused);
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

  it('never moves a percentage stat’s pinned max', () => {
    const out = applyAiMaxChanges([stat({ type: 'percentage', max: 100 })], { health: 20 });
    expect(out[0].max).toBe(100);
  });
});
