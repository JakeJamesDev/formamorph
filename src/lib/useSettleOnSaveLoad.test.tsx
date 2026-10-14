import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSettleOnSaveLoad } from './useSettleOnSaveLoad';
import {
  activeTraits, deriveEffectiveStats, statTraitsInForce, type GatedTraitResult, type TraitRuntimeState, type TraitWorld,
} from './traitRuntime';
import type { GameState, LegacyCodeBoundsStat, PlayerStat, Trait } from '@/types';

const stat: PlayerStat = {
  id: 'h', name: 'h', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0,
};
const saved = (over: Partial<TraitRuntimeState> = {}): TraitRuntimeState => ({
  stats: [stat], traits: [], disabledTraitIds: [], appliedValues: {}, ...over,
});
const on = (s: TraitRuntimeState) => activeTraits(s.traits, s.disabledTraitIds).map((t) => t.id);
const valueOf = (s: TraitRuntimeState) => s.stats.find((x) => x.id === 'h')!.value;
const nameOf = (t: Trait) => t.name;

// The save was written before the author added the Sworn oath; the ring's Ward outlived its ring.
const sworn: Trait = { id: 'sworn', name: 'Sworn', mode: 'alwaysOn', statChanges: [{ statId: 'h', value: 10, type: 'starting' }] };
const ring: Trait = { id: 'ring', name: 'Ring', statChanges: [], playerToggle: true };
const ward: Trait = {
  id: 'ward', name: 'Ward', playerToggle: true, requires: [{ all: [{ kind: 'trait', id: 'ring' }] }],
  statChanges: [{ statId: 'h', value: 20, type: 'starting' }],
};

/** Mount the hook on `state` at load count 0, then report what a load to count 1 commits. */
const loadInto = (state: TraitRuntimeState, world: TraitWorld) => {
  const commit = vi.fn<(result: GatedTraitResult) => void>();
  const { rerender } = renderHook(
    ({ loads }) => useSettleOnSaveLoad(loads, true, state, () => world, nameOf, commit),
    { initialProps: { loads: 0 } },
  );
  expect(commit).not.toHaveBeenCalled();
  rerender({ loads: 1 });
  return commit;
};

