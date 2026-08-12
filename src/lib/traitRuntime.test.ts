import { describe, it, expect } from 'vitest';
import {
  acquireTrait,
  activeTraits,
  deriveEffectiveStats,
  listablePlayerTraits,
  recoverStatBases,
  seedStatBases,
  setTraitEnabled,
  type TraitRuntimeState,
  type TraitWorld,
} from './traitRuntime';
import { traitOrderIndex } from './traitEffects';
import type { PlayerStat, StatChange, Trait, TraitGroup } from '@/types';

const stat = (id: string, over: Partial<PlayerStat> = {}): PlayerStat => ({
  id,
  name: id,
  type: 'number',
  description: '',
  min: 0,
  max: 100,
  value: 50,
  regen: 0,
  descriptors: [],
  baseMin: 0,
  baseMax: 100,
  baseRegen: 0,
  aiMaxDelta: 0,
  ...over,
});

const trait = (id: string, statChanges: StatChange[] = [], over: Partial<Trait> = {}): Trait => ({
  id,
  name: id,
  statChanges,
  ...over,
});

const world = (traits: Trait[], groups: TraitGroup[] = []): TraitWorld => ({ traits, groups });

const state = (over: Partial<TraitRuntimeState> = {}): TraitRuntimeState => ({
  stats: [stat('h')],
  traits: [],
  disabledTraitIds: [],
  appliedValues: {},
  ...over,
});

const valueOf = (s: TraitRuntimeState, id = 'h') => s.stats.find((x) => x.id === id)!.value;
const boundsOf = (s: TraitRuntimeState, id = 'h') => {
  const found = s.stats.find((x) => x.id === id)!;
  return { min: found.min, max: found.max, regen: found.regen };
};

describe('deriveEffectiveStats', () => {
  it('sums the active traits contributions onto the bases', () => {
    const t1 = trait('a', [{ statId: 'h', value: 20, type: 'max' }, { statId: 'h', value: 2, type: 'regen' }]);
    const t2 = trait('b', [{ statId: 'h', value: 10, type: 'min' }]);
    const [derived] = deriveEffectiveStats([stat('h')], [t1, t2]);
    expect(derived).toMatchObject({ min: 10, max: 120, regen: 2 });
  });

  it('adds the accumulated AI max delta', () => {
    const [derived] = deriveEffectiveStats([stat('h', { aiMaxDelta: 15 })], []);
    expect(derived.max).toBe(115);
  });

  it('never drops a min below the authored floor, however traits combine', () => {
    const lower = trait('a', [{ statId: 'h', value: -30, type: 'min' }]);
    const [derived] = deriveEffectiveStats([stat('h', { min: 10, baseMin: 10 })], [lower]);
    expect(derived.min).toBe(10);
  });

  it('leaves a stat whose id no trait targets alone', () => {
    const elsewhere = trait('a', [{ statId: 'other', value: 40, type: 'max' }]);
    expect(deriveEffectiveStats([stat('h')], [elsewhere])[0]).toMatchObject({ min: 0, max: 100 });
  });

  it('does not mutate the input stats', () => {
    const s = stat('h', { value: 50 });
    deriveEffectiveStats([s], [trait('a', [{ statId: 'h', value: 60, type: 'min' }])]);
    expect(s).toMatchObject({ min: 0, max: 100 });
  });

  it('cancels a raise and a lower of the same maximum exactly', () => {
    const up = trait('a', [{ statId: 'h', value: 40, type: 'max' }]);
    const down = trait('b', [{ statId: 'h', value: -40, type: 'max' }]);
    const [derived] = deriveEffectiveStats([stat('h')], [up, down]);
    expect(derived.max).toBe(100);
  });
});

