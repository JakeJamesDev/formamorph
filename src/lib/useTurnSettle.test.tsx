import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { useTurnSettle } from './useTurnSettle';
import { daypartAt } from './gameClock';
import {
  activeTraits, gateStatsOf, settleTraits, switchPlayerTrait, type GatedTraitResult, type TraitRuntimeState, type TraitWorld,
} from './traitRuntime';
import type { GateStats } from './traitGates';
import type { PlayerStat, StatChange, Trait } from '@/types';

const stat = (id: string, value: number): PlayerStat => ({
  id, name: id, type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0,
});
const nameOf = (t: Trait) => t.name;
const on = (s: TraitRuntimeState) => activeTraits(s.traits, s.disabledTraitIds).map((t) => t.id);
const valueOf = (s: TraitRuntimeState, id: string) => s.stats.find((x) => x.id === id)!.value;
const withValue = (s: TraitRuntimeState, id: string, value: number): TraitRuntimeState =>
  ({ ...s, stats: s.stats.map((x) => (x.id === id ? { ...x, value } : x)) });

/** Berserk holds while Rage is 80 or more, and moves `effect`. */
const berserk = (effect: StatChange[]): Trait => ({
  id: 'berserk', name: 'Berserk', playerToggle: true, statChanges: effect,
  requires: [{ all: [{ kind: 'stat', id: 'rage', operator: '>=', value: 80, unit: 'raw' }] }],
});

/** The hook on `state`; `commit` collects every settle that moved something, and the hook state follows it. */
function mount(start: TraitRuntimeState, world: TraitWorld) {
  const commit = vi.fn<(result: GatedTraitResult) => void>();
  const hook = renderHook(({ state }) => useTurnSettle(state, () => world, nameOf, commit), { initialProps: { state: start } });
  let state = start;
  /** One commit: the turn lands `next`, then the settle runs against `gateStats`. */
  const turn = async (next: TraitRuntimeState, gateStats: GateStats | null = null) => {
    state = next;
    hook.rerender({ state });
    const calls = commit.mock.calls.length;
    // The settle waits for a render, which act flushes once its callback returns.
    let settled: Promise<void> = Promise.resolve();
    await act(async () => { settled = hook.result.current(gateStats); });
    await settled;
    if (commit.mock.calls.length > calls) {
      state = commit.mock.calls.at(-1)![0].state;
      hook.rerender({ state });
    }
    return state;
  };
  return { commit, turn, hook, current: () => state };
}

