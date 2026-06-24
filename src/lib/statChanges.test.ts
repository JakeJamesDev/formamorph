import { describe, it, expect } from 'vitest';
import {
  normalizeStatChanges,
  applyAiStatChanges,
  applyTraitStatChanges,
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
