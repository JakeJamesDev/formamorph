/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import { runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { StatCodeBearers } from './statCodeTraits';
import { activeTraits, settleTraits, type TraitRuntimeState, type TraitWorld } from './traitRuntime';
import { WORLD_OWNER } from './traitGates';
import type { PlayerStat, Trait } from '@/types';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

const turn = (over: Partial<StatCodeTurn> & Pick<StatCodeTurn, 'stats' | 'bearers'>): StatCodeTurn => ({
  enabled: {}, previous: over.stats, asks: [], regenApplied: {}, clock: {},
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
});

const valueOf = (stats: readonly PlayerStat[], id: string) => stats.find((s) => s.id === id)?.value;

// Spark has no effects of its own; code switching it on makes a mid-run settle.
const spark: Trait = { id: 'spark', name: 'Spark', statChanges: [] };
// Berserk holds while Rage is 80 or more and raises Focus by 10. It cascaded off before this turn.
const berserk: Trait = {
  id: 'berserk', name: 'Berserk', statChanges: [{ statId: 'focus', value: 10, type: 'starting' }],
  requires: [{ all: [{ kind: 'stat', id: 'rage', operator: '>=', value: 80, unit: 'raw' }] }],
};
const world: TraitWorld = { traits: [spark, berserk], groups: [] };
const bearers: StatCodeBearers = {
  acquired: [berserk], disabledTraitIds: ['berserk'], appliedValues: { berserk: { focus: -10 } },
  cascadeOffTraitIds: { [WORLD_OWNER]: ['berserk'] }, world,
};

describe('the stat snapshot a run settles against', () => {
  // The asks left Rage at 70; Rage's code raises it to 85 and switches Spark on.
  const stats = [
    stat({ id: 'rage', name: 'Rage', value: 70, code: 'self.value = 85; traits.Spark.enabled = true;' }),
    stat({ id: 'focus', name: 'Focus', value: 50 }),
  ];

  it('settles the code switch against the stats with the code writes landed', async () => {
    const out = await runStatCodeTurn(turn({ stats, bearers }));
    expect(out.gateStats[WORLD_OWNER].rage.value).toBe(85);
    expect(activeTraits(out.traits!.acquired, out.traits!.disabledTraitIds).map((t) => t.id)).toEqual(['berserk', 'spark']);
    expect(out.traits!.cascadeOffTraitIds).toEqual({});
    expect(valueOf(out.stats, 'focus')).toBe(60);
    expect(valueOf(out.stats, 'rage')).toBe(85);
    // Guard: read live at the switch, Rage still stood at 70 and Berserk stayed off.
    const atSwitch: TraitRuntimeState = {
      stats, traits: [berserk, spark], disabledTraitIds: ['berserk'], appliedValues: bearers.appliedValues,
      cascadeOffTraitIds: bearers.cascadeOffTraitIds,
    };
    const live = settleTraits(atSwitch, world).state;
    expect(activeTraits(live.traits, live.disabledTraitIds).map((t) => t.id)).toEqual(['spark']);
  });

  it('hands the final settle the same snapshot, so it moves nothing more', async () => {
    const out = await runStatCodeTurn(turn({ stats, bearers }));
    const after: TraitRuntimeState = {
      stats: [...out.stats], traits: out.traits!.acquired, disabledTraitIds: out.traits!.disabledTraitIds,
      appliedValues: out.traits!.appliedValues, cascadeOffTraitIds: out.traits!.cascadeOffTraitIds,
    };
    expect(settleTraits(after, { ...world, gateStats: out.gateStats }).state).toBe(after);
  });

  it('lands the starvation penalty on a stat code leaves alone, and not on one it moves', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'health', name: 'Health', value: 52 }), stat({ id: 'b', name: 'B', value: 40, code: 'return 30;' }), stat({ id: 'low', value: 2 })],
      bearers: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } },
      penalties: { health: 5, b: 5, low: 5 },
    }));
    expect(out.gateStats[WORLD_OWNER].health.value).toBe(47);
    expect(out.gateStats[WORLD_OWNER].b.value).toBe(30);
    // Clamped into the bounds, as the penalty's own updater clamps.
    expect(out.gateStats[WORLD_OWNER].low.value).toBe(0);
    // The run's stats leave the penalty to its own updater.
    expect(valueOf(out.stats, 'health')).toBe(52);
  });

  it('keeps the owners the run does not land, and lands the entities it runs', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'rage', name: 'Rage', value: 70 })],
      bearers: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } },
      owners: [{ id: 'ash', stats: [stat({ id: 'hunger', name: 'Hunger', value: 10, code: 'return 75;' })], enabled: {}, previous: [], regenApplied: {} }],
      gateStats: { bram: { grit: { name: 'Grit', value: 33, min: 0, max: 100 } }, [WORLD_OWNER]: {} },
    }));
    expect(out.gateStats.bram.grit.value).toBe(33);
    expect(out.gateStats.ash.hunger.value).toBe(75);
    expect(out.gateStats[WORLD_OWNER].rage.value).toBe(70);
  });

  it("lets code read a stat gate's state through available", async () => {
    const read = (rage: number) => runStatCodeTurn(turn({
      stats: [stat({ id: 'rage', name: 'Rage', value: rage }), stat({ id: 'probe', name: 'Probe', value: 5, code: 'return traits.Berserk.available ? 1 : 0;' })],
      bearers,
    }));
    expect(valueOf((await read(85)).stats, 'probe')).toBe(1);
    expect(valueOf((await read(70)).stats, 'probe')).toBe(0);
  });
});
