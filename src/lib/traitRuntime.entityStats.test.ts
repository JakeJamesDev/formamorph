import { describe, it, expect } from 'vitest';
import {
  applyCodeTraitSwitches, applyOwnedStatTraits, applyGlobalRowTraits, gateStatsOf, ownerStatTraitsInForce, settleTraits, switchPersonaStats,
  switchPlayerTrait, type TraitRuntimeState, type TraitWorld,
} from './traitRuntime';
import { entityStatOwners } from './entityStats';
import type { Entity, PersonaRef, PlayerStat, StatChange, Trait } from '@/types';

const stat = (id: string, over: Partial<PlayerStat> = {}): PlayerStat => ({
  id, name: id, type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

const trait = (id: string, statChanges: StatChange[] = [], over: Partial<Trait> = {}): Trait => ({
  id, name: id, statChanges, playerToggle: true, ...over,
});

// Global scope holds h. Bram (cast) owns vigor and trust; Albus (a world persona) owns stock.
// Hardy raises Bram's Vigor; Boast aims at the global h, which Bram doesn't own; Grim switches Trust off.
// Paladin raises the global h (the shipped persona rule) and Albus's own Stock.
const hardy = trait('hardy', [{ statId: 'vigor', value: 10, type: 'max' }, { statId: 'vigor', value: 5, type: 'starting' }], { name: 'Hardy' });
const boast = trait('boast', [{ statId: 'h', value: 7, type: 'starting' }], { name: 'Boast' });
const grim = trait('grim', [], { name: 'Grim', statToggles: [{ statId: 'trust', enabled: false }] });
const paladin = trait('paladin', [
  { statId: 'h', value: 10, type: 'max' }, { statId: 'h', value: 5, type: 'starting' }, { statId: 'stock', value: 3, type: 'starting' },
], { name: 'Paladin' });

const bram = { id: 'bram', name: 'Bram', traits: [hardy, boast, grim], groups: [] };
const albus = { id: 'albus', name: 'Albus', traits: [paladin], groups: [] };
const entities = [{ id: 'bram', name: 'Bram' }, { id: 'albus', name: 'Albus', persona: true }];
/** A trait world with global scope's tree and its entity owners. */
type OwnersWorld = Extract<TraitWorld, { global: object }>;

const world = (persona: PersonaRef = { source: 'none' }): OwnersWorld => ({
  traits: [], groups: [], entities, persona, global: { traits: [], groups: [] }, owners: [bram, albus],
});
const asAlbus = world({ source: 'world', entityId: 'albus' });

const state = (over: Partial<TraitRuntimeState> = {}): TraitRuntimeState => ({
  stats: [stat('h')],
  traits: [],
  disabledTraitIds: [],
  appliedValues: {},
  entityStats: { bram: [stat('vigor'), stat('trust')], albus: [stat('stock')] },
  ...over,
});

const own = (s: TraitRuntimeState, owner: string, id: string) => s.entityStats![owner].find((x) => x.id === id)!;
const name = (t: Trait) => t.name;
const flip = (s: TraitRuntimeState, owner: string, id: string, on: boolean, w = world()) => {
  const result = switchPlayerTrait(s, id, on, w, name, owner);
  if (!result) throw new Error(`switch of ${id} refused`);
  return result.state;
};

describe('an entity’s own traits change its own stats', () => {
  it('raises its bound and moves its value on a switch-on, and gives back exactly that on a switch-off', () => {
    const on = flip(state(), 'bram', 'hardy', true);
    expect(own(on, 'bram', 'vigor')).toMatchObject({ max: 110, value: 55 });
    expect(own(on, 'bram', 'trust')).toEqual(stat('trust'));
    expect(on.appliedValues).toEqual({ 'bram/hardy/stats': { vigor: 5 } });

    const off = flip(on, 'bram', 'hardy', false);
    expect(own(off, 'bram', 'vigor')).toMatchObject({ max: 100, value: 50 });
    expect(flip(off, 'bram', 'hardy', true).entityStats).toEqual(on.entityStats);
  });

  it('moves the global stat for a change on a stat the cast entity doesn’t own, as its row reads it (Q30)', () => {
    const on = flip(state(), 'bram', 'boast', true);
    expect(on.stats[0]).toMatchObject({ value: 57 });
    expect(on.entityStats).toEqual(state().entityStats);
    expect(on.appliedValues).toEqual({ 'bram/boast': { h: 7 } });
    expect(flip(on, 'bram', 'boast', false).stats).toEqual(state().stats);
  });

  it('drops a change on a stat that neither the entity nor the world has', () => {
    const phantom = trait('phantom', [{ statId: 'ghost', value: 7, type: 'starting' }], { name: 'Phantom' });
    const w: TraitWorld = { ...world(), owners: [{ ...bram, traits: [phantom] }, albus] };
    const on = flip(state(), 'bram', 'phantom', true, w);
    expect(on.stats).toEqual(state().stats);
    expect(on.entityStats).toEqual(state().entityStats);
  });

  it('reads the cast entity’s traits in force for its stats, and none for an entity that isn’t an owner', () => {
    const on = flip(state(), 'bram', 'hardy', true);
    expect(ownerStatTraitsInForce(on, world(), 'bram').map((t) => t.id)).toEqual(['hardy']);
    expect(ownerStatTraitsInForce(on, world(), 'nobody')).toEqual([]);
  });

  it('switches its own stats with its toggles', () => {
    const on = flip(state(), 'bram', 'grim', true);
    const owners = entityStatOwners(on.entityStats!, entities as Entity[], { source: 'none' }, (id) => ownerStatTraitsInForce(on, world(), id));
    expect(owners.find((o) => o.id === 'bram')!.enabled).toEqual({ vigor: true, trust: false });
  });

  it('reverses its own stats when a gate cascade turns the trait off', () => {
    const gated = trait('hardy', hardy.statChanges, { name: 'Hardy', requires: [{ all: [{ kind: 'trait', id: 'grim', owner: { kind: 'entity', id: 'bram' } }] }] });
    const w: TraitWorld = { ...world(), owners: [{ ...bram, traits: [gated, boast, grim] }, albus] };
    const both = flip(flip(state(), 'bram', 'grim', true, w), 'bram', 'hardy', true, w);
    expect(own(both, 'bram', 'vigor')).toMatchObject({ max: 110, value: 55 });
    const cascade = flip(both, 'bram', 'grim', false, w);
    expect(own(cascade, 'bram', 'vigor')).toMatchObject({ max: 100, value: 50 });
    expect(settleTraits(cascade, w, name).state).toBe(cascade);
  });

  it('moves its own stats on a stat code switch', () => {
    const { state: on } = applyCodeTraitSwitches(state(), [{ traitId: 'hardy', enabled: true, by: 'Mood', ownerId: 'bram' }], world(), name);
    expect(own(on, 'bram', 'vigor')).toMatchObject({ max: 110, value: 55 });
  });

  it('applies each entity’s traits in force at a new game, as creation picks apply for the player', () => {
    const picked = state({ ownedTraits: { bram: { chosen: ['hardy', 'boast'] }, albus: { chosen: ['paladin'] } } });
    const applied = applyOwnedStatTraits(picked, world());
    expect(own(applied, 'bram', 'vigor')).toMatchObject({ max: 110, value: 55 });
    expect(own(applied, 'albus', 'stock').value).toBe(53);
    expect(applied.stats).toEqual(picked.stats);
    expect(applied.appliedValues).toEqual({ 'bram/hardy/stats': { vigor: 5 }, 'albus/paladin/stats': { stock: 3 } });
    expect(applyOwnedStatTraits(state(), world())).toEqual(state());
  });
});

describe('the global stats as gates read them', () => {
  it('derive their bounds from global traits and Global rows alone, whoever is played', () => {
    const picked = state({ ownedTraits: { albus: { chosen: ['paladin'] }, bram: { chosen: ['hardy'] } } });
    const gates = (w: TraitWorld) => gateStatsOf(applyOwnedStatTraits(applyGlobalRowTraits(picked, w).state, w), w);
    // Paladin's h rows reach the global stat even with no one playing Albus; Hardy's Vigor row stays on Bram.
    expect(gates(world()).global.h).toMatchObject({ max: 110 });
    expect(gates(asAlbus).global.h).toMatchObject({ max: 110 });
    expect(Object.keys(gates(world()).global)).toEqual(['h']);
    expect(gates(world()).owners.bram.vigor).toMatchObject({ max: 110 });
  });

  it('switch a global stat off through an unplayed entity’s Global toggle', () => {
    const quiet = trait('quiet', [], { name: 'Quiet', statToggles: [{ statId: 'h', enabled: false, target: 'global' }] });
    const w: TraitWorld = { ...world(), owners: [{ ...bram, traits: [quiet] }, albus] };
    const on = flip(state(), 'bram', 'quiet', true, w);
    expect(gateStatsOf(on, w).global.h).toMatchObject({ inert: true });
    expect(gateStatsOf(flip(on, 'bram', 'quiet', false, w), w).global.h.inert).toBeUndefined();
  });
});

describe('a player owner’s traits', () => {
  const picked = state({ ownedTraits: { albus: { chosen: ['paladin'] } } });

  it('move the global stat and its own stat while played', () => {
    const played = applyOwnedStatTraits(applyGlobalRowTraits(picked, asAlbus).state, asAlbus);
    expect(played.stats[0]).toMatchObject({ max: 110, value: 55 });
    expect(own(played, 'albus', 'stock').value).toBe(53);
    expect(played.appliedValues).toEqual({ 'albus/paladin': { h: 5 }, 'albus/paladin/stats': { stock: 3 } });

    const off = flip(played, 'albus', 'paladin', false, asAlbus);
    expect(off.stats[0]).toMatchObject({ max: 100, value: 50 });
    expect(own(off, 'albus', 'stock').value).toBe(50);
  });

  it('move the global stat and its own stat while it isn’t played (Q18, Q30)', () => {
    const cast = flip(state(), 'albus', 'paladin', true);
    expect(cast.stats[0]).toMatchObject({ max: 110, value: 55 });
    expect(own(cast, 'albus', 'stock').value).toBe(53);
  });

  it('target its own stat over a global stat with the same id', () => {
    const twin = state({ entityStats: { albus: [stat('h', { value: 20 })] } });
    const on = flip(twin, 'albus', 'paladin', true, asAlbus);
    expect(on.stats).toEqual(twin.stats);
    expect(own(on, 'albus', 'h')).toMatchObject({ max: 110, value: 25 });
  });

  it('reach the global stat on a shared id through a row with the global target', () => {
    const oath = trait('oath', [
      { statId: 'h', value: 10, type: 'max', target: 'global' }, { statId: 'h', value: 3, type: 'starting', target: 'global' },
      { statId: 'h', value: 4, type: 'starting' },
    ], { name: 'Oath', statToggles: [{ statId: 'h', enabled: false, target: 'global' }] });
    const sworn: TraitWorld = {
      traits: [], groups: [], entities, persona: { source: 'world', entityId: 'albus' },
      global: { traits: [], groups: [] }, owners: [bram, { ...albus, traits: [oath] }],
    };
    const twin = state({ entityStats: { albus: [stat('h', { value: 20 })] } });
    const on = flip(twin, 'albus', 'oath', true, sworn);
    expect(on.stats[0]).toMatchObject({ max: 110, value: 53 });
    expect(own(on, 'albus', 'h')).toMatchObject({ max: 100, value: 24 });
    expect(ownerStatTraitsInForce({ ...on, ownedTraits: { albus: { chosen: ['oath'] } } }, sworn, 'albus')
      .flatMap((t) => [...t.statChanges, ...(t.statToggles ?? [])])).toEqual([{ statId: 'h', value: 4, type: 'starting' }]);

    const off = flip(on, 'albus', 'oath', false, sworn);
    expect(off.stats[0]).toMatchObject({ max: 100, value: 50 });
    expect(own(off, 'albus', 'h')).toMatchObject({ max: 100, value: 20 });
  });

  it('reach the global stat on a shared id through a Global row while the entity isn’t played (Q18)', () => {
    const oath = trait('oath', [{ statId: 'h', value: 10, type: 'max', target: 'global' }, { statId: 'h', value: 3, type: 'starting', target: 'global' }], { name: 'Oath' });
    const cast: TraitWorld = {
      traits: [], groups: [], entities, persona: { source: 'none' },
      global: { traits: [], groups: [] }, owners: [bram, { ...albus, traits: [oath] }],
    };
    const twin = state({ entityStats: { albus: [stat('h', { value: 20 })] } });
    const on = flip(twin, 'albus', 'oath', true, cast);
    expect(on.stats[0]).toMatchObject({ max: 110, value: 53 });
    expect(own(on, 'albus', 'h')).toEqual(own(twin, 'albus', 'h'));
    expect(flip(on, 'albus', 'oath', false, cast).stats).toEqual(twin.stats);
  });

  it("leave every entity's stat values where they were through a persona switch and back", () => {
    const played = applyOwnedStatTraits(applyGlobalRowTraits(picked, asAlbus).state, asAlbus);
    const moved = { ...played, entityStats: { bram: [stat('vigor', { value: 12 }), stat('trust', { value: 81 })], albus: [stat('stock', { value: 7 })] } };
    const away = switchPersonaStats(moved, asAlbus, world(), name).state;
    const back = switchPersonaStats(away, world(), asAlbus, name).state;
    expect(back.entityStats).toEqual(moved.entityStats);
    expect(back.stats).toEqual(moved.stats);
  });

  it('keep every stat where it is on a persona switch', () => {
    const played = applyOwnedStatTraits(applyGlobalRowTraits(picked, asAlbus).state, asAlbus);
    const away = switchPersonaStats(played, asAlbus, world(), name).state;
    expect(away.stats[0]).toMatchObject({ max: 110, value: 55 });
    expect(away.entityStats).toEqual(played.entityStats);
  });
});
