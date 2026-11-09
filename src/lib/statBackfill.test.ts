import { describe, it, expect } from 'vitest';
import { backfillPlayerStats, backfillGameStateStats, refreshGameStateBindings } from './statBackfill';
import type { Entity, Stat, StatGroup, PlayerStat } from '@/types';
import { boxScripts } from '@/test/scriptFixtures';

const stat = (over: Partial<Stat>): Stat => ({
  id: 'x', name: 'X', type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], ...over,
});
const pstat = (over: Partial<PlayerStat>): PlayerStat => ({ ...stat(over), value: 0, ...over } as PlayerStat);

describe('backfillPlayerStats', () => {
  it('appends a world stat the save lacks, seeded at its start value', () => {
    const saved = [pstat({ id: 'health', name: 'Health', value: 42 })];
    const world = [stat({ id: 'health', name: 'Health' }), stat({ id: 'charge', name: 'Charge', starting: 0, max: 100 })];
    const out = backfillPlayerStats(saved, world);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(saved[0]); // existing untouched, same reference position
    expect(out[1]).toMatchObject({ id: 'charge', name: 'Charge', value: 0 });
  });

  it('never modifies or reorders existing saved stats (keeps their embedded schema)', () => {
    const saved = [pstat({ id: 'fp', name: 'Firepower', value: 80, descriptors: [{ id: 'a', threshold: 10, description: 'old' }] })];
    const world = [stat({ id: 'fp', name: 'Firepower', descriptors: [{ id: 'b', threshold: 50, description: 'new' }], scripts: boxScripts({ after: 'return 1;' }) })];
    const out = backfillPlayerStats(saved, world);
    expect(out).toBe(saved); // no additions → same array
    expect(out[0].descriptors[0].description).toBe('old'); // save's own schema wins
  });

  it('seeds from the authored value over `starting` (Q8)', () => {
    expect(backfillPlayerStats([], [stat({ id: 'a', starting: 10, value: 5 })])[0].value).toBe(5);
  });

  it('seeds from the authored value, then the floor', () => {
    const world = [stat({ id: 'a', value: 5 }), stat({ id: 'b', min: 3 })];
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
    const changed = backfillGameStateStats({ globalStats: [pstat({ id: 'a' })], other: 1 }, world);
    expect(changed.globalStats).toHaveLength(2);
    expect(changed.other).toBe(1);
    const unchanged = { globalStats: [pstat({ id: 'a' }), pstat({ id: 'new' })] };
    expect(backfillGameStateStats(unchanged, world)).toBe(unchanged);
  });

  it('leaves a state without globalStats untouched', () => {
    const s = { foo: 1, globalStats: undefined };
    expect(backfillGameStateStats(s, [stat({ id: 'a' })])).toBe(s);
  });
});

describe('refreshGameStateBindings', () => {
  const blueprints: StatGroup = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' };
  const trust = stat({ id: 'trust', groupId: 'bp', morphBindings: [{ name: 'Belly', by: 2 }] });
  const own = stat({ id: 'own', morphBindings: [{ name: 'Hips', by: 3 }] });
  const link = { id: 'l1', originalId: 'trust', kind: 'stat' as const, originalName: 'trust', groupId: null };
  const entity = (over: Partial<Entity> = {}): Entity => ({ id: 'bram', name: 'Bram', ...over });
  const state = { entityStats: { bram: [pstat({ id: 'trust', morphBindings: [{ name: 'Old' }] }), pstat({ id: 'own', morphBindings: [{ name: 'Old' }] })] } };
  const refreshed = (e: Entity) => refreshGameStateBindings(state, [trust, own], [e], [blueprints]).entityStats.bram;

  it('re-reads the bindings of a linked stat from the world stat', () => {
    expect(refreshed(entity({ stats: [own], statLinks: [link] }))[0].morphBindings).toEqual([{ name: 'Belly', by: 2 }]);
  });

  it('lets the link override win over the world stat', () => {
    const overridden = { ...link, overrides: { trust: { morphBindings: { value: [{ name: 'Belly', by: 9 }], blueprint: trust.morphBindings! } } } };
    expect(refreshed(entity({ stats: [own], statLinks: [overridden] }))[0].morphBindings).toEqual([{ name: 'Belly', by: 9 }]);
  });

  it('still refreshes the own stat of an entity', () => {
    expect(refreshed(entity({ stats: [own], statLinks: [link] }))[1].morphBindings).toEqual([{ name: 'Hips', by: 3 }]);
  });
});