describe('recoverStatBases', () => {
  it('reproduces a legacy save’s own numbers when re-derived', () => {
    const held = trait('a', [
      { statId: 'h', value: 25, type: 'max' },
      { statId: 'h', value: 10, type: 'min' },
      { statId: 'h', value: 3, type: 'regen' },
    ]);
    // A save written under the incremental model: bounds already carry the trait, no base fields at all.
    const legacy: PlayerStat = {
      ...stat('h', { min: 10, max: 125, regen: 3, value: 60 }),
      baseMin: undefined,
      baseMax: undefined,
      baseRegen: undefined,
      aiMaxDelta: undefined,
    };
    const recovered = recoverStatBases([legacy], [held]);
    expect(recovered[0]).toMatchObject({ baseMin: 0, baseMax: 100, baseRegen: 0 });
    const [derived] = deriveEffectiveStats(recovered, [held]);
    expect(derived).toMatchObject({ min: 10, max: 125, regen: 3, value: 60 });
  });

  it('leaves a stat that already carries bases alone', () => {
    const already = stat('h', { baseMax: 80 });
    expect(recoverStatBases([already], [])[0].baseMax).toBe(80);
  });

  it('takes the authored max from the world and books the rest as AI movement', () => {
    const held = trait('a', [{ statId: 'h', value: 25, type: 'max' }]);
    // Authored max 100, the trait adds 25, and the AI raised the cap by 20 over the playthrough.
    const legacy: PlayerStat = { ...stat('h', { max: 145 }), baseMax: undefined, aiMaxDelta: undefined };
    const [recovered] = recoverStatBases([legacy], [held], [stat('h')]);
    expect(recovered).toMatchObject({ baseMax: 100, aiMaxDelta: 20 });
    expect(deriveEffectiveStats([recovered], [held])[0].max).toBe(145);
  });

  it('books an authored max the author has since lowered as movement, so the save keeps its cap', () => {
    const legacy: PlayerStat = { ...stat('h', { max: 100 }), baseMax: undefined, aiMaxDelta: undefined };
    const [recovered] = recoverStatBases([legacy], [], [stat('h', { max: 80 })]);
    expect(recovered).toMatchObject({ baseMax: 80, aiMaxDelta: 20 });
    expect(deriveEffectiveStats([recovered], [])[0].max).toBe(100);
  });

  it('falls back to reconstruction for a stat the world no longer authors', () => {
    const held = trait('a', [{ statId: 'h', value: 25, type: 'max' }]);
    const legacy: PlayerStat = { ...stat('h', { max: 145 }), baseMax: undefined, aiMaxDelta: undefined };
    const [recovered] = recoverStatBases([legacy], [held], [stat('other')]);
    expect(recovered).toMatchObject({ baseMax: 120, aiMaxDelta: 0 });
    expect(deriveEffectiveStats([recovered], [held])[0].max).toBe(145);
  });
});

describe('seedStatBases', () => {
  it('takes the bases from the authored bounds', () => {
    const seeded = seedStatBases([{ ...stat('h', { min: 5, max: 60, regen: 1 }), baseMax: undefined }]);
    expect(seeded[0]).toMatchObject({ baseMin: 5, baseMax: 60, baseRegen: 1, aiMaxDelta: 0 });
  });
});

describe('acquireTrait', () => {
  it('adds a trait the player did not hold and applies its stat changes', () => {
    const t = trait('a', [{ statId: 'h', value: 10, type: 'starting' }], { playerToggle: true });
    const { state: next } = acquireTrait(state(), t, world([t]));
    expect(next.traits.map((x) => x.id)).toEqual(['a']);
    expect(next.disabledTraitIds).toEqual([]);
    expect(valueOf(next)).toBe(60);
  });

  it('applies bound changes through derivation, not accumulation', () => {
    const t = trait('a', [{ statId: 'h', value: 30, type: 'max' }], { playerToggle: true });
    const { state: next } = acquireTrait(state(), t, world([t]));
    expect(boundsOf(next).max).toBe(130);
  });

  it('pulls the value up to a floor the trait raised', () => {
    const t = trait('a', [{ statId: 'h', value: 60, type: 'min' }], { playerToggle: true });
    const { state: next } = acquireTrait(state({ stats: [stat('h', { value: 50 })] }), t, world([t]));
    expect(boundsOf(next).min).toBe(60);
    expect(valueOf(next)).toBe(60);
  });

  it('adjusts a stat carrying several changes exactly once', () => {
    const t = trait('a', [
      { statId: 'h', value: 30, type: 'min' },
      { statId: 'h', value: 50, type: 'max' },
    ], { playerToggle: true });
    const { state: next } = acquireTrait(state({ stats: [stat('h', { value: 20 })] }), t, world([t]));
    expect(boundsOf(next)).toMatchObject({ min: 30, max: 150 });
    expect(valueOf(next)).toBe(30);
  });

  it('adds regen without touching the value', () => {
    const t = trait('a', [{ statId: 'h', value: 2, type: 'regen' }], { playerToggle: true });
    const { state: next } = acquireTrait(state({ stats: [stat('h', { regen: 1, baseRegen: 1 })] }), t, world([t]));
    expect(boundsOf(next).regen).toBe(3);
    expect(valueOf(next)).toBe(50);
  });

  it('re-enables rather than duplicating a trait already held', () => {
    const t = trait('a', [{ statId: 'h', value: 10, type: 'starting' }], { playerToggle: true });
    const held = state({ traits: [t], disabledTraitIds: ['a'] });
    const { state: next } = acquireTrait(held, t, world([t]));
    expect(next.traits).toHaveLength(1);
    expect(next.disabledTraitIds).toEqual([]);
  });
});

