import { describe, it, expect } from 'vitest';
import {
  applyCodeTraitSwitches, applyOwnedStatTraits, applyPlayedStatTraits, ownerStatTraitsInForce, settleTraits, switchPersonaStats,
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

// The player owns h. Bram (cast) owns vigor and trust; Albus (a world persona) owns stock.
// Hardy raises Bram's Vigor; Boast aims at the player's h, which Bram doesn't own; Grim switches Trust off.
// Paladin raises the player's h (the shipped persona rule) and Albus's own Stock.
const hardy = trait('hardy', [{ statId: 'vigor', value: 10, type: 'max' }, { statId: 'vigor', value: 5, type: 'starting' }], { name: 'Hardy' });
const boast = trait('boast', [{ statId: 'h', value: 7, type: 'starting' }], { name: 'Boast' });
const grim = trait('grim', [], { name: 'Grim', statToggles: [{ statId: 'trust', enabled: false }] });
const paladin = trait('paladin', [
  { statId: 'h', value: 10, type: 'max' }, { statId: 'h', value: 5, type: 'starting' }, { statId: 'stock', value: 3, type: 'starting' },
], { name: 'Paladin' });

const bram = { id: 'bram', name: 'Bram', traits: [hardy, boast, grim], groups: [] };
const albus = { id: 'albus', name: 'Albus', traits: [paladin], groups: [] };
const entities = [{ id: 'bram', name: 'Bram' }, { id: 'albus', name: 'Albus', persona: true }];
const world = (persona: PersonaRef = { source: 'none' }): TraitWorld => ({
  traits: [], groups: [], entities, persona, bearers: [{ id: 'world', name: '', traits: [], groups: [] }, bram, albus],
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

  it('drops a change on a stat the cast entity doesn’t own, so an NPC’s trait never moves the player', () => {
    const on = flip(state(), 'bram', 'boast', true);
    expect(on.stats).toEqual(state().stats);
    expect(on.entityStats).toEqual(state().entityStats);
    expect(on.appliedValues).toEqual({});
  });

  it('reads the cast entity’s traits in force for its stats, and none for an entity that isn’t a bearer', () => {
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
    const gated = trait('hardy', hardy.statChanges, { name: 'Hardy', requires: [{ all: [{ kind: 'trait', id: 'grim', bearer: { kind: 'entity', id: 'bram' } }] }] });
    const w: TraitWorld = { ...world(), entities, bearers: [world().bearers![0], { ...bram, traits: [gated, boast, grim] }, albus] };
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

describe('a player bearer’s traits', () => {
  const picked = state({ ownedTraits: { albus: { chosen: ['paladin'] } } });

  it('move the world player stat while played, as shipped, and its own stat always', () => {
    const played = applyOwnedStatTraits(applyPlayedStatTraits(picked, asAlbus).state, asAlbus);
    expect(played.stats[0]).toMatchObject({ max: 110, value: 55 });
    expect(own(played, 'albus', 'stock').value).toBe(53);
    expect(played.appliedValues).toEqual({ 'albus/paladin': { h: 5 }, 'albus/paladin/stats': { stock: 3 } });

    const off = flip(played, 'albus', 'paladin', false, asAlbus);
    expect(off.stats[0]).toMatchObject({ max: 100, value: 50 });
    expect(own(off, 'albus', 'stock').value).toBe(50);
  });

  it('move only its own stat while it isn’t played', () => {
    const cast = flip(state(), 'albus', 'paladin', true);
    expect(cast.stats).toEqual(state().stats);
    expect(own(cast, 'albus', 'stock').value).toBe(53);
  });

  it('target its own stat over a world player stat with the same id', () => {
    const twin = state({ entityStats: { albus: [stat('h', { value: 20 })] } });
    const on = flip(twin, 'albus', 'paladin', true, asAlbus);
    expect(on.stats).toEqual(twin.stats);
    expect(own(on, 'albus', 'h')).toMatchObject({ max: 110, value: 25 });
  });

  it('reach the world player stat on a shared id through a row that targets the player', () => {
    const oath = trait('oath', [
      { statId: 'h', value: 10, type: 'max', target: 'player' }, { statId: 'h', value: 3, type: 'starting', target: 'player' },
      { statId: 'h', value: 4, type: 'starting' },
    ], { name: 'Oath', statToggles: [{ statId: 'h', enabled: false, target: 'player' }] });
    const sworn: TraitWorld = {
      traits: [], groups: [], entities, persona: { source: 'world', entityId: 'albus' },
      bearers: [{ id: 'world', name: '', traits: [], groups: [] }, bram, { ...albus, traits: [oath] }],
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

  it("leave every entity's stat values where they were through a persona switch and back", () => {
    const played = applyOwnedStatTraits(applyPlayedStatTraits(picked, asAlbus).state, asAlbus);
    const moved = { ...played, entityStats: { bram: [stat('vigor', { value: 12 }), stat('trust', { value: 81 })], albus: [stat('stock', { value: 7 })] } };
    const away = switchPersonaStats(moved, asAlbus, world(), name).state;
    const back = switchPersonaStats(away, world(), asAlbus, name).state;
    expect(back.entityStats).toEqual(moved.entityStats);
    expect(back.stats).toEqual(moved.stats);
  });

  it('keep their own stats where they are on a persona switch', () => {
    const played = applyOwnedStatTraits(applyPlayedStatTraits(picked, asAlbus).state, asAlbus);
    const away = switchPersonaStats(played, asAlbus, world(), name).state;
    expect(away.stats[0]).toMatchObject({ max: 100, value: 50 });
    expect(away.entityStats).toEqual(played.entityStats);
  });
});
