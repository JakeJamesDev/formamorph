import { describe, it, expect } from 'vitest';
import {
  acquireTrait,
  activeTraits,
  applyCodeTraitSwitches,
  applyPlayedStatTraits,
  deriveEffectiveStats,
  heldPlayerTraits,
  listablePlayerTraits,
  recoverStatBases,
  seedStatBases,
  setTraitEnabled,
  settleTraits,
  startingStatsWith,
  statTraitsInForce,
  switchPersonaStats, startingTraitLog,
  switchPlayerTrait,
  traitGateInput,
  traitNameIn,
  traitSwitchLog,
  withCodeBounds,
  type TraitRuntimeState,
  type TraitWorld,
} from './traitRuntime';
import { traitOrderIndex } from './traitEffects';
import type { PersonaRef, PlayerStat, StatChange, Trait, TraitGroup } from '@/types';

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

describe('deriveEffectiveStats with code bounds', () => {
  const raise = trait('a', [
    { statId: 'h', value: 20, type: 'max' },
    { statId: 'h', value: 10, type: 'min' },
    { statId: 'h', value: 2, type: 'regen' },
  ]);

  it('lets each code bound replace the derived result for its field', () => {
    const coded = stat('h', { aiMaxDelta: 15, codeBounds: { min: 5, max: 60, regen: -1 } });
    expect(deriveEffectiveStats([coded], [raise])[0]).toMatchObject({ min: 5, max: 60, regen: -1 });
  });

  it('derives a field the code did not set from the bases and traits', () => {
    const coded = stat('h', { aiMaxDelta: 15, codeBounds: { max: 60 } });
    expect(deriveEffectiveStats([coded], [raise])[0]).toMatchObject({ min: 10, max: 60, regen: 2 });
  });

  it('floors a code max at the effective min', () => {
    expect(deriveEffectiveStats([stat('h', { codeBounds: { min: 70, max: 40 } })], [])[0]).toMatchObject({ min: 70, max: 70 });
    expect(deriveEffectiveStats([stat('h', { codeBounds: { max: 5 } })], [raise])[0]).toMatchObject({ min: 10, max: 10 });
  });

  it('returns to the derived cap, AI max delta included, once the code bound is gone', () => {
    const [coded] = deriveEffectiveStats([stat('h', { aiMaxDelta: 15, codeBounds: { max: 60 } })], []);
    expect(coded.max).toBe(60);
    const { codeBounds: _cleared, ...rest } = coded;
    expect(deriveEffectiveStats([rest], [])[0].max).toBe(115);
  });

  it('keeps a code bound through a trait switch, and settles the value inside it', () => {
    const before = state({ stats: [stat('h', { value: 60, min: 0, max: 60, codeBounds: { max: 60 } })] });
    const on = setTraitEnabled({ ...before, traits: [raise] }, 'a', true, world([raise])).state;
    expect(boundsOf(on)).toEqual({ min: 10, max: 60, regen: 2 });
    expect(on.stats[0].codeBounds).toEqual({ max: 60 });
    const off = setTraitEnabled(on, 'a', false, world([raise])).state;
    expect(boundsOf(off)).toEqual({ min: 0, max: 60, regen: 0 });
    expect(valueOf(off)).toBeLessThanOrEqual(60);
  });
});

