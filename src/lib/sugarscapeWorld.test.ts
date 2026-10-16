/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/sugarscape.json?raw';
import { migrateWorld } from './version';
import { resolveOwners, type OwnerWorld } from './owners';
import { settleDefaults, switchTrait, underfills, type SettleResult } from './traitGates';
import { inPlayOwners } from './ownedTraitsInPlay';
import { applyOwnedStatTraits, seedNewGameStats, type TraitRuntimeState, type TraitWorld } from './traitRuntime';
import { ownedTraitStatesFrom } from './ownedTraitState';
import { seedEntityStats } from './entityStats';
import { runStatCodeTurn } from './statCodeTurn';
import type { Entity, PersonaRef, PlayerStat, World } from '@/types';

// Loaded the way the seeder loads it: raw text through the world migration.
const world: World = migrateWorld(JSON.parse(raw));
const NONE: PersonaRef = { source: 'none' };
const cursed: Entity = world.entities.find((e) => e.customPersona)!;
const ownerWorld: OwnerWorld = { traits: world.traits, traitGroups: world.traitGroups ?? [], entities: world.entities };
const { gate } = resolveOwners(ownerWorld, NONE);

const idOf = (name: string): string => {
  const found = cursed.traits!.find((t) => t.name === name);
  if (!found) throw new Error(`no trait ${name}`);
  return found.id;
};
const names = (ids: readonly string[] = []) => ids.map((id) => cursed.traits!.find((t) => t.id === id)?.name ?? id).sort();
const activeOf = (result: SettleResult) => names(result.active.owners[cursed.id]);

/** Switch each named trait on in turn from the default build, as the creator and the in-play toggle do. */
function build(...picks: string[]): SettleResult {
  let state = settleDefaults(gate);
  for (const pick of picks) {
    // A switch toggles, so a pick already on (a default) stays as it is.
    if (state.active.owners[cursed.id]?.includes(idOf(pick))) continue;
    const next = switchTrait({ ...gate, active: state.active }, cursed.id, idOf(pick), state.cascadeOff);
    if (!next) throw new Error(`${pick} would not switch on`);
    state = next;
  }
  return state;
}

describe('the cursed build', () => {
  it('starts as a Nimble Grazer with no Pantry Tricks', () => {
    expect(activeOf(settleDefaults(gate))).toEqual(['Grazer', 'Nimble']);
  });

  it('always holds exactly one Appetite and one Build', () => {
    const start = settleDefaults(gate);
    expect(activeOf(build('Glutton', 'Sturdy'))).toEqual(['Glutton', 'Sturdy']);
    expect(underfills({ ...gate, active: start.active }, cursed.id, idOf('Grazer'))).toBe(true);
    expect(underfills({ ...gate, active: start.active }, cursed.id, idOf('Nimble'))).toBe(true);
  });

  it('takes at most two Pantry Tricks', () => {
    expect(activeOf(build('Iron Stomach', 'Sugar Rush'))).toEqual(['Grazer', 'Iron Stomach', 'Nimble', 'Sugar Rush']);
    expect(() => build('Iron Stomach', 'Sugar Rush', 'Hearty Appetite')).toThrow('would not switch on');
  });
});

const traitWorld: TraitWorld = {
  traits: world.traits, groups: world.traitGroups ?? [], entities: world.entities, persona: NONE, ...inPlayOwners(ownerWorld, NONE),
};
const ownedOf = (state: SettleResult) => ownedTraitStatesFrom({ [cursed.id]: state.active.owners[cursed.id] ?? [] });

/** The cursed's stats after its build's stat changes, with each named stat set to a raw value. */
function cursedStats(state: SettleResult, values: Record<string, number>): PlayerStat[] {
  const seeded: TraitRuntimeState = {
    stats: seedNewGameStats(world.stats), traits: [], disabledTraitIds: [], appliedValues: {},
    ownedTraits: ownedOf(state), entityStats: seedEntityStats(world.entities),
  };
  const started = applyOwnedStatTraits(seeded, traitWorld);
  return started.entityStats![cursed.id].map((s) => (s.name in values ? { ...s, value: values[s.name] } : s));
}

/** Craving after one After the AI run of the hunger script. */
async function cravingAfter(state: SettleResult, values: Record<string, number>) {
  const stats = cursedStats(state, values);
  const out = await runStatCodeTurn({
    stats: [], enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {},
    ownerTraits: {
      acquired: [], disabledTraitIds: [], appliedValues: {}, entities: world.entities, world: traitWorld, ownedTraits: ownedOf(state),
    },
    owners: [{ id: cursed.id, stats, enabled: {}, previous: stats, regenApplied: {} }],
    statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
  });
  return (out.owners?.[cursed.id]?.stats ?? stats).find((s) => s.name === 'Craving')?.value;
}

/** Craving 30 on a comfortable stomach: neither empty nor full. */
const FED = { Craving: 30, Fullness: 40 };

describe('the hunger tick', () => {
  it('climbs a Grazer two steps a turn on a comfortable stomach', async () => {
    expect(await cravingAfter(settleDefaults(gate), FED)).toBe(32);
  });

  it('sets the step by Appetite', async () => {
    expect(await cravingAfter(build('Glutton'), FED)).toBe(35);
    expect(await cravingAfter(build('Iron Will'), FED)).toBe(31);
  });

  it('tilts the step by Pantry Tricks', async () => {
    expect(await cravingAfter(build('Hearty Appetite'), FED)).toBe(31);
    expect(await cravingAfter(build('Sugar Rush'), FED)).toBe(33);
  });

  it('climbs faster on an empty stomach and slower on a full one', async () => {
    expect(await cravingAfter(settleDefaults(gate), { ...FED, Fullness: 5 })).toBe(34);
    expect(await cravingAfter(settleDefaults(gate), { ...FED, Fullness: 80 })).toBe(31);
  });

  it('reads fullness as a share of the Glutton\'s bigger stomach', async () => {
    // Glutton's Fullness tops out at 125, so 80 is 64%: not yet full.
    expect(await cravingAfter(build('Glutton'), { ...FED, Fullness: 80 })).toBe(35);
  });

  it('turns the step downward while Gritted Teeth holds', async () => {
    expect(await cravingAfter(build('Gritted Teeth'), FED)).toBe(28);
  });

  it('lowers Craving under Gritted Teeth even for a hungry Glutton', async () => {
    expect(await cravingAfter(build('Glutton', 'Sugar Rush', 'Gritted Teeth'), { Craving: 30, Fullness: 0 })).toBe(29);
  });

  it('stays inside the stat range', async () => {
    expect(await cravingAfter(build('Glutton', 'Sugar Rush'), { Craving: 98, Fullness: 0 })).toBe(100);
    expect(await cravingAfter(build('Iron Will', 'Gritted Teeth'), { Craving: 2, Fullness: 80 })).toBe(0);
  });

  it('is the only thing that climbs Craving: no build gives it regen', () => {
    for (const state of [settleDefaults(gate), build('Glutton', 'Sugar Rush', 'Gritted Teeth'), build('Iron Will', 'Hearty Appetite')]) {
      expect(cursedStats(state, {}).find((s) => s.name === 'Craving')?.regen).toBe(0);
    }
  });
});
