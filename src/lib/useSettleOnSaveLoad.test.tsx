import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSettleOnSaveLoad } from './useSettleOnSaveLoad';
import { activeTraits, type GatedTraitResult, type TraitRuntimeState, type TraitWorld } from './traitRuntime';
import type { PlayerStat, Trait } from '@/types';

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
  id: 'ward', name: 'Ward', playerToggle: true, requires: [{ kind: 'trait', id: 'ring' }],
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
    expect(result.state.cascadeOffTraitIds).toEqual({ world: ['ward'] });
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