describe('reversal', () => {
  it('gives back nothing when a floor swallowed the change (the ratchet guard)', () => {
    const penalty = trait('a', [{ statId: 'h', value: -20, type: 'starting' }], { playerToggle: true });
    // Sitting exactly on the floor: the penalty can take nothing, so dropping it must return nothing.
    const start = state({ stats: [stat('h', { value: 0 })] });
    const { state: on } = acquireTrait(start, penalty, world([penalty]));
    expect(valueOf(on)).toBe(0);
    const { state: off } = setTraitEnabled(on, 'a', false, world([penalty]));
    expect(valueOf(off)).toBe(0);
  });

  it('leaves the stat exactly where it started after repeated toggle cycles at a bound', () => {
    const penalty = trait('a', [{ statId: 'h', value: -20, type: 'starting' }], { playerToggle: true });
    const w = world([penalty]);
    let s = state({ stats: [stat('h', { value: 5 })] });
    s = acquireTrait(s, penalty, w).state;
    expect(valueOf(s)).toBe(0); // 5 - 20 clamped at the floor: only 5 was actually taken
    for (let i = 0; i < 5; i++) {
      s = setTraitEnabled(s, 'a', false, w).state;
      expect(valueOf(s)).toBe(5);
      s = setTraitEnabled(s, 'a', true, w).state;
      expect(valueOf(s)).toBe(0);
    }
    s = setTraitEnabled(s, 'a', false, w).state;
    expect(valueOf(s)).toBe(5);
  });

  it('honors a change in full when there is room for it', () => {
    const t = trait('a', [{ statId: 'h', value: -20, type: 'starting' }], { playerToggle: true });
    const w = world([t]);
    const start = state({ stats: [stat('h', { value: 50 })] });
    const on = acquireTrait(start, t, w).state;
    expect(valueOf(on)).toBe(30);
    expect(valueOf(setTraitEnabled(on, 'a', false, w).state)).toBe(50);
  });

  it('restores a value the shrinking maximum forced down', () => {
    const t = trait('a', [{ statId: 'h', value: -60, type: 'max' }], { playerToggle: true });
    const w = world([t]);
    const start = state({ stats: [stat('h', { value: 90 })] });
    const on = acquireTrait(start, t, w).state;
    expect(boundsOf(on).max).toBe(40);
    expect(valueOf(on)).toBe(40);
    const off = setTraitEnabled(on, 'a', false, w).state;
    expect(boundsOf(off).max).toBe(100);
    expect(valueOf(off)).toBe(90);
  });

  it('does not pay out when a cap the trait raised is left behind and taken back up', () => {
    // The ceiling twin of the ratchet: the trait grants headroom, the AI spends it, and the switch-off has
    // to clamp the value down. Switching back on must restore that clamp and nothing more.
    const t = trait('a', [{ statId: 'h', value: 60, type: 'max' }], { playerToggle: true });
    const w = world([t]);
    let s = acquireTrait(state({ stats: [stat('h', { value: 50 })] }), t, w).state;
    expect(boundsOf(s).max).toBe(160);
    // The AI spends the new headroom.
    s = { ...s, stats: s.stats.map((x) => ({ ...x, value: 120 })) };
    s = setTraitEnabled(s, 'a', false, w).state;
    expect(valueOf(s)).toBe(100); // clamped to the base cap
    s = setTraitEnabled(s, 'a', true, w).state;
    expect(valueOf(s)).toBe(120); // exactly what the clamp took, not a ride to the new cap
  });

  it('falls back to negating the authored change for a trait with no record', () => {
    const t = trait('a', [{ statId: 'h', value: -20, type: 'starting' }], { playerToggle: true });
    // A save written before movement was recorded: the trait is active, appliedValues is empty.
    const legacy = state({ stats: [stat('h', { value: 30 })], traits: [t] });
    const off = setTraitEnabled(legacy, 'a', false, world([t])).state;
    expect(valueOf(off)).toBe(50);
  });

  it('writes a proper record on re-apply, so a legacy save heals itself', () => {
    const t = trait('a', [{ statId: 'h', value: -20, type: 'starting' }], { playerToggle: true });
    const w = world([t]);
    const legacy = state({ stats: [stat('h', { value: 5 })], traits: [t] });
    const off = setTraitEnabled(legacy, 'a', false, w).state;
    const on = setTraitEnabled(off, 'a', true, w).state;
    expect(on.appliedValues.a).toBeDefined();
    expect(valueOf(setTraitEnabled(on, 'a', false, w).state)).toBe(valueOf(off));
  });
});

