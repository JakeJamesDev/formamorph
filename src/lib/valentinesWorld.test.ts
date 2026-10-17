/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/valentines.json?raw';
import { migrateWorld } from './version';
import { resolveOwners, type OwnerWorld } from './owners';
import { settleDefaults, switchTrait, type SettleResult } from './traitGates';
import { inPlayOwners } from './ownedTraitsInPlay';
import { applyOwnedStatTraits, seedNewGameStats, type TraitRuntimeState, type TraitWorld } from './traitRuntime';
import { ownedTraitStatesFrom } from './ownedTraitState';
import { seedEntityStats } from './entityStats';
import { runStatCodeTurn } from './statCodeTurn';
import type { Entity, PersonaRef, PlayerStat, World } from '@/types';

// Loaded the way the seeder loads it: raw text through the world migration.
const world: World = migrateWorld(JSON.parse(raw));
const NONE: PersonaRef = { source: 'none' };
const student: Entity = world.entities.find((e) => e.customPersona)!;
const ownerWorld: OwnerWorld = { traits: world.traits, traitGroups: world.traitGroups ?? [], entities: world.entities };
const { gate } = resolveOwners(ownerWorld, NONE);

const idOf = (name: string): string => {
  const found = student.traits!.find((t) => t.name === name);
  if (!found) throw new Error(`no trait ${name}`);
  return found.id;
};

/** Switch each named trait on in turn from the default build, as the creator and the in-play toggle do. */
function build(...picks: string[]): SettleResult {
  let state = settleDefaults(gate);
  for (const pick of picks) {
    if (state.active.owners[student.id]?.includes(idOf(pick))) continue;
    const next = switchTrait({ ...gate, active: state.active }, student.id, idOf(pick), state.cascadeOff);
    if (!next) throw new Error(`${pick} would not switch on`);
    state = next;
  }
  return state;
}

const traitWorld: TraitWorld = {
  traits: world.traits, groups: world.traitGroups ?? [], entities: world.entities, persona: NONE, ...inPlayOwners(ownerWorld, NONE),
};
const ownedOf = (state: SettleResult) => ownedTraitStatesFrom({ [student.id]: state.active.owners[student.id] ?? [] });

/** The student's stats after its build's stat changes, with each named stat set to a raw value. */
function studentStats(state: SettleResult, values: Record<string, number>): PlayerStat[] {
  const seeded: TraitRuntimeState = {
    stats: seedNewGameStats(world.stats), traits: [], disabledTraitIds: [], appliedValues: {},
    ownedTraits: ownedOf(state), entityStats: seedEntityStats(world.entities),
  };
  const started = applyOwnedStatTraits(seeded, traitWorld);
  return started.entityStats![student.id].map((s) => (s.name in values ? { ...s, value: values[s.name] } : s));
}

const statOf = (stats: readonly PlayerStat[], name: string) => stats.find((s) => s.name === name)!;

/** Agility after one After the AI run of its script. */
async function agilityAfter(state: SettleResult, values: Record<string, number>) {
  const stats = studentStats(state, values);
  const out = await runStatCodeTurn({
    stats: [], enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {},
    ownerTraits: {
      acquired: [], disabledTraitIds: [], appliedValues: {}, entities: world.entities, world: traitWorld, ownedTraits: ownedOf(state),
    },
    owners: [{ id: student.id, stats, enabled: {}, previous: stats, regenApplied: {} }],
    statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
  });
  // No fallback to the input: a script that never ran must not pass as one that returned the same value.
  const ran = out.owners?.[student.id]?.stats;
  if (!ran) throw new Error('the Agility script did not run');
  return statOf(ran, 'Agility').value;
}

// Iron Stomach is the default Constitution, so Sugar tops out at 100. The other builds change one max each.
const PLAIN = () => build('Class Idol');

describe('the Agility script', () => {
  it('reads full Stamina and an empty stomach as full speed', async () => {
    expect(await agilityAfter(PLAIN(), { Stamina: 100, Sugar: 0 })).toBe(100);
  });

  it('starts an exhausted student at a base of 30', async () => {
    expect(await agilityAfter(PLAIN(), { Stamina: 0, Sugar: 0 })).toBe(30);
  });

  it('slows the student as Sugar climbs', async () => {
    expect(await agilityAfter(PLAIN(), { Stamina: 50, Sugar: 50 })).toBe(45);
  });

  it("reads Stamina as a share of the Star Athlete's bigger tank", async () => {
    // Star Athlete's Stamina tops out at 120, so 60 is half: the same speed as 50 for everyone else.
    expect(statOf(studentStats(build('Star Athlete'), {}), 'Stamina').max).toBe(120);
    expect(await agilityAfter(build('Star Athlete'), { Stamina: 60, Sugar: 0 })).toBe(65);
  });

  it('reads Sugar as a share of the stomach each Constitution gives', async () => {
    // Sweet Tooth holds 125, so 100 is 80% full; Dainty Appetite holds 80, so 80 is completely full.
    expect(await agilityAfter(build('Class Idol', 'Sweet Tooth'), { Stamina: 100, Sugar: 100 })).toBe(68);
    expect(await agilityAfter(build('Class Idol', 'Dainty Appetite'), { Stamina: 100, Sugar: 80 })).toBe(60);
  });

  it('adds a burst while All-Out Sprint is on', async () => {
    expect(await agilityAfter(build('Class Idol', 'All-Out Sprint'), { Stamina: 50, Sugar: 0 })).toBe(85);
  });

  it('stays inside the stat range', async () => {
    expect(await agilityAfter(build('Class Idol', 'All-Out Sprint'), { Stamina: 100, Sugar: 0 })).toBe(100);
    expect(await agilityAfter(build('Class Idol', 'Dainty Appetite'), { Stamina: 0, Sugar: 80 })).toBe(0);
  });

  it("replaces whatever the AI wrote, since Agility is a readout of the body", async () => {
    expect(await agilityAfter(PLAIN(), { Stamina: 100, Sugar: 0, Agility: 12 })).toBe(100);
  });
});

describe('All-Out Sprint', () => {
  it('drains Stamina each turn, even for the fastest-recovering build', () => {
    const regenOf = (state: SettleResult) => statOf(studentStats(state, {}), 'Stamina').regen;
    expect(regenOf(build('Star Athlete', 'Running Shoes'))).toBeGreaterThan(0);
    expect(regenOf(build('Star Athlete', 'Running Shoes', 'All-Out Sprint'))).toBeLessThan(0);
  });
});
