import { describe, expect, it } from 'vitest';
import {
  applyCodeTraitSwitches, gateSnapshot, gateStatsOf, settleTraits, switchPlayerTrait, traitGates, traitUnlocked, type TraitRuntimeState,
} from './traitRuntime';
import { openingFold, type OpeningFoldWorld, type OpeningPicks } from './openingState';
import { optionsFor, snapshotOf } from './sandboxSnapshot';
import type { Entity, Stat, StatChange, StatRequirement, Trait } from '@/types';

// In play, a trait's gate leaves that trait's own rows out, as at setup (Q32, Q34).

const stat = (id: string, over: Partial<Stat> = {}): Stat =>
  ({ id, name: id, type: 'number', description: '', min: 0, max: 10, value: 7, regen: 0, descriptors: [], ...over });
const atLeast = (id: string, value: number, unit: StatRequirement['unit'] = 'raw'): StatRequirement =>
  ({ kind: 'stat', id, operator: '>=', value, unit });
const gated = (id: string, req: StatRequirement, statChanges: StatChange[]): Trait =>
  ({ id, name: id, statChanges, playerToggle: true, requires: [{ all: [req] }] });

// Berserker needs Strength 7 and gives -2; Giant needs 70% Strength and raises its max by 10.
const berserker = gated('berserker', atLeast('strength', 7), [{ statId: 'strength', type: 'starting', value: -2 }]);
const giant = gated('giant', atLeast('strength', 70, 'percent'), [{ statId: 'strength', type: 'max', value: 10 }]);
const world: OpeningFoldWorld = { stats: [stat('strength'), stat('luck')], traits: [berserker, giant], traitGroups: [], entities: [] };

const playOf = (w: OpeningFoldWorld, picks: OpeningPicks) => {
  const fold = openingFold(w, picks);
  return { state: fold.traitState, world: fold.state.ownerTraits.world, fold };
};
const strength = (state: TraitRuntimeState) => state.stats.find((s) => s.id === 'strength');
/** `state` after `turns` settles, each turn moving an unrelated stat. */
const played = (start: ReturnType<typeof playOf>, turns: number): TraitRuntimeState => {
  let state = start.state;
  for (let turn = 1; turn <= turns; turn++) {
    state = { ...state, stats: state.stats.map((s) => (s.id === 'luck' ? { ...s, value: s.value - 1 } : s)) };
    state = settleTraits(state, start.world).state;
  }
  return state;
};

