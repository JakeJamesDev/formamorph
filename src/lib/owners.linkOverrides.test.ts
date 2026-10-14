import { describe, it, expect } from 'vitest';
import { resolveOwners, type OwnerWorld } from './owners';
import { inPlayOwners } from './ownedTraitsInPlay';
import { setLinkOverride } from './blueprints';
import { applyGlobalRowTraits, switchPersonaStats, switchPlayerTrait, type TraitRuntimeState, type TraitWorld } from './traitRuntime';
import type { Entity, PersonaRef, PlayerStat, Trait, TraitGroup, TraitLink } from '@/types';

// Paladin is a Blueprints original: +5 starting health, not player-toggleable. Albus's link raises it to +12
// and lets the player toggle it; Mira's link reads it live.
const paladin: Trait = {
  id: 'paladin', name: 'Paladin', groupId: 'blueprints', order: 0, statChanges: [{ statId: 'h', value: 5, type: 'starting' }],
};
const groups: TraitGroup[] = [{ id: 'blueprints', name: 'Blueprints', parentId: null, order: 0, system: 'blueprints' }];
const linkTo = (id: string): TraitLink => ({ id, originalId: 'paladin', kind: 'trait', originalName: 'Paladin', groupId: null, order: 0 });
const albusLink = setLinkOverride(
  setLinkOverride(linkTo('l-albus'), paladin, 'statChanges', [{ statId: 'h', value: 12, type: 'starting' }]), paladin, 'playerToggle', true,
);
const albus: Entity = { id: 'albus', name: 'Albus', persona: true, traitLinks: [albusLink] };
const mira: Entity = { id: 'mira', name: 'Mira', persona: true, traitLinks: [linkTo('l-mira')] };
const world: OwnerWorld = { traits: [paladin], traitGroups: groups, entities: [albus, mira] };

/** The trait world play reads under `persona`, built the way the Traits panel builds it. */
const played = (persona: PersonaRef): TraitWorld => ({
  traits: [paladin], groups, entities: world.entities, persona, ...inPlayOwners(world, persona),
});
const AS_ALBUS = played({ source: 'world', entityId: 'albus' });
const AS_MIRA = played({ source: 'world', entityId: 'mira' });

const health: PlayerStat = {
  id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0,
};
const state = (over: Partial<TraitRuntimeState> = {}): TraitRuntimeState =>
  ({ stats: [health], traits: [], disabledTraitIds: [], appliedValues: {}, ...over });
const valueOf = (s: TraitRuntimeState) => s.stats[0].value;
const name = (t: Trait) => t.name;

describe('link overrides in play', () => {
  it("gives each owner the original as its own link reads it", () => {
    const { owners } = resolveOwners(world, undefined);
    const of = (id: string) => owners.find((b) => b.id === id)!.traits.find((t) => t.id === 'paladin')!;
    expect(of('albus')).toMatchObject({ playerToggle: true, statChanges: [{ statId: 'h', value: 12, type: 'starting' }] });
    expect(of('mira').playerToggle).toBeFalsy();
    expect(of('mira').statChanges).toEqual(paladin.statChanges);
  });

  it("lets the player toggle a link only where the link's Player Can Toggle override allows it", () => {
    expect(switchPlayerTrait(state(), 'paladin', true, AS_ALBUS, name, 'albus')?.state.ownedTraits).toEqual({ albus: { chosen: ['paladin'] } });
    expect(switchPlayerTrait(state(), 'paladin', true, AS_MIRA, name, 'mira')).toBeNull();
  });

  it("applies each owner's own link override, and a switch of one reverses its own value rather than the original's", () => {
    const both = state({ ownedTraits: { albus: { chosen: ['paladin'] }, mira: { chosen: ['paladin'] } } });
    const seeded = applyGlobalRowTraits(both, AS_ALBUS).state;
    // Albus's link gives +12 and Mira's the original's +5, whoever is played (Q17, Q30).
    expect(valueOf(seeded)).toBe(67);
    expect(seeded.appliedValues).toEqual({ 'albus/paladin': { h: 12 }, 'mira/paladin': { h: 5 } });
    expect(switchPersonaStats(seeded, AS_ALBUS, AS_MIRA, name)).toEqual({ state: seeded, log: [] });

    const off = switchPlayerTrait(seeded, 'paladin', false, AS_ALBUS, name, 'albus')!;
    expect(valueOf(off.state)).toBe(55);
    expect(off.state.appliedValues).toEqual({ 'albus/paladin': { h: -12 }, 'mira/paladin': { h: 5 } });
  });
});

describe("a persona's own stat traits in play (Q3)", () => {
  // Vow (+7 starting health) is Sylvie's own trait; Mira links Paladin. Neither sits at the top level.
  const vow: Trait = { id: 'vow', name: 'Vow', groupId: null, order: 0, statChanges: [{ statId: 'h', value: 7, type: 'starting' }] };
  const sylvie: Entity = { id: 'sylvie', name: 'Sylvie', persona: true, traits: [vow] };
  const owning: OwnerWorld = { ...world, entities: [...world.entities, sylvie] };
  const as = (entityId: string): TraitWorld => {
    const persona: PersonaRef = { source: 'world', entityId };
    return { traits: [paladin], groups, entities: owning.entities, persona, ...inPlayOwners(owning, persona) };
  };
  const picked = state({ ownedTraits: { sylvie: { chosen: ['vow'] }, mira: { chosen: ['paladin'] } } });

  it('applies every persona’s owned stat trait, and a persona switch moves none of them', () => {
    const seeded = applyGlobalRowTraits(picked, as('sylvie')).state;
    expect(valueOf(seeded)).toBe(62);
    expect(seeded.appliedValues).toEqual({ 'mira/paladin': { h: 5 }, 'sylvie/vow': { h: 7 } });
    expect(switchPersonaStats(seeded, as('sylvie'), as('mira'), name).log).toEqual([]);
  });
});