describe('settling traits on save load', () => {
  it('brings a new ungated Always On trait into an old save, stats and log line with it', () => {
    const commit = loadInto(saved(), { traits: [sworn], groups: [] });
    expect(commit).toHaveBeenCalledTimes(1);
    const result = commit.mock.calls[0][0];
    expect(on(result.state)).toEqual(['sworn']);
    expect(valueOf(result.state)).toBe(60);
    expect(result.log).toEqual(['Trait switched on: Sworn']);
  });

  it('turns off a trait whose gate no longer holds, reverses its stats and lists it cascade-off', () => {
    // Ward was on with its ring; the author has since removed the ring from the world and the save.
    const state = saved({ traits: [ward], stats: [{ ...stat, value: 70 }], appliedValues: { ward: { h: 20 } } });
    const commit = loadInto(state, { traits: [ward], groups: [] });
    const result = commit.mock.calls[0][0];
    expect(on(result.state)).toEqual([]);
    expect(valueOf(result.state)).toBe(50);
    expect(result.state.cascadeOffTraitIds).toEqual({ global: ['ward'] });
    expect(result.log).toEqual(['Trait switched off: Ward']);
    expect(result.cascadeNames).toEqual(['Ward']);
  });

  it('moves a new Hidden trait without naming it', () => {
    const commit = loadInto(saved(), { traits: [{ ...sworn, mode: 'hidden' }], groups: [] });
    const result = commit.mock.calls[0][0];
    expect(on(result.state)).toEqual(['sworn']);
    expect(valueOf(result.state)).toBe(60);
    expect(result.log).toEqual([]);
  });

  it("reads the save's stat values for a stat Condition", () => {
    // The author gated Ward on h 60 or more since the save; the save stands at 70 with Ward's 20 in it.
    const gated: Trait = { ...ward, requires: [{ all: [{ kind: 'stat', id: 'h', operator: '>=', value: 60, unit: 'raw' }] }] };
    const at = (value: number) => saved({ traits: [gated], stats: [{ ...stat, value }], appliedValues: { ward: { h: 20 } } });
    expect(loadInto(at(70), { traits: [gated], groups: [] })).not.toHaveBeenCalled();
    const commit = loadInto(at(55), { traits: [gated], groups: [] });
    expect(on(commit.mock.calls[0][0].state)).toEqual([]);
    expect(valueOf(commit.mock.calls[0][0].state)).toBe(35);
  });

  it('commits nothing when the save already matches the world', () => {
    const state = saved({ traits: [ring, ward], stats: [{ ...stat, value: 70 }], appliedValues: { ring: {}, ward: { h: 20 } } });
    expect(loadInto(state, { traits: [ring, ward], groups: [] })).not.toHaveBeenCalled();
  });

  it('waits for a pending persona, then settles against the world it brings', () => {
    const commit = vi.fn<(result: GatedTraitResult) => void>();
    // Until the library persona lands, its world is missing the Always On trait it carries.
    const pending: TraitWorld = { traits: [], groups: [] };
    const landed: TraitWorld = { traits: [sworn], groups: [] };
    const state = saved();
    const { rerender } = renderHook(
      ({ loads, ready, world }) => useSettleOnSaveLoad(loads, ready, state, () => world, nameOf, commit),
      { initialProps: { loads: 0, ready: true, world: pending } },
    );
    rerender({ loads: 1, ready: false, world: pending });
    expect(commit).not.toHaveBeenCalled();
    rerender({ loads: 1, ready: true, world: landed });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(on(commit.mock.calls[0][0].state)).toEqual(['sworn']);
  });

  describe('an older save’s code bounds', () => {
    // Albus is played and his linked Paladin trait raises Health's max by 10.
    const paladin: Trait = { id: 'paladin', name: 'Paladin', playerToggle: true, statChanges: [{ statId: 'h', value: 10, type: 'max' }] };
    const asAlbus: TraitWorld = {
      traits: [], groups: [], entities: [{ id: 'albus', name: 'Albus', persona: true }], persona: { source: 'world', entityId: 'albus' },
      global: { traits: [], groups: [] }, owners: [{ id: 'albus', name: 'Albus', traits: [paladin], groups: [] }],
    };
    const ownedTraits = { albus: { chosen: ['paladin'] } };
    /** Health as the save stored it: the code held the max at 60 over base 100 and Paladin's 10. */
    const legacy = (): LegacyCodeBoundsStat => ({ ...stat, max: 60, codeBounds: { max: 60 } });
    const snapshot = (globalStats: PlayerStat[]): GameState => ({
      globalStats, globalTraits: [], ownedTraits, visibleEntities: [], logEntries: [], gameplayText: '', gameTime: 0,
      characterData: null, choices: [], isGameStarted: true, timestamp: '', worldName: null, playerNotes: '',
      previousStateIndex: null, stateVersion: 2,
    });
    const effectiveMax = (stats: PlayerStat[], state: TraitRuntimeState) =>
      deriveEffectiveStats(stats, statTraitsInForce(state, asAlbus))[0].max;

    const load = (state: TraitRuntimeState, states: GameState[]) => {
      const commit = vi.fn<(result: GatedTraitResult) => void>();
      const commitHistory = vi.fn<(next: GameState[]) => void>();
      const history = { states, commit: commitHistory };
      const { rerender } = renderHook(
        ({ loads }) => useSettleOnSaveLoad(loads, true, state, () => asAlbus, nameOf, commit, history),
        { initialProps: { loads: 0 } },
      );
      rerender({ loads: 1 });
      return { commit, commitHistory };
    };

    it('become code deltas under the traits in force, persona-linked ones included, keeping the max the save showed', () => {
      const state = saved({ stats: [legacy()], ownedTraits, appliedValues: { 'albus/paladin': {} } });
      const { commit } = load(state, []);
      expect(commit).toHaveBeenCalledTimes(1);
      const [migrated] = commit.mock.calls[0][0].state.stats;
      expect(migrated.codeDelta).toEqual({ max: -50 });
      expect('codeBounds' in migrated).toBe(false);
      expect(migrated.max).toBe(60);
      expect(effectiveMax([migrated], commit.mock.calls[0][0].state)).toBe(60);
    });

    it('become code deltas in every history snapshot too', () => {
      const state = saved({ ownedTraits, appliedValues: { 'albus/paladin': {} } });
      const plain = snapshot([stat]);
      const { commit, commitHistory } = load(state, [snapshot([legacy()]), plain]);
      expect(commit).not.toHaveBeenCalled();
      const [older, kept] = commitHistory.mock.calls[0][0];
      expect(older.globalStats[0].codeDelta).toEqual({ max: -50 });
      expect('codeBounds' in older.globalStats[0]).toBe(false);
      expect(kept).toBe(plain);
    });

    it('change nothing when the migrated save loads again', () => {
      const first = load(saved({ stats: [legacy()], ownedTraits, appliedValues: { 'albus/paladin': {} } }), [snapshot([legacy()])]);
      const again = load(first.commit.mock.calls[0][0].state, first.commitHistory.mock.calls[0][0]);
      expect(again.commit).not.toHaveBeenCalled();
      expect(again.commitHistory).not.toHaveBeenCalled();
    });

    it('leave a save without them uncommitted', () => {
      const state = saved({ ownedTraits, appliedValues: { 'albus/paladin': {} } });
      const { commit, commitHistory } = load(state, [snapshot([stat])]);
      expect(commit).not.toHaveBeenCalled();
      expect(commitHistory).not.toHaveBeenCalled();
    });
  });

  it('settles once per load, not on every render', () => {
    const commit = vi.fn<(result: GatedTraitResult) => void>();
    const world: TraitWorld = { traits: [sworn], groups: [] };
    const { rerender } = renderHook(
      ({ loads, state }) => useSettleOnSaveLoad(loads, true, state, () => world, nameOf, commit),
      { initialProps: { loads: 3, state: saved() } },
    );
    rerender({ loads: 3, state: saved() });
    expect(commit).not.toHaveBeenCalled();
    rerender({ loads: 4, state: saved() });
    rerender({ loads: 4, state: saved() });
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