describe('a trait whose own rows move the stat its gate reads', () => {
  it('keeps Berserker, picked at Strength 7, on through the first turns of play', () => {
    const start = playOf(world, { traits: ['berserker'], owned: {} });
    expect(strength(start.state)?.value).toBe(5);
    const state = played(start, 3);
    expect(state.disabledTraitIds).toEqual([]);
    expect(strength(state)?.value).toBe(5);
    expect(traitUnlocked(traitGates(state, start.world), null, 'berserker')).toBe(true);
  });

  it('turns Berserker off when Strength drops below 7 for another reason', () => {
    const start = playOf(world, { traits: ['berserker'], owned: {} });
    const hurt = { ...start.state, stats: start.state.stats.map((s) => (s.id === 'strength' ? { ...s, value: 4 } : s)) };
    const settled = settleTraits(hurt, start.world);
    expect(settled.cascade.map((t) => t.id)).toEqual(['berserker']);
    expect(settled.state.disabledTraitIds).toEqual(['berserker']);
  });

  it('judges Giant against the max without its own max row', () => {
    const start = playOf(world, { traits: ['giant'], owned: {} });
    expect(strength(start.state)).toMatchObject({ value: 7, max: 20 });
    const state = played(start, 2);
    expect(state.disabledTraitIds).toEqual([]);
    // Another source lowering Strength to 6 reads 60% of the max without Giant's row.
    const weak = { ...state, stats: state.stats.map((s) => (s.id === 'strength' ? { ...s, value: 6 } : s)) };
    expect(settleTraits(weak, start.world).cascade.map((t) => t.id)).toEqual(['giant']);
  });

  it('leaves an entity trait’s rows out of its own gate on the entity’s stats', () => {
    const ash: Entity = { id: 'ash', name: 'Ash', description: '', locations: [], stats: [stat('strength')], traits: [berserker] } as Entity;
    const start = playOf({ ...world, traits: [], entities: [ash] }, { traits: [], owned: { ash: ['berserker'] } });
    expect(start.state.entityStats?.ash?.find((s) => s.id === 'strength')?.value).toBe(5);
    const settled = settleTraits(start.state, start.world);
    expect(settled.cascade).toEqual([]);
    expect(traitUnlocked(traitGates(settled.state, start.world), 'ash', 'berserker')).toBe(true);
  });

  it('keeps a trait code switches on mid-commit, its gate reading the commit’s snapshot', () => {
    // Bodybuilder needs Strength 7 and gives +3; code switches it on at 7.
    const bodybuilder = gated('bodybuilder', atLeast('strength', 7), [{ statId: 'strength', type: 'starting', value: 3 }]);
    const start = playOf({ ...world, traits: [bodybuilder] }, { traits: [], owned: {} });
    const snapshot = gateSnapshot(gateStatsOf(start.state, start.world), start.state, start.world);
    const switched = applyCodeTraitSwitches(start.state, [{ traitId: 'bodybuilder', enabled: true, by: 'script' }], { ...start.world, gateStats: snapshot });
    expect(strength(switched.state)?.value).toBe(10);
    expect(switched.state.traits.map((t) => t.id)).toEqual(['bodybuilder']);
    expect(switched.state.disabledTraitIds).toEqual([]);
  });

  it('takes nothing out for a trait that is off', () => {
    const start = playOf(world, { traits: ['berserker'], owned: {} });
    const off = switchPlayerTrait(start.state, 'berserker', false, start.world);
    expect(off && strength(off.state)?.value).toBe(7);
    // Strength 6 reads 6, never 6 + Berserker's -2 record.
    const weak = { ...off!.state, stats: off!.state.stats.map((s) => (s.id === 'strength' ? { ...s, value: 6 } : s)) };
    expect(traitUnlocked(traitGates(weak, start.world), null, 'berserker')).toBe(false);
  });

  it('takes an entity trait’s rows out for its own owner only', () => {
    const entity = (id: string): Entity => ({ id, name: id, description: '', locations: [], stats: [stat('strength')], traits: [berserker] } as Entity);
    const start = playOf({ ...world, traits: [], entities: [entity('ash'), entity('bree')] }, { traits: [], owned: { ash: ['berserker'] } });
    // Bree holds no Berserker, so Ash's rows never lift Bree's reading.
    const bree = start.state.entityStats?.bree?.map((s) => (s.id === 'strength' ? { ...s, value: 5 } : s)) ?? [];
    const state = { ...start.state, entityStats: { ...start.state.entityStats, bree } };
    const gates = traitGates(state, start.world);
    expect(traitUnlocked(gates, 'ash', 'berserker')).toBe(true);
    expect(traitUnlocked(gates, 'bree', 'berserker')).toBe(false);
  });

  it('keeps two traits that each need the other’s +3 on once both are on', () => {
    const lift = (id: string) => gated(id, atLeast('strength', 7), [{ statId: 'strength', type: 'starting', value: 3 }]);
    const pair: OpeningFoldWorld = { stats: [stat('strength', { value: 4, max: 20 }), stat('luck')], traits: [lift('left'), lift('right')], traitGroups: [], entities: [] };
    const start = playOf(pair, { traits: [], owned: {} });
    // Both on at 10: each reads 7, base 4 plus the other's +3.
    const both = { ...start.state, traits: pair.traits!, stats: start.state.stats.map((s) => (s.id === 'strength' ? { ...s, value: 10 } : s)), appliedValues: { left: { strength: 3 }, right: { strength: 3 } } };
    expect(settleTraits(both, start.world).cascade).toEqual([]);
  });

  it.each([
    ['berserker', { value: 5, max: 10 }],
    ['giant', { value: 7, max: 20 }],
  ])('shows stat code %s as available on its own rows', (id, strengthAt) => {
    const { fold } = playOf(world, { traits: [id], owned: {} });
    expect(fold.state.stats.find((s) => s.id === 'strength')).toMatchObject(strengthAt);
    const options = optionsFor(snapshotOf(fold.state), { home: { kind: 'world' }, timing: 'after', code: 'return 1;' });
    expect(options.traits?.find((t) => t.id === id)).toMatchObject({ available: true, enabled: true });
  });
});