describe('withCodeBounds', () => {
  const raiseCap = trait('a', [{ statId: 'h', value: 20, type: 'max' }]);
  const base = stat('h', { value: 90, max: 120 });

  it('holds exactly the given code bounds, re-derives under the traits, and clamps the value', () => {
    const next = withCodeBounds({ ...base, codeBounds: { min: 3 } }, { max: 60 }, 90, [raiseCap]);
    expect(next).toMatchObject({ min: 0, max: 60, value: 60 });
    expect(next.codeBounds).toEqual({ max: 60 });
  });

  it('drops the field and returns to the derived bounds, traits included, when given none', () => {
    const next = withCodeBounds({ ...base, max: 60, codeBounds: { max: 60 } }, {}, 50, [raiseCap]);
    expect(next).toMatchObject({ max: 120, value: 50 });
    expect('codeBounds' in next).toBe(false);
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
  const group: TraitGroup = { id: 'g', name: 'Origin', parentId: null, maxPicks: 1 };
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

describe('applyCodeTraitSwitches', () => {
  const group: TraitGroup = { id: 'g', name: 'Origin', parentId: null, maxPicks: 1 };
  const noble = trait('noble', [{ statId: 'h', value: 10, type: 'starting' }], { groupId: 'g' });
  const outcast = trait('outcast', [], { groupId: 'g' });
  const w = world([noble, outcast], [group]);

  it('logs the switch and each retired sibling with the player-switch wording, attributed to the stat', () => {
    const start = acquireTrait(state(), noble, w).state;
    const { log } = applyCodeTraitSwitches(start, [{ traitId: 'outcast', enabled: true, by: 'Health' }], w);
    expect(log).toEqual(['Trait switched off: noble (by Health)', 'Acquired trait: outcast (by Health)']);
  });

  it('names each trait through the resolver it is given', () => {
    const { log } = applyCodeTraitSwitches(state(), [{ traitId: 'noble', enabled: true, by: 'Health' }], w, (t) => t.id.toUpperCase());
    expect(log).toEqual(['Acquired trait: NOBLE (by Health)']);
  });

  it('skips a switch to the state the trait already holds, so a recorded movement is not reversed twice', () => {
    const off = setTraitEnabled(acquireTrait(state(), noble, w).state, 'noble', false, w).state;
    const { state: next, log } = applyCodeTraitSwitches(off, [{ traitId: 'noble', enabled: false, by: 'Health' }], w);
    expect(next).toBe(off);
    expect(log).toEqual([]);
  });
});

describe('gates in play', () => {
  // Paladin opens Plate, Plate opens Aura. Plate and Robes share an exclusive Armor group.
  const armor: TraitGroup = { id: 'armor', name: 'Armor', parentId: null, maxPicks: 1 };
  const paladin = trait('paladin', [{ statId: 'h', value: 10, type: 'starting' }], { playerToggle: true });
  const plate = trait('plate', [{ statId: 'h', value: 20, type: 'max' }, { statId: 'h', value: 15, type: 'starting' }], {
    playerToggle: true, groupId: 'armor', requires: [{ kind: 'trait', id: 'paladin' }],
  });
  const robes = trait('robes', [], { playerToggle: true, groupId: 'armor' });
  const aura = trait('aura', [{ statId: 'h', value: 5, type: 'starting' }], { playerToggle: true, requires: [{ kind: 'trait', id: 'plate' }] });
  const royal = trait('royal', [{ statId: 'h', value: -8, type: 'starting' }], { requires: [{ kind: 'playingAs', id: 'aldric' }] });
  const traits = [paladin, plate, robes, aura, royal];
  const aldric = { id: 'aldric', name: 'Sir Aldric', persona: true };
  const gated = (persona: PersonaRef = { source: 'none' }): TraitWorld =>
    ({ traits, groups: [armor], entities: [aldric], persona });
  const name = (t: Trait) => t.name;
  const on = (s: TraitRuntimeState) => activeTraits(s.traits, s.disabledTraitIds).map((t) => t.id);
  const player = (s: TraitRuntimeState, id: string, enabled: boolean, w = gated()) => {
    const result = switchPlayerTrait(s, id, enabled, w, name);
    if (!result) throw new Error(`switch of ${id} refused`);
    return result;
  };
  // Resting near the cap, so Plate's raise and the clamps both matter to the reversal.
  const armored = () => {
    let s = state({ stats: [stat('h', { value: 90 })] });
    for (const id of ['paladin', 'plate', 'aura']) s = player(s, id, true).state;
    return s;
  };

  it('turns dependents off first when a prerequisite goes, and reverses their stats honestly', () => {
    const start = armored();
    expect(valueOf(start)).toBe(120);
    const { state: next, log, cascade } = player(start, 'paladin', false);
    expect(on(next)).toEqual([]);
    expect(cascade.map((t) => t.id)).toEqual(['aura', 'plate']);
    expect(log).toEqual(['Trait switched off: paladin', 'Trait switched off: aura', 'Trait switched off: plate']);
    expect(valueOf(next)).toBe(90);
    expect(boundsOf(next)).toEqual({ min: 0, max: 100, regen: 0 });
    expect(next.cascadeOffTraitIds).toEqual({ world: ['aura', 'plate'] });
  });

  it('returns cascade-off traits once the gate holds again, and toggling stays neutral', () => {
    let s = armored();
    const armoredStats = s.stats;
    for (let i = 0; i < 3; i++) {
      s = player(s, 'paladin', false).state;
      const back = player(s, 'paladin', true);
      s = back.state;
      expect(back.log).toEqual(['Trait switched on: paladin', 'Trait switched on: plate', 'Trait switched on: aura']);
      expect(back.cascade).toEqual([]);
    }
    expect(on(s)).toEqual(['paladin', 'plate', 'aura']);
    expect(s.stats).toEqual(armoredStats);
    expect(s.cascadeOffTraitIds).toEqual({});
  });

  it('never returns a trait the player switched off by hand', () => {
    let s = player(armored(), 'plate', false).state;
    expect(on(s)).toEqual(['paladin']);
    expect(s.cascadeOffTraitIds).toEqual({ world: ['aura'] });
    s = player(s, 'paladin', false).state;
    s = player(s, 'paladin', true).state;
    expect(on(s)).toEqual(['paladin']);
  });

  it('keeps a cascade-off trait off once the player picks its exclusive sibling, and drops it from the list', () => {
    let s = player(armored(), 'paladin', false).state;
    s = player(s, 'robes', true).state;
    s = player(s, 'paladin', true).state;
    expect(on(s)).toEqual(['paladin', 'robes']);
    expect(s.cascadeOffTraitIds).toEqual({ world: ['aura'] });
    s = player(s, 'robes', false).state;
    expect(on(s)).toEqual(['paladin']);
  });

  it('refuses the player a switch-on of a locked trait', () => {
    expect(switchPlayerTrait(state(), 'plate', true, gated(), name)).toBeNull();
  });

  it('refuses the player a switch-on in a full group with a max above one, and allows it once a pick is dropped', () => {
    const skills: TraitGroup = { id: 'skills', name: 'Skills', parentId: null, maxPicks: 2 };
    const picks = ['archery', 'stealth', 'lore'].map((id) => trait(id, [], { playerToggle: true, groupId: 'skills' }));
    const w: TraitWorld = { traits: picks, groups: [skills] };
    let s = player(player(state(), 'archery', true, w).state, 'stealth', true, w).state;
    expect(switchPlayerTrait(s, 'lore', true, w, name)).toBeNull();
    s = player(s, 'stealth', false, w).state;
    expect(on(player(s, 'lore', true, w).state)).toEqual(['archery', 'lore']);
  });

  it('refuses the player a switch-off that drops a group below its minimum, and allows it once another pick joins', () => {
    const skills: TraitGroup = { id: 'skills', name: 'Skills', parentId: null, minPicks: 2 };
    const picks = ['archery', 'stealth', 'lore'].map((id) => trait(id, [], { playerToggle: true, groupId: 'skills' }));
    const w: TraitWorld = { traits: picks, groups: [skills] };
    let s = player(player(state(), 'archery', true, w).state, 'stealth', true, w).state;
    expect(switchPlayerTrait(s, 'stealth', false, w, name)).toBeNull();
    s = player(s, 'lore', true, w).state;
    expect(on(player(s, 'stealth', false, w).state)).toEqual(['archery', 'lore']);
  });

  it('lets stat code switch off a trait below its group minimum', () => {
    const skills: TraitGroup = { id: 'skills', name: 'Skills', parentId: null, minPicks: 1 };
    const archery = trait('archery', [], { playerToggle: true, groupId: 'skills' });
    const w: TraitWorld = { traits: [archery], groups: [skills] };
    const s = player(state(), 'archery', true, w).state;
    expect(on(applyCodeTraitSwitches(s, [{ traitId: 'archery', enabled: false, by: 'Vigor' }], w).state)).toEqual([]);
  });

  it('lets a cascade leave a group short, and fills it again when the trait returns', () => {
    const w: TraitWorld = { ...gated(), groups: [{ ...armor, minPicks: 1 }] };
    const s = player(player(state(), 'paladin', true, w).state, 'plate', true, w).state;
    expect(switchPlayerTrait(s, 'plate', false, w, name)).toBeNull();
    const short = player(s, 'paladin', false, w);
    expect(short.cascade.map((t) => t.id)).toEqual(['plate']);
    expect(on(short.state)).toEqual([]);
    expect(on(player(short.state, 'paladin', true, w).state)).toEqual(['paladin', 'plate']);
  });

  it('settles a persona change: a playing-as trait leaves with the persona and returns with it', () => {
    let s = state();
    s = applyCodeTraitSwitches(s, [{ traitId: 'royal', enabled: true, by: 'Vigor' }], gated({ source: 'world', entityId: 'aldric' })).state;
    expect(on(s)).toEqual(['royal']);
    expect(valueOf(s)).toBe(42);

    const left = settleTraits(s, gated(), name);
    expect(on(left.state)).toEqual([]);
    expect(left.cascade.map((t) => t.id)).toEqual(['royal']);
    expect(left.log).toEqual(['Trait switched off: royal']);
    expect(valueOf(left.state)).toBe(50);

    const back = settleTraits(left.state, gated({ source: 'world', entityId: 'aldric' }), name);
    expect(on(back.state)).toEqual(['royal']);
    expect(back.log).toEqual(['Trait switched on: royal']);
    expect(valueOf(back.state)).toBe(42);
  });

  it('leaves a settled state as the same object', () => {
    const s = armored();
    expect(settleTraits(s, gated(), name).state).toBe(s);
  });

  describe('a code switch-on of a locked trait', () => {
    it('acquires it and turns it off in the same pass, moving nothing, and lists it to return', () => {
      const { state: next, log } = applyCodeTraitSwitches(state(), [{ traitId: 'plate', enabled: true, by: 'Vigor' }], gated());
      expect(next.traits.map((t) => t.id)).toEqual(['plate']);
      expect(on(next)).toEqual([]);
      expect(log).toEqual(['Acquired trait: plate (by Vigor)', 'Trait switched off: plate (by Vigor)']);
      expect(valueOf(next)).toBe(50);
      expect(boundsOf(next)).toEqual({ min: 0, max: 100, regen: 0 });
      expect(next.cascadeOffTraitIds).toEqual({ world: ['plate'] });

      const back = player(next, 'paladin', true);
      expect(on(back.state)).toEqual(['plate', 'paladin']);
      expect(valueOf(back.state)).toBe(75);
    });

    it('retires no exclusive sibling', () => {
      const withRobes = player(state(), 'robes', true).state;
      const { state: next } = applyCodeTraitSwitches(withRobes, [{ traitId: 'plate', enabled: true, by: 'Vigor' }], gated());
      expect(on(next)).toEqual(['robes']);
    });

    it('opens once code switches its prerequisite on later in the same run', () => {
      const { state: next } = applyCodeTraitSwitches(state(), [
        { traitId: 'plate', enabled: true, by: 'Vigor' },
        { traitId: 'paladin', enabled: true, by: 'Vigor' },
      ], gated());
      expect(on(next)).toEqual(['plate', 'paladin']);
      expect(next.cascadeOffTraitIds).toEqual({});
    });
  });

  it('cascades a code switch-off with the attribution on every line', () => {
    const { state: next, log } = applyCodeTraitSwitches(armored(), [{ traitId: 'paladin', enabled: false, by: 'Vigor' }], gated());
    expect(on(next)).toEqual([]);
    expect(log).toEqual([
      'Trait switched off: paladin (by Vigor)', 'Trait switched off: aura (by Vigor)', 'Trait switched off: plate (by Vigor)',
    ]);
    expect(valueOf(next)).toBe(90);
  });

  it('takes a cascade-off trait off the list when code switches it off, so it never returns', () => {
    const cascaded = player(armored(), 'paladin', false).state;
    const { state: next } = applyCodeTraitSwitches(cascaded, [{ traitId: 'plate', enabled: false, by: 'Vigor' }], gated());
    expect(next.cascadeOffTraitIds).toEqual({ world: ['aura'] });
    expect(on(player(next, 'paladin', true).state)).toEqual(['paladin']);
  });
});

describe('Always On traits in play', () => {
  // The Cursed Ring brings the Curse, which the player can never switch; Sworn is fixed in the max-one Oath group.
  const ring = trait('ring', [], { playerToggle: true });
  const curse = trait('curse', [{ statId: 'h', value: -10, type: 'starting' }], {
    mode: 'alwaysOn', playerToggle: true, requires: [{ kind: 'trait', id: 'ring' }],
  });
  const oath: TraitGroup = { id: 'oath', name: 'Oath', parentId: null, maxPicks: 1 };
  const sworn = trait('sworn', [], { mode: 'alwaysOn', groupId: 'oath' });
  const free = trait('free', [], { playerToggle: true, groupId: 'oath' });
  const w = world([ring, curse, sworn, free], [oath]);
  const name = (t: Trait) => t.name;
  const on = (s: TraitRuntimeState) => activeTraits(s.traits, s.disabledTraitIds).map((t) => t.id);
  const player = (s: TraitRuntimeState, id: string, enabled: boolean) => {
    const result = switchPlayerTrait(s, id, enabled, w, name);
    if (!result) throw new Error(`switch of ${id} refused`);
    return result;
  };
  // A new game starts with the ungated Always On trait already chosen.
  const start = () => settleTraits(state(), w, name).state;

  it('turns an ungated Always On trait on at the first settle', () => {
    expect(on(start())).toEqual(['sworn']);
  });

  it('brings the curse with its item, lifts it when the item drops, and brings it back, stats and all', () => {
    const cursed = player(start(), 'ring', true);
    expect(on(cursed.state)).toEqual(['sworn', 'ring', 'curse']);
    expect(cursed.log).toEqual(['Acquired trait: ring', 'Trait switched on: curse']);
    expect(valueOf(cursed.state)).toBe(40);
    const lifted = player(cursed.state, 'ring', false);
    expect(on(lifted.state)).toEqual(['sworn']);
    expect(lifted.cascade.map((t) => t.id)).toEqual(['curse']);
    expect(valueOf(lifted.state)).toBe(50);
    expect(lifted.state.cascadeOffTraitIds).toEqual({});
    const again = player(lifted.state, 'ring', true);
    expect(on(again.state)).toEqual(['sworn', 'ring', 'curse']);
    expect(valueOf(again.state)).toBe(40);
  });

  it('refuses the player a switch of an Always On trait in either direction, whatever Player Can Toggle says', () => {
    expect(switchPlayerTrait(start(), 'curse', true, w, name)).toBeNull();
    const cursed = player(start(), 'ring', true).state;
    expect(switchPlayerTrait(cursed, 'curse', false, w, name)).toBeNull();
    expect(switchPlayerTrait(cursed, 'sworn', false, w, name)).toBeNull();
  });

  it('refuses the player a max-one swap that would retire the active Always On trait', () => {
    expect(switchPlayerTrait(start(), 'free', true, w, name)).toBeNull();
  });

  it('skips stat code switches of an Always On trait in both directions (Q30)', () => {
    const s = start();
    const code = applyCodeTraitSwitches(s, [
      { traitId: 'sworn', enabled: false, by: 'Vigor' },
      { traitId: 'curse', enabled: true, by: 'Vigor' },
    ], w, name);
    expect(on(code.state)).toEqual(['sworn']);
    expect(code.log).toEqual([]);
  });

  it('never lists an Always On trait as one the player can take', () => {
    expect(listablePlayerTraits([], [ring, curse], traitOrderIndex([ring, curse], [])).map((t) => t.id)).toEqual(['ring']);
  });

  it('brings an entity’s curse in that entity’s lists, and refuses the player a switch of it', () => {
    const ashTraits = [trait('ring', [], { playerToggle: true }), trait('curse', [], { mode: 'alwaysOn', requires: [{ kind: 'trait', id: 'ring' }] })];
    const owned: TraitWorld = {
      traits: [], groups: [], entities: [{ id: 'ash', name: 'Ash' }],
      bearers: [{ id: 'world', name: '', traits: [], groups: [] }, { id: 'ash', name: 'Ash', traits: ashTraits, groups: [] }],
    };
    const cursed = switchPlayerTrait(state(), 'ring', true, owned, name, 'ash')!;
    expect(cursed.state.ownedTraits).toEqual({ ash: { chosen: ['ring', 'curse'] } });
    expect(switchPlayerTrait(cursed.state, 'curse', false, owned, name, 'ash')).toBeNull();
    const lifted = switchPlayerTrait(cursed.state, 'ring', false, owned, name, 'ash')!;
    expect(lifted.state.ownedTraits).toEqual({ ash: { chosen: ['ring', 'curse'], disabled: ['ring', 'curse'] } });
  });
});

describe('the starting trait log', () => {
  it('logs each starting trait but a Hidden one', () => {
    const traits = [trait('wary', [], { name: 'Wary' }), trait('bond', [], { name: 'Blood Bond', mode: 'hidden' })];
    expect(startingTraitLog(traits, (t) => t.name.toUpperCase())).toEqual(['Applied trait: WARY']);
  });
});

describe('Hidden traits in play', () => {
  // The Cursed Ring brings a Hidden curse: its stats move, but no log line or banner names it.
  const ring = trait('ring', [], { playerToggle: true });
  const curse = trait('curse', [{ statId: 'h', value: -10, type: 'starting' }], {
    mode: 'hidden', requires: [{ kind: 'trait', id: 'ring' }],
  });
  const w = world([ring, curse]);
  const name = (t: Trait) => t.name;
  const on = (s: TraitRuntimeState) => activeTraits(s.traits, s.disabledTraitIds).map((t) => t.id);

  it('applies its stats as it turns on and off, and leaves it out of the log and the banner', () => {
    const cursed = switchPlayerTrait(state(), 'ring', true, w, name)!;
    expect(on(cursed.state)).toEqual(['ring', 'curse']);
    expect(valueOf(cursed.state)).toBe(40);
    expect(cursed.log).toEqual(['Acquired trait: ring']);
    const lifted = switchPlayerTrait(cursed.state, 'ring', false, w, name)!;
    expect(on(lifted.state)).toEqual([]);
    expect(valueOf(lifted.state)).toBe(50);
    expect(lifted.log).toEqual(['Trait switched off: ring']);
    expect(lifted.cascade.map((t) => t.id)).toEqual(['curse']);
    expect(lifted.cascadeNames).toEqual([]);
  });

  it('moves a Hidden linked stat trait on a persona switch with no log line', () => {
    const mark = trait('mark', [{ statId: 'h', value: 5, type: 'starting' }], { mode: 'hidden' });
    const linked = (persona: PersonaRef): TraitWorld => ({
      traits: [], groups: [], entities: [{ id: 'albus', name: 'Albus', persona: true }], persona,
      bearers: [{ id: 'world', name: '', traits: [], groups: [] }, { id: 'albus', name: 'Albus', traits: [mark], groups: [] }],
    });
    const asAlbus = linked({ source: 'world', entityId: 'albus' });
    const seeded = applyPlayedStatTraits(state({ ownedTraits: { albus: { chosen: ['mark'] } } }), asAlbus).state;
    const toNone = switchPersonaStats(seeded, asAlbus, linked({ source: 'none' }), name);
    expect(valueOf(toNone.state)).toBe(50);
    expect(toNone.log).toEqual([]);
    const back = switchPersonaStats(toNone.state, linked({ source: 'none' }), asAlbus, name);
    expect(valueOf(back.state)).toBe(55);
    expect(back.log).toEqual([]);
  });
});

describe('owned traits in play', () => {
  // The player's Paladin opens Ash's Loyal (You: Paladin); Ash's Tamed opens the world's Beast Tamer
  // (Ash: Tamed). Tamed and Wild share Ash's exclusive Bond group. Gruff is Ash's but not switchable.
  const paladin = trait('paladin', [], { name: 'Paladin', playerToggle: true });
  const tamer = trait('tamer', [{ statId: 'h', value: 10, type: 'starting' }], {
    name: 'Beast Tamer', playerToggle: true, requires: [{ kind: 'trait', id: 'tamed', bearer: { kind: 'entity', id: 'ash' } }],
  });
  const bond: TraitGroup = { id: 'bond', name: 'Bond', parentId: null, maxPicks: 1 };
  const ashTraits = [
    trait('tamed', [], { name: 'Tamed', playerToggle: true, groupId: 'bond' }),
    trait('wild', [], { name: 'Wild', playerToggle: true, groupId: 'bond' }),
    trait('loyal', [], { name: 'Loyal', playerToggle: true, requires: [{ kind: 'trait', id: 'paladin', bearer: { kind: 'you' } }] }),
    trait('gruff', [], { name: 'Gruff' }),
  ];
  const ash = { id: 'ash', name: 'Ash', traits: ashTraits, groups: [bond] };
  const owned = (persona: PersonaRef = { source: 'none' }): TraitWorld => ({
    traits: [paladin, tamer], groups: [], entities: [{ id: 'ash', name: 'Ash', persona: true }], persona,
    bearers: [{ id: 'world', name: '', traits: [paladin, tamer], groups: [] }, ash],
  });
  const name = (t: Trait) => t.name;
  const flip = (s: TraitRuntimeState, id: string, enabled: boolean, w = owned()) => {
    const result = switchPlayerTrait(s, id, enabled, w, name);
    if (!result) throw new Error(`switch of ${id} refused`);
    return result;
  };
  const onOf = (s: TraitRuntimeState) => [
    ...activeTraits(s.traits, s.disabledTraitIds).map((t) => t.id),
    ...Object.entries(s.ownedTraits ?? {}).flatMap(([, o]) => o.chosen.filter((id) => !(o.disabled ?? []).includes(id))),
  ];

  it('switches an NPC’s toggleable trait on and off in its entity’s own lists, moving no stat', () => {
    const on = flip(state(), 'tamed', true);
    expect(on.state.ownedTraits).toEqual({ ash: { chosen: ['tamed'] } });
    expect(on.log).toEqual(["Acquired trait: Ash's Tamed"]);
    expect(on.state.stats).toEqual(state().stats);
    const off = flip(on.state, 'tamed', false);
    expect(off.state.ownedTraits).toEqual({ ash: { chosen: ['tamed'], disabled: ['tamed'] } });
    expect(off.log).toEqual(["Trait switched off: Ash's Tamed"]);
    expect(flip(off.state, 'tamed', true).state.ownedTraits).toEqual({ ash: { chosen: ['tamed'] } });
  });

  it('retires the exclusive sibling in the entity’s own group', () => {
    const s = flip(flip(state(), 'tamed', true).state, 'wild', true);
    expect(onOf(s.state)).toEqual(['wild']);
    expect(s.log).toEqual(["Trait switched off: Ash's Tamed", "Acquired trait: Ash's Wild"]);
  });

  it('refuses a locked owned trait and one the author did not make switchable', () => {
    expect(switchPlayerTrait(state(), 'loyal', true, owned(), name)).toBeNull();
    expect(switchPlayerTrait(state(), 'gruff', true, owned(), name)).toBeNull();
  });

  it('refuses an owned switch-on in a full entity group with a max above one', () => {
    const calm = trait('calm', [], { name: 'Calm', playerToggle: true, groupId: 'bond' });
    const wide = { ...ash, traits: [...ashTraits, calm], groups: [{ ...bond, maxPicks: 2 }] };
    const w: TraitWorld = { ...owned(), entities: owned().entities ?? [], bearers: [owned().bearers![0], wide] };
    const full = flip(flip(state(), 'tamed', true, w).state, 'wild', true, w).state;
    expect(onOf(full)).toEqual(['tamed', 'wild']);
    expect(switchPlayerTrait(full, 'calm', true, w, name)).toBeNull();
  });

  it('refuses an owned switch-off that drops an entity group below its minimum', () => {
    const w: TraitWorld = { ...owned(), entities: owned().entities ?? [], bearers: [owned().bearers![0], { ...ash, groups: [{ ...bond, minPicks: 1 }] }] };
    const s = flip(state(), 'tamed', true, w).state;
    expect(switchPlayerTrait(s, 'tamed', false, w, name)).toBeNull();
    expect(onOf(flip(s, 'wild', true, w).state)).toEqual(['wild']);
  });

  it('cascades across owners both ways, and returns what the cascade turned off', () => {
    let s = flip(flip(state(), 'paladin', true).state, 'loyal', true).state;
    s = flip(flip(s, 'tamed', true).state, 'tamer', true).state;
    expect(valueOf(s)).toBe(60);

    const noPaladin = flip(s, 'paladin', false);
    expect(noPaladin.cascade.map((t) => t.id)).toEqual(['loyal']);
    expect(noPaladin.cascadeNames).toEqual(["Ash's Loyal"]);
    expect(noPaladin.state.cascadeOffTraitIds).toEqual({ ash: ['loyal'] });

    const wild = flip(noPaladin.state, 'wild', true);
    expect(wild.cascadeNames).toEqual(['Beast Tamer']);
    expect(valueOf(wild.state)).toBe(50);
    expect(onOf(wild.state)).toEqual(['wild']);

    const back = flip(flip(wild.state, 'paladin', true).state, 'tamed', true);
    expect(onOf(back.state)).toEqual(['paladin', 'tamer', 'loyal', 'tamed']);
    expect(valueOf(back.state)).toBe(60);
    expect(back.state.cascadeOffTraitIds).toEqual({});
  });

  it('names the played entity’s own traits bare, as the player’s', () => {
    const asAsh = owned({ source: 'world', entityId: 'ash' });
    expect(flip(state(), 'tamed', true, asAsh).log).toEqual(['Acquired trait: Tamed']);
    expect(traitNameIn(asAsh, 'tamed', name)).toBe('Tamed');
    expect(traitNameIn(owned(), 'tamed', name)).toBe("Ash's Tamed");
    expect(traitNameIn(owned(), 'paladin', name)).toBe('Paladin');
    expect(traitNameIn(owned(), 'gone', name)).toBeNull();
  });

  it('cascades an owned trait off when stat code switches its prerequisite off', () => {
    const s = flip(flip(state(), 'paladin', true).state, 'loyal', true).state;
    const { state: next, log } = applyCodeTraitSwitches(s, [{ traitId: 'paladin', enabled: false, by: 'Vigor' }], owned(), name);
    expect(onOf(next)).toEqual([]);
    expect(log).toEqual(['Trait switched off: Paladin (by Vigor)', "Trait switched off: Ash's Loyal (by Vigor)"]);
    expect(next.cascadeOffTraitIds).toEqual({ ash: ['loyal'] });
  });
});

describe('linked stat traits follow whoever the player plays', () => {
  // Paladin (+10 max, +5 starting on h) is a Blueprints original; Albus and Mira both link it. Vigil is the
  // player's own world trait with the same effects, so a root row and a link row can hold one original.
  const paladin = trait('paladin', [{ statId: 'h', value: 10, type: 'max' }, { statId: 'h', value: 5, type: 'starting' }], {
    name: 'Paladin', playerToggle: true,
  });
  const vigil = trait('vigil', [{ statId: 'h', value: 3, type: 'starting' }], { name: 'Vigil', playerToggle: true });
  const albus = { id: 'albus', name: 'Albus', traits: [paladin], groups: [] };
  const mira = { id: 'mira', name: 'Mira', traits: [paladin], groups: [] };
  const linked = (persona: PersonaRef = { source: 'none' }): TraitWorld => ({
    traits: [vigil], groups: [], entities: [{ id: 'albus', name: 'Albus', persona: true }, { id: 'mira', name: 'Mira', persona: true }], persona,
    bearers: [{ id: 'world', name: '', traits: [vigil], groups: [] }, albus, mira],
  });
  const asAlbus = linked({ source: 'world', entityId: 'albus' });
  const asMira = linked({ source: 'world', entityId: 'mira' });
  const bothPaladins = state({ ownedTraits: { albus: { chosen: ['paladin'] }, mira: { chosen: ['paladin'] } } });
  const name = (t: Trait) => t.name;

  it('applies the played persona’s active linked stat traits at the start, under its own record key', () => {
    const { state: seeded, applied } = applyPlayedStatTraits(bothPaladins, asAlbus);
    expect(applied.map((t) => t.id)).toEqual(['paladin']);
    expect(boundsOf(seeded)).toEqual({ min: 0, max: 110, regen: 0 });
    expect(valueOf(seeded)).toBe(55);
    expect(seeded.appliedValues).toEqual({ 'albus/paladin': { h: 5 } });
    expect(applyPlayedStatTraits(bothPaladins, linked()).state).toBe(bothPaladins);
  });

  it('reverses the old persona’s linked stats and applies the new one’s on a switch, with the switch log lines', () => {
    const seeded = applyPlayedStatTraits(bothPaladins, asAlbus).state;
    const toMira = switchPersonaStats(seeded, asAlbus, asMira, name);
    expect(toMira.log).toEqual(['Trait switched off: Paladin', 'Trait switched on: Paladin']);
    expect(boundsOf(toMira.state).max).toBe(110);
    expect(valueOf(toMira.state)).toBe(55);
    expect(toMira.state.appliedValues).toEqual({ 'albus/paladin': { h: -5 }, 'mira/paladin': { h: 5 } });
    expect(toMira.state.ownedTraits).toEqual(bothPaladins.ownedTraits);

    const toNone = switchPersonaStats(toMira.state, asMira, linked(), name);
    expect(toNone.log).toEqual(['Trait switched off: Paladin']);
    expect(boundsOf(toNone.state).max).toBe(100);
    expect(valueOf(toNone.state)).toBe(50);
    expect(switchPersonaStats(toNone.state, linked(), linked(), name).state).toBe(toNone.state);
  });

  it('reverses a root trait the new persona is not offered, because its gate names that persona', () => {
    // Squire (+4 starting on h) requires Albus: Paladin. Playing Albus, the player bearer no longer holds it.
    const squire = trait('squire', [{ statId: 'h', value: 4, type: 'starting' }], {
      name: 'Squire', requires: [{ kind: 'trait', id: 'paladin', bearer: { kind: 'entity', id: 'albus' } }],
    });
    const withSquire = (persona: PersonaRef, held: Trait[]): TraitWorld => {
      const base = linked(persona);
      return { ...base, traits: [vigil, squire], entities: base.entities ?? [], bearers: [{ id: 'world', name: '', traits: held, groups: [] }, albus, mira] };
    };
    const asMiraSquire = withSquire({ source: 'world', entityId: 'mira' }, [vigil, squire]);
    const asAlbusNoSquire = withSquire({ source: 'world', entityId: 'albus' }, [vigil]);
    const holding = { ...state({ traits: [squire] }), appliedValues: { squire: { h: 4 } }, stats: [stat('h', { value: 54 })] };
    const toAlbus = switchPersonaStats(holding, asMiraSquire, asAlbusNoSquire, name);
    expect(toAlbus.log).toEqual(['Trait switched off: Squire']);
    expect(valueOf(toAlbus.state)).toBe(50);
    expect(toAlbus.state.appliedValues).toEqual({ squire: { h: -4 } });
    expect(switchPersonaStats(toAlbus.state, asAlbusNoSquire, asMiraSquire, name).log).toEqual(['Trait switched on: Squire']);
  });

  it('reverses what actually moved, so a cap the switch clamped gives back only what it gave', () => {
    const nearCap = { ...bothPaladins, stats: [stat('h', { value: 100, max: 100 })] };
    const seeded = applyPlayedStatTraits(nearCap, asAlbus).state;
    // The cap rides up with the value on it, then the starting bonus lands: 100 → 110 → 110 (clamped +5).
    expect(valueOf(seeded)).toBe(110);
    const away = switchPersonaStats(seeded, asAlbus, linked(), name).state;
    expect(valueOf(away)).toBe(100);
    expect(boundsOf(away).max).toBe(100);
  });

  it('moves the stats when the played persona switches its linked stat trait, and not when a cast entity does', () => {
    const cast = switchPlayerTrait(state(), 'paladin', true, linked(), name, 'mira')!;
    expect(valueOf(cast.state)).toBe(50);
    expect(boundsOf(cast.state).max).toBe(100);
    expect(cast.state.appliedValues).toEqual({});
    expect(cast.log).toEqual(["Acquired trait: Mira's Paladin"]);

    const own = switchPlayerTrait(state(), 'paladin', true, asMira, name, 'mira')!;
    expect(valueOf(own.state)).toBe(55);
    expect(boundsOf(own.state).max).toBe(110);
    expect(own.state.appliedValues).toEqual({ 'mira/paladin': { h: 5 } });
    expect(own.log).toEqual(['Acquired trait: Paladin']);
    const off = switchPlayerTrait(own.state, 'paladin', false, asMira, name, 'mira')!;
    expect(valueOf(off.state)).toBe(50);
    expect(boundsOf(off.state).max).toBe(100);
  });

  it('routes a switch to the bearer whose row it came from when two bearers hold one original', () => {
    const w = linked();
    const onMira = switchPlayerTrait(state(), 'paladin', true, w, name, 'mira')!.state;
    expect(onMira.ownedTraits).toEqual({ mira: { chosen: ['paladin'] } });
    expect(switchPlayerTrait(onMira, 'paladin', true, w, name, 'albus')!.state.ownedTraits)
      .toEqual({ mira: { chosen: ['paladin'] }, albus: { chosen: ['paladin'] } });
    expect(switchPlayerTrait(state(), 'paladin', true, w, name, 'world')).toBeNull();
    expect(switchPlayerTrait(state(), 'vigil', true, w, name, 'mira')).toBeNull();
    expect(traitNameIn(w, 'paladin', name, 'albus')).toBe("Albus's Paladin");
    expect(traitNameIn(w, 'vigil', name, 'world')).toBe('Vigil');
  });

  it('counts the played persona’s linked stat traits among the traits in force', () => {
    const s = { ...bothPaladins, traits: [vigil] };
    expect(statTraitsInForce(s, asAlbus).map((t) => t.id)).toEqual(['vigil', 'paladin']);
    expect(statTraitsInForce(s, linked()).map((t) => t.id)).toEqual(['vigil']);
    expect(statTraitsInForce({ ...s, ownedTraits: { albus: { chosen: ['paladin'], disabled: ['paladin'] } } }, asAlbus).map((t) => t.id)).toEqual(['vigil']);
  });

  it('retires the exclusive sibling on the played persona’s linked group, reversing its stats through its record', () => {
    // Albus links an exclusive Classes group: Paladin (+10 max, +5 starting) and Wizard (+3 starting).
    const wizard = trait('wizard', [{ statId: 'h', value: 3, type: 'starting' }], { name: 'Wizard', playerToggle: true, groupId: 'classes' });
    const classes: TraitGroup = { id: 'classes', name: 'Classes', parentId: null, maxPicks: 1 };
    const albusClasses = { id: 'albus', name: 'Albus', traits: [{ ...paladin, groupId: 'classes' }, wizard], groups: [classes] };
    const w: TraitWorld = { ...asAlbus, entities: asAlbus.entities ?? [], bearers: [{ id: 'world', name: '', traits: [vigil], groups: [] }, albusClasses] };
    const seeded = applyPlayedStatTraits(state({ ownedTraits: { albus: { chosen: ['paladin'] } } }), w).state;
    expect(valueOf(seeded)).toBe(55);
    const swapped = switchPlayerTrait(seeded, 'wizard', true, w, name, 'albus')!;
    expect(swapped.log).toEqual(['Trait switched off: Paladin', 'Acquired trait: Wizard']);
    expect(swapped.state.ownedTraits).toEqual({ albus: { chosen: ['paladin', 'wizard'], disabled: ['paladin'] } });
    expect(boundsOf(swapped.state).max).toBe(100);
    expect(valueOf(swapped.state)).toBe(53);
    expect(swapped.state.appliedValues).toEqual({ 'albus/paladin': { h: -5 }, 'albus/wizard': { h: 3 } });
  });

  it('seeds the Enter World preview with the persona’s linked stat traits after the world picks', () => {
    const authored = [{ ...stat('h'), value: 50 }] as unknown as Parameters<typeof startingStatsWith>[0];
    const plain = startingStatsWith(authored, [vigil], asAlbus);
    expect(plain[0]).toMatchObject({ value: 53, max: 100 });
    const withPaladin = startingStatsWith(authored, [vigil], asAlbus, { albus: ['paladin'] });
    expect(withPaladin[0]).toMatchObject({ value: 58, max: 110 });
  });
});

describe('a Custom Persona pick under a world persona', () => {
  // Wizard is Custom Persona's link (+3 starting on h): the player's own under None, dormant under Albus.
  const wizard = trait('wizard', [{ statId: 'h', value: 3, type: 'starting' }], { name: 'Wizard', playerToggle: true });
  const paladin = trait('paladin', [{ statId: 'h', value: 5, type: 'starting' }], { name: 'Paladin' });
  const albus = { id: 'albus', name: 'Albus', traits: [paladin], groups: [] };
  const under = (persona: PersonaRef): TraitWorld => ({
    traits: [wizard], groups: [], entities: [{ id: 'albus', name: 'Albus', persona: true }], persona,
    bearers: [{ id: 'world', name: '', traits: persona.source === 'world' ? [] : [wizard], groups: [] }, albus],
  });
  const none = under({ source: 'none' });
  const asAlbus = under({ source: 'world', entityId: 'albus' });
  const name = (t: Trait) => t.name;

  it('is held under None and dormant under the world persona, for stats and gates alike', () => {
    const s = state({ traits: [wizard], ownedTraits: { albus: { chosen: ['paladin'] } } });
    expect(heldPlayerTraits([wizard], none).map((t) => t.id)).toEqual(['wizard']);
    expect(heldPlayerTraits([wizard], asAlbus)).toEqual([]);
    expect(statTraitsInForce(s, none).map((t) => t.id)).toEqual(['wizard']);
    expect(statTraitsInForce(s, asAlbus).map((t) => t.id)).toEqual(['paladin']);
    expect(traitGateInput(s, none).active.world).toEqual(['wizard']);
    expect(traitGateInput(s, asAlbus).active.world).toEqual([]);
  });

  it('reverses on a switch from None to the world persona, and returns on the way back', () => {
    const picked = acquireTrait(state(), wizard, none).state;
    expect(valueOf(picked)).toBe(53);
    const withAlbus = { ...picked, ownedTraits: { albus: { chosen: ['paladin'] } } };
    const away = switchPersonaStats(withAlbus, none, asAlbus, name);
    expect(away.log).toEqual(['Trait switched off: Wizard', 'Trait switched on: Paladin']);
    expect(valueOf(away.state)).toBe(55);
    expect(away.state.traits.map((t) => t.id)).toEqual(['wizard']);
    expect(away.state.appliedValues).toEqual({ wizard: { h: -3 }, 'albus/paladin': { h: 5 } });
    const back = switchPersonaStats(away.state, asAlbus, none, name);
    expect(back.log).toEqual(['Trait switched off: Paladin', 'Trait switched on: Wizard']);
    expect(valueOf(back.state)).toBe(53);
  });

  it('is left out of the Enter World preview under the world persona', () => {
    const authored = [{ ...stat('h'), value: 50 }] as unknown as Parameters<typeof startingStatsWith>[0];
    expect(startingStatsWith(authored, [wizard], none)[0].value).toBe(53);
    expect(startingStatsWith(authored, [wizard], asAlbus)[0].value).toBe(50);
    expect(startingStatsWith(authored, [wizard], asAlbus, { albus: ['paladin'] })[0].value).toBe(55);
  });
});

describe('the Custom Persona entity’s stat traits', () => {
  // Paladin is the marked entity's link (+5 starting on h); Oath is a library persona's own (+2).
  const paladin = trait('paladin', [{ statId: 'h', value: 5, type: 'starting' }], { name: 'Paladin', playerToggle: true });
  const oath = trait('oath', [{ statId: 'h', value: 2, type: 'starting' }], { name: 'Oath', playerToggle: true });
  const cp = { id: 'cp', name: 'Newcomer', traits: [paladin], groups: [] };
  const lib = { id: 'lib', name: 'Wren', traits: [oath], groups: [] };
  const entities = [{ id: 'cp', name: 'Newcomer', customPersona: true }, { id: 'albus', name: 'Albus', persona: true }];
  const none: TraitWorld = { traits: [], groups: [], entities, persona: { source: 'none' }, bearers: [{ id: 'world', name: '', traits: [], groups: [] }, cp] };
  const asLib: TraitWorld = { ...none, persona: { source: 'library', entityId: 'lib' }, bearers: [...none.bearers!, lib] };
  const asAlbus: TraitWorld = {
    ...none, persona: { source: 'world', entityId: 'albus' },
    bearers: [{ id: 'world', name: '', traits: [], groups: [] }, { id: 'albus', name: 'Albus', traits: [], groups: [] }],
  };
  const picked = state({ ownedTraits: { cp: { chosen: ['paladin'] }, lib: { chosen: ['oath'] } } });

  it('are in force under None and under a library persona beside its own, and not under a world persona', () => {
    expect(statTraitsInForce(picked, none).map((t) => t.id)).toEqual(['paladin']);
    expect(statTraitsInForce(picked, asLib).map((t) => t.id)).toEqual(['paladin', 'oath']);
    expect(statTraitsInForce(picked, asAlbus)).toEqual([]);
  });

  it('apply at a new game under the marked entity’s own record key', () => {
    const { state: seeded, applied } = applyPlayedStatTraits(picked, asLib);
    expect(applied.map((t) => t.id)).toEqual(['paladin', 'oath']);
    expect(valueOf(seeded)).toBe(57);
    expect(seeded.appliedValues).toEqual({ 'cp/paladin': { h: 5 }, 'lib/oath': { h: 2 } });
  });

  it('move the stats on a switch of the marked entity’s trait, as the played persona’s do', () => {
    const off = switchPlayerTrait(applyPlayedStatTraits(picked, none).state, 'paladin', false, none, undefined, 'cp')!;
    expect(valueOf(off.state)).toBe(50);
    expect(off.state.ownedTraits?.cp).toEqual({ chosen: ['paladin'], disabled: ['paladin'] });
    expect(off.log).toEqual(['Trait switched off: Paladin']);
    const on = switchPlayerTrait(off.state, 'paladin', true, none, undefined, 'cp')!;
    expect(valueOf(on.state)).toBe(55);
  });

  it('reverse on a switch to a world persona and return on the way back', () => {
    const seeded = applyPlayedStatTraits(picked, none).state;
    const away = switchPersonaStats(seeded, none, asAlbus);
    expect(away.log).toEqual(['Trait switched off: Paladin']);
    expect(valueOf(away.state)).toBe(50);
    const back = switchPersonaStats(away.state, asAlbus, none);
    expect(back.log).toEqual(['Trait switched on: Paladin']);
    expect(valueOf(back.state)).toBe(55);
  });
});

describe('traitSwitchLog', () => {
  it('writes the player’s own switch without an attribution', () => {
    expect(traitSwitchLog('Brave', 'on', ['Timid'])).toEqual(['Trait switched off: Timid', 'Trait switched on: Brave']);
    expect(traitSwitchLog('Brave', 'off', [])).toEqual(['Trait switched off: Brave']);
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

describe('traitGateInput', () => {
  it("leaves Blueprints out of the player's gates in play", () => {
    const world: TraitWorld = {
      traits: [
        { id: 'paladin', name: 'Paladin', statChanges: [], groupId: 'blueprints' },
        { id: 'brave', name: 'Brave', statChanges: [], groupId: null },
      ],
      groups: [{ id: 'blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' }],
    };
    const [player] = traitGateInput({ traits: [], disabledTraitIds: [] }, world).owners;
    expect(player.traits.map((t) => t.id)).toEqual(['brave']);
    expect(player.groups).toEqual([]);
  });
});