describe('the per-turn settle', () => {
  // Berserk raises Focus by 10 while on.
  const fury = berserk([{ statId: 'focus', value: 10, type: 'starting' }]);
  const world: TraitWorld = { traits: [fury], groups: [] };
  const raging = (): TraitRuntimeState => ({
    stats: [stat('rage', 85), stat('focus', 60)], traits: [fury], disabledTraitIds: [], appliedValues: { berserk: { focus: 10 } },
  });

  it('turns a stat-gated trait off, on and off across three commits, reversing its effects', async () => {
    const { turn, commit } = mount(raging(), world);

    let s = await turn(withValue(raging(), 'rage', 70));
    expect(on(s)).toEqual([]);
    expect(valueOf(s, 'focus')).toBe(50);
    expect(s.cascadeOffTraitIds).toEqual({ global: ['berserk'] });

    s = await turn(withValue(s, 'rage', 90));
    expect(on(s)).toEqual(['berserk']);
    expect(valueOf(s, 'focus')).toBe(60);
    expect(s.cascadeOffTraitIds).toEqual({});

    s = await turn(withValue(s, 'rage', 60));
    expect(on(s)).toEqual([]);
    expect(valueOf(s, 'focus')).toBe(50);
    expect(commit.mock.calls.map(([result]) => result.log)).toEqual([
      ['Trait switched off: Berserk'], ['Trait switched on: Berserk'], ['Trait switched off: Berserk'],
    ]);
  });

  it('keeps a trait the player switched off by hand off while its gate holds', async () => {
    const off = switchPlayerTrait(raging(), 'berserk', false, world, nameOf)!.state;
    expect(on(off)).toEqual([]);
    const { turn, commit } = mount(off, world);
    const s = await turn(withValue(off, 'rage', 95));
    expect(on(s)).toEqual([]);
    expect(commit).not.toHaveBeenCalled();
  });

  it('settles a trait that drains its own gate stat once, without a flip in the commit', async () => {
    // Berserk costs 30 Rage. Its cascade off gave the 30 back, and the turn lands Rage at 85.
    const draining = berserk([{ statId: 'rage', value: -30, type: 'starting' }]);
    const w: TraitWorld = { traits: [draining], groups: [] };
    const start: TraitRuntimeState = {
      stats: [stat('rage', 85)], traits: [draining], disabledTraitIds: ['berserk'], appliedValues: { berserk: { rage: 30 } },
      cascadeOffTraitIds: { global: ['berserk'] },
    };
    const { turn, commit } = mount(start, w);
    const s = await turn(start, gateStatsOf(start, w));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(on(s)).toEqual(['berserk']);
    expect(valueOf(s, 'rage')).toBe(55);
    // Guard: a second settle in the same commit, reading the live 55, would flip it straight back off.
    expect(on(settleTraits(s, w, nameOf).state)).toEqual([]);
  });

  it('reads the snapshot it is handed, not the stats as they landed', async () => {
    // The commit's snapshot read Rage at 85; trait effects since then left the live value at 70.
    const live = withValue(raging(), 'rage', 70);
    const { turn, commit } = mount(live, world);
    const s = await turn(live, gateStatsOf(raging(), world));
    expect(commit).not.toHaveBeenCalled();
    expect(on(s)).toEqual(['berserk']);
    // Guard: the live read differs.
    expect(on(settleTraits(live, world, nameOf).state)).toEqual([]);
  });

  it('leaves a world with no stat Conditions as it stands', async () => {
    const plate: Trait = { id: 'plate', name: 'Plate', statChanges: [], requires: [{ all: [{ kind: 'trait', id: 'paladin' }] }] };
    const paladin: Trait = { id: 'paladin', name: 'Paladin', statChanges: [] };
    const w: TraitWorld = { traits: [paladin, plate], groups: [] };
    const start: TraitRuntimeState = { stats: [stat('rage', 50)], traits: [paladin, plate], disabledTraitIds: [], appliedValues: {} };
    const { turn, commit } = mount(start, w);
    for (const rage of [0, 100, 40]) await turn(withValue(start, 'rage', rage));
    expect(commit).not.toHaveBeenCalled();
  });

  it('resolves a pending settle at unmount without settling', async () => {
    const commit = vi.fn<(result: GatedTraitResult) => void>();
    const hook = renderHook(() => useTurnSettle(withValue(raging(), 'rage', 10), () => world, nameOf, commit));
    let settled = false;
    // Queued and unmounted before the render that would run it.
    act(() => {
      void hook.result.current(null).then(() => { settled = true; });
      hook.unmount();
    });
    await act(async () => {});
    expect(settled).toBe(true);
    expect(commit).not.toHaveBeenCalled();
  });

  it('resolves a settle asked for after unmount at once, without settling', async () => {
    // The turn awaited its stat code past the view's unmount.
    const commit = vi.fn<(result: GatedTraitResult) => void>();
    const hook = renderHook(() => useTurnSettle(withValue(raging(), 'rage', 10), () => world, nameOf, commit));
    const settle = hook.result.current;
    hook.unmount();
    await expect(settle(null)).resolves.toBeUndefined();
    expect(commit).not.toHaveBeenCalled();
  });

  it('resolves an earlier settle when a later one replaces it', async () => {
    const commit = vi.fn<(result: GatedTraitResult) => void>();
    const hook = renderHook(() => useTurnSettle(withValue(raging(), 'rage', 10), () => world, nameOf, commit));
    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    await act(async () => {
      first = hook.result.current(null);
      second = hook.result.current(null);
    });
    await Promise.all([first, second]);
    expect(commit).toHaveBeenCalledTimes(1);
  });
});

describe('the per-turn settle with a time gate', () => {
  // Lantern holds while it is evening or night; the player chose it.
  const lantern: Trait = {
    id: 'lantern', name: 'Lantern', playerToggle: true, statChanges: [],
    requires: [{ all: [{ kind: 'time', dayparts: ['evening', 'night'] }] }],
  };

  /** A commit as GameViewer runs one: the turn's hours pass, then the settle runs against the world as it reads then. */
  function useClockedTurn(start: TraitRuntimeState, startHours: number) {
    const [gameTime, setGameTime] = useState(startHours);
    const [state, setState] = useState(start);
    const daypart = daypartAt(gameTime);
    const world = useCallback((): TraitWorld => ({ traits: [lantern], groups: [], daypart }), [daypart]);
    const settle = useTurnSettle(state, world, nameOf, (result) => setState(result.state));
    const turn = (hours: number) => {
      setGameTime((now) => now + hours);
      return settle(null);
    };
    return { state, turn };
  }

  it('reads the clock after the turn’s time passes, so the commit that reaches evening turns the trait on', async () => {
    // Off at 12:00, midday; a six-hour turn reaches 18:00, evening.
    const chosen: TraitRuntimeState = { stats: [], traits: [lantern], disabledTraitIds: [], appliedValues: {} };
    const midday = settleTraits(chosen, { traits: [lantern], groups: [], daypart: daypartAt(4) }).state;
    expect(on(midday)).toEqual([]);
    const hook = renderHook(() => useClockedTurn(midday, 4));
    let settled: Promise<void> = Promise.resolve();
    await act(async () => { settled = hook.result.current.turn(6); });
    await settled;
    expect(on(hook.result.current.state)).toEqual(['lantern']);
  });
});
