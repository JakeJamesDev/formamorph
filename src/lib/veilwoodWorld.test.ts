/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/veilwood.json?raw';
import { migrateWorld } from './version';
import { resolveOwners, type OwnerWorld } from './owners';
import { settleDefaults, switchTrait, underfills, type SettleResult } from './traitGates';
import { inPlayOwners } from './ownedTraitsInPlay';
import {
  applyGlobalRowTraits, applyOwnedStatTraits, seedNewGameStats, settleTraits, switchPlayerTrait, type TraitRuntimeState, type TraitWorld,
} from './traitRuntime';
import { ownedTraitStatesFrom } from './ownedTraitState';
import { seedEntityStats } from './entityStats';
import type { Entity, PersonaRef, World } from '@/types';

// Loaded the way the seeder loads it: raw text through the world migration.
const world: World = migrateWorld(JSON.parse(raw));
const NONE: PersonaRef = { source: 'none' };
const wanderer: Entity = world.entities.find((e) => e.customPersona)!;
const ownerWorld: OwnerWorld = { traits: world.traits, traitGroups: world.traitGroups ?? [], entities: world.entities };
const { gate } = resolveOwners(ownerWorld, NONE);

const idOf = (name: string): string => {
  const found = wanderer.traits!.find((t) => t.name === name);
  if (!found) throw new Error(`no trait ${name}`);
  return found.id;
};
const names = (ids: readonly string[] = []) => ids.map((id) => wanderer.traits!.find((t) => t.id === id)?.name ?? id).sort();
const activeOf = (result: SettleResult) => names(result.active.owners[wanderer.id]);

/** Switch each named trait on in turn from the default build, as the creator does. */
function build(...picks: string[]): SettleResult {
  let state = settleDefaults(gate);
  for (const pick of picks) {
    if (state.active.owners[wanderer.id]?.includes(idOf(pick))) continue;
    const next = switchTrait({ ...gate, active: state.active }, wanderer.id, idOf(pick), state.cascadeOff);
    if (!next) throw new Error(`${pick} would not switch on`);
    state = next;
  }
  return state;
}

describe('the wanderer build', () => {
  it('starts with the curse on and Veil Sight off', () => {
    expect(activeOf(settleDefaults(gate))).toEqual(['Iron Constitution', "The Veil's Hold", 'Zen Master']);
  });

  it('always holds exactly one Constitution and one Temperament', () => {
    const start = settleDefaults(gate);
    expect(activeOf(build('Survivalist', 'Stress Eater'))).toEqual(['Stress Eater', 'Survivalist', "The Veil's Hold"]);
    expect(underfills({ ...gate, active: start.active }, wanderer.id, idOf('Iron Constitution'))).toBe(true);
    expect(underfills({ ...gate, active: start.active }, wanderer.id, idOf('Zen Master'))).toBe(true);
  });

  it('takes any number of Instincts', () => {
    expect(activeOf(build('Iron Stomach', 'Hearty Appetite', 'Keen Eye'))).toEqual(
      ['Hearty Appetite', 'Iron Constitution', 'Iron Stomach', 'Keen Eye', "The Veil's Hold", 'Zen Master'],
    );
  });
});

const traitWorld: TraitWorld = {
  traits: world.traits, groups: world.traitGroups ?? [], entities: world.entities, persona: NONE, ...inPlayOwners(ownerWorld, NONE),
};

/** A game started on `picks`, with each named Wanderer stat then set to a raw value. */
function inPlay(picks: SettleResult, values: Record<string, number> = {}): TraitRuntimeState {
  const seeded: TraitRuntimeState = {
    stats: seedNewGameStats(world.stats), traits: [], disabledTraitIds: [], appliedValues: {},
    ownedTraits: ownedTraitStatesFrom({ [wanderer.id]: picks.active.owners[wanderer.id] ?? [] }),
    entityStats: seedEntityStats(world.entities),
  };
  // A persona trait moves its own stats and, by its global rows, the world's Predator Attention.
  return withStats(applyGlobalRowTraits(applyOwnedStatTraits(seeded, traitWorld), traitWorld).state, values);
}

/** `state` with each named Wanderer stat set to a raw value. */
function withStats(state: TraitRuntimeState, values: Record<string, number>): TraitRuntimeState {
  const stats = state.entityStats![wanderer.id];
  return {
    ...state,
    entityStats: { ...state.entityStats, [wanderer.id]: stats.map((s) => (s.name in values ? { ...s, value: values[s.name] } : s)) },
  };
}

const owned = (state: TraitRuntimeState) => {
  const own = state.ownedTraits?.[wanderer.id];
  return names((own?.chosen ?? []).filter((id) => !own?.disabled?.includes(id)));
};
const settled = (state: TraitRuntimeState) => settleTraits(state, traitWorld).state;

describe("the Veil's Hold", () => {
  it('stays on: the player cannot switch it off', () => {
    expect(switchPlayerTrait(inPlay(settleDefaults(gate)), idOf("The Veil's Hold"), false, traitWorld)).toBeNull();
  });

  it('carries the hunters\' rise: Predator Attention climbs only through the curse', () => {
    const state = inPlay(settleDefaults(gate));
    expect(world.stats.find((s) => s.name === 'Predator Attention')?.regen).toBe(0);
    expect(state.stats.find((s) => s.name === 'Predator Attention')?.regen).toBe(2);
  });
});

describe('Veil Sight', () => {
  it('switches on at 75% Toxin and off again below it', () => {
    const poisoned = settled(inPlay(settleDefaults(gate), { Toxin: 75 }));
    expect(owned(poisoned)).toContain('Veil Sight');
    expect(owned(settled(inPlay(settleDefaults(gate), { Toxin: 74 })))).not.toContain('Veil Sight');
  });

  it('reads Toxin as a share of an Iron Stomach\'s higher max', () => {
    // Iron Stomach raises Toxin's max to 125, so 90 is 72%: not yet poisoned enough.
    expect(owned(settled(inPlay(build('Iron Stomach'), { Toxin: 90 })))).not.toContain('Veil Sight');
    expect(owned(settled(inPlay(build('Iron Stomach'), { Toxin: 94 })))).toContain('Veil Sight');
  });
});

describe('Move Quietly', () => {
  const switchedOn = (stress: number) =>
    switchPlayerTrait(inPlay(settleDefaults(gate), { Stress: stress }), idOf('Move Quietly'), true, traitWorld);

  it('switches on while Stress is below 75%', () => {
    expect(owned(switchedOn(74)!.state)).toContain('Move Quietly');
  });

  it('is locked while Stress is at 75% or more', () => {
    expect(switchedOn(75)).toBeNull();
  });

  it('switches off when panic rises, and back on once Stress falls', () => {
    const sneaking = switchedOn(40)!.state;
    const panicked = settled(withStats(sneaking, { Stress: 80 }));
    expect(owned(panicked)).not.toContain('Move Quietly');
    expect(owned(settled(withStats(panicked, { Stress: 30 })))).toContain('Move Quietly');
  });
});