describe('order independence', () => {
  it('combines two changes on one stat to the same result whichever order they are written in', () => {
    const forward = trait('a', [
      { statId: 'h', value: -80, type: 'starting' },
      { statId: 'h', value: 60, type: 'starting' },
    ], { playerToggle: true });
    const reversed = trait('a', [
      { statId: 'h', value: 60, type: 'starting' },
      { statId: 'h', value: -80, type: 'starting' },
    ], { playerToggle: true });
    const start = state({ stats: [stat('h', { value: 50 })] });
    const a = acquireTrait(start, forward, world([forward])).state;
    const b = acquireTrait(start, reversed, world([reversed])).state;
    expect(valueOf(a)).toBe(30);
    expect(valueOf(b)).toBe(30);
  });
});

describe('untyped stat changes', () => {
  it('leaves the value alone, the same way the bounds ignore it', () => {
    const untyped = trait('a', [{ statId: 'h', value: 25 }], { playerToggle: true });
    const next = acquireTrait(state(), untyped, world([untyped])).state;
    expect(valueOf(next)).toBe(50);
    expect(boundsOf(next)).toEqual({ min: 0, max: 100, regen: 0 });
  });
});

describe('exclusive groups', () => {
  const group: TraitGroup = { id: 'g', name: 'Origin', parentId: null, exclusive: true };
  const chosen = trait('a', [{ statId: 'h', value: 10, type: 'starting' }], { groupId: 'g', playerToggle: true });
  const rival = trait('b', [{ statId: 'h', value: -5, type: 'starting' }], { groupId: 'g', playerToggle: true });
  const w = world([chosen, rival], [group]);

  it('retires the chosen sibling when a never-chosen member is switched on', () => {
    const start = acquireTrait(state(), chosen, w).state;
    expect(valueOf(start)).toBe(60);
    const { state: next, retired } = acquireTrait(start, rival, w);
    expect(retired.map((t) => t.id)).toEqual(['a']);
    expect(next.disabledTraitIds).toEqual(['a']);
    expect(valueOf(next)).toBe(45); // the chosen sibling's +10 handed back, then the rival's -5
  });

  it('allows the group to be left with nothing active', () => {
    const on = acquireTrait(state(), chosen, w).state;
    const off = setTraitEnabled(on, 'a', false, w).state;
    expect(activeTraits(off.traits, off.disabledTraitIds)).toEqual([]);
    expect(valueOf(off)).toBe(50);
  });
});

describe('listablePlayerTraits', () => {
  const groups: TraitGroup[] = [];
  const first = trait('first', [], { playerToggle: true });
  const middle = trait('middle', [], { playerToggle: false });
  const last = trait('last', [], { playerToggle: true });
  const authored = [first, middle, last];
  const order = traitOrderIndex(authored, groups);

  it('interleaves held and acquirable traits in authored order', () => {
    expect(listablePlayerTraits([last], authored, order).map((t) => t.id)).toEqual(['first', 'last']);
  });

  it('omits a non-toggleable trait the player never chose', () => {
    expect(listablePlayerTraits([], authored, order).map((t) => t.id)).not.toContain('middle');
  });

  it('keeps a held non-toggleable trait listed', () => {
    expect(listablePlayerTraits([middle], authored, order).map((t) => t.id)).toEqual(['first', 'middle', 'last']);
  });
});
