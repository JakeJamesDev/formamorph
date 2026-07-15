import { describe, it, expect } from 'vitest';
import { backfillPlayerStats, backfillGameStateStats } from './statBackfill';
import type { Stat, PlayerStat } from '@/types';

const stat = (over: Partial<Stat>): Stat => ({
  id: 'x', name: 'X', type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], ...over,
});
const pstat = (over: Partial<PlayerStat>): PlayerStat => ({ ...stat(over), value: 0, ...over } as PlayerStat);

describe('backfillPlayerStats', () => {
  it('appends a world stat the save lacks, seeded at its starting value', () => {
    const saved = [pstat({ id: 'health', name: 'Health', value: 42 })];
    const world = [stat({ id: 'health', name: 'Health' }), stat({ id: 'charge', name: 'Charge', starting: 0, max: 100 })];
    const out = backfillPlayerStats(saved, world);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(saved[0]); // existing untouched, same reference position
    expect(out[1]).toMatchObject({ id: 'charge', name: 'Charge', value: 0 });
  });

  it('never modifies or reorders existing saved stats (keeps their embedded schema)', () => {
    const saved = [pstat({ id: 'fp', name: 'Firepower', value: 80, descriptors: [{ id: 'a', threshold: 10, description: 'old' }] })];
    const world = [stat({ id: 'fp', name: 'Firepower', descriptors: [{ id: 'b', threshold: 50, description: 'new' }], code: 'return 1;' })];
    const out = backfillPlayerStats(saved, world);
    expect(out).toBe(saved); // no additions → same array
    expect(out[0].descriptors[0].description).toBe('old'); // save's own schema wins
  });

  it('seeds from a numeric live value, then the floor, when starting is absent', () => {
    const world = [stat({ id: 'a', starting: undefined, value: 5 }), stat({ id: 'b', starting: undefined, value: undefined, min: 3 })];
    const out = backfillPlayerStats([], world);
    expect(out.map((s) => s.value)).toEqual([5, 3]);
  });

  it('does not prune stats the world removed', () => {
    const saved = [pstat({ id: 'gone', name: 'Legacy', value: 7 })];
    const out = backfillPlayerStats(saved, [stat({ id: 'kept' })]);
    expect(out.some((s) => s.id === 'gone')).toBe(true);
    expect(out).toHaveLength(2);
  });

  it('is a no-op when every world stat is already present', () => {
    const saved = [pstat({ id: 'a' }), pstat({ id: 'b' })];
    expect(backfillPlayerStats(saved, [stat({ id: 'a' }), stat({ id: 'b' })])).toBe(saved);
  });
});

describe('backfillGameStateStats', () => {
  it('backfills a state snapshot and returns a new object only when changed', () => {
    const world = [stat({ id: 'a' }), stat({ id: 'new' })];
    const changed = backfillGameStateStats({ playerStats: [pstat({ id: 'a' })], other: 1 }, world);
    expect(changed.playerStats).toHaveLength(2);
    expect(changed.other).toBe(1);
    const unchanged = { playerStats: [pstat({ id: 'a' }), pstat({ id: 'new' })] };
    expect(backfillGameStateStats(unchanged, world)).toBe(unchanged);
  });

  it('leaves a state without playerStats untouched', () => {
    const s = { foo: 1, playerStats: undefined };
    expect(backfillGameStateStats(s, [stat({ id: 'a' })])).toBe(s);
  });
});
