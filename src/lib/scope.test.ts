import { describe, expect, it } from 'vitest';
import type { Entity, PersonaRef, PlayerStat, Trait } from '@/types';
import { playedEntityIds } from './scope';
import { resolveOwners } from './owners';
import { activeOf, gateTreeOf } from './traitGates';
import { traitForceScope, traitGateInput, type TraitForceState, type TraitWorld } from './traitRuntime';
import { statScope } from './statOwners';

const trait = (id: string, over: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...over });
const stat = (id: string, value = 50): PlayerStat => ({
  id, name: id, type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [],
});

// The root holds Brave. Albus (a world persona) owns Paladin; Bram (cast) owns Hardy; Mira is the Custom
// Persona entity and owns Quiet. Sable is a library persona that owns Sly.
const brave = trait('brave');
// Paladin moves a global stat, yet stays in Albus's part.
const albus: Entity = {
  id: 'albus', name: 'Albus', persona: true, traits: [trait('paladin', { statChanges: [{ statId: 'destruction', value: 5, type: 'max' }] })],
} as Entity;
const bram: Entity = { id: 'bram', name: 'Bram', traits: [trait('hardy')] } as Entity;
const mira: Entity = { id: 'mira', name: 'Mira', customPersona: true, traits: [trait('quiet')] } as Entity;
const sable: Entity = { id: 'sable', name: 'Sable', persona: true, traits: [trait('sly')] } as Entity;
const world = { traits: [brave], traitGroups: [], entities: [albus, bram, mira] };

const asAlbus: PersonaRef = { source: 'world', entityId: 'albus' };
const asSable: PersonaRef = { source: 'library', entityId: 'sable' };
const asNone: PersonaRef = { source: 'none' };

const traitWorld = (persona: PersonaRef, library: Entity[] = []): TraitWorld => {
  const { gate } = resolveOwners(world, persona, library);
  return { traits: world.traits, groups: [], entities: gate.entities, global: gate.global, owners: gate.owners, persona };
};

const forceState = (over: Partial<TraitForceState> = {}): TraitForceState => ({
  traits: [brave],
  disabledTraitIds: [],
  ownedTraits: { albus: { chosen: ['paladin'] }, bram: { chosen: ['hardy'] }, mira: { chosen: ['quiet'] }, sable: { chosen: ['sly'] } },
  ...over,
});

describe('playedEntityIds (Q26)', () => {
  it('is the world persona alone under a world persona', () => {
    expect(playedEntityIds(asAlbus, world.entities)).toEqual(['albus']);
  });

  it('is the library persona, then the Custom Persona entity, under a library persona', () => {
    expect(playedEntityIds(asSable, world.entities)).toEqual(['sable', 'mira']);
  });

  it('is the Custom Persona entity alone under None', () => {
    expect(playedEntityIds(asNone, world.entities)).toEqual(['mira']);
    expect(playedEntityIds(asNone, [])).toEqual([]);
  });
});

describe('traitGateInput scope', () => {
  it('puts the root in the global part and reaches the played persona through its own id', () => {
    const input = traitGateInput({ ...forceState(), stats: [stat('destruction')] }, traitWorld(asAlbus));
    expect(input.global.traits.map((t) => t.id)).toEqual(['brave']);
    expect(input.active.global).toEqual(['brave']);
    expect(Object.keys(input.stats!.global)).toEqual(['destruction']);
    const played = playedEntityIds(input.persona, input.entities);
    expect(played).toEqual(['albus']);
    expect(gateTreeOf(input, played[0])?.traits.map((t) => t.id)).toEqual(['paladin']);
    expect(activeOf(input.active, played[0])).toEqual(['paladin']);
  });

  it('keys every owner part by entity id, a dormant pick with no tree', () => {
    const input = traitGateInput({ ...forceState(), stats: [] }, traitWorld(asAlbus));
    expect(Object.keys(input.active.owners).sort()).toEqual(['albus', 'bram', 'mira', 'sable']);
    // Mira's pick lies dormant under a world persona; Sable is not in this playthrough.
    expect(activeOf(input.active, 'mira')).toEqual(['quiet']);
    expect(input.stats!.owners.mira).toBeUndefined();
    expect(gateTreeOf(input, 'mira')).toBeUndefined();
    expect(gateTreeOf(input, 'sable')).toBeUndefined();
  });

  it('reaches each played entity under a library persona through its own id', () => {
    const input = traitGateInput({ ...forceState(), stats: [] }, traitWorld(asSable, [sable]));
    const played = playedEntityIds(input.persona, input.entities);
    expect(played).toEqual(['sable', 'mira']);
    expect(played.map((id) => activeOf(input.active, id))).toEqual([['sly'], ['quiet']]);
  });

  it('gives a played entity with no tree, picks or stats an empty part', () => {
    const input = traitGateInput({ ...forceState({ ownedTraits: {} }), stats: [] }, traitWorld(asSable));
    expect(playedEntityIds(input.persona, input.entities)).toEqual(['sable', 'mira']);
    expect(gateTreeOf(input, 'sable')).toBeUndefined();
    expect(activeOf(input.active, 'sable')).toEqual([]);
    expect(input.stats!.owners.sable).toBeUndefined();
  });

  it('gives an owner with stats but no tree an empty active list', () => {
    // Wren has stats in play but no tree and no picks.
    const input = traitGateInput(
      { traits: [], disabledTraitIds: [], ownedTraits: {}, entityStats: { wren: [stat('vigor', 1)] }, stats: [] },
      traitWorld(asNone),
    );
    expect(gateTreeOf(input, 'wren')).toBeUndefined();
    expect(activeOf(input.active, 'wren')).toEqual([]);
    expect(Object.keys(input.stats!.owners.wren)).toEqual(['vigor']);
    expect(activeOf(input.active, null)).toEqual([]);
    expect(input.stats!.global).toEqual({});
  });
});

describe('traitForceScope', () => {
  it("keeps the played persona's traits under its own id, out of the global part", () => {
    const scope = traitForceScope(forceState(), traitWorld(asAlbus));
    expect(scope.global.map((t) => t.id)).toEqual(['brave']);
    expect(scope.owners.albus.map((t) => t.id)).toEqual(['paladin']);
    expect(scope.owners.bram.map((t) => t.id)).toEqual(['hardy']);
  });

  it('leaves switched-off traits out of every part', () => {
    const scope = traitForceScope(
      forceState({ disabledTraitIds: ['brave'], ownedTraits: { albus: { chosen: ['paladin'], disabled: ['paladin'] } } }),
      traitWorld(asAlbus),
    );
    expect(scope.global).toEqual([]);
    expect(scope.owners.albus).toEqual([]);
  });

  it('reaches the Custom Persona entity under None through its own id', () => {
    const scope = traitForceScope(forceState(), traitWorld(asNone));
    expect(scope.played).toEqual(['mira']);
    expect(scope.owners.mira.map((t) => t.id)).toEqual(['quiet']);
  });

  // Q17: the root's pick and the persona's link are held apart.
  it("gives a persona's link to a root pick in the persona's own part, beside the global pick", () => {
    const linking: Entity = { ...albus, traitLinks: [{ id: 'l-brave', originalId: 'brave', kind: 'trait', originalName: 'Brave', groupId: null, order: 1 }] };
    const linked = { ...world, entities: [linking, bram, mira] };
    const { gate } = resolveOwners(linked, asAlbus);
    const scope = traitForceScope(
      forceState({ ownedTraits: { albus: { chosen: ['paladin', 'brave'] } } }),
      { traits: linked.traits, groups: [], entities: gate.entities, global: gate.global, owners: gate.owners, persona: asAlbus },
    );
    expect(scope.global.map((t) => t.id)).toEqual(['brave']);
    expect(scope.owners.albus.map((t) => t.id)).toEqual(['paladin', 'brave']);
  });

  it('gives a played entity that is no owner an empty part', () => {
    // Sable's library entity is not carried, so it owns no tree in this playthrough.
    const scope = traitForceScope(forceState(), traitWorld(asSable));
    expect(scope.played).toEqual(['sable', 'mira']);
    expect(scope.owners.sable).toEqual([]);
    expect(scope.owners.mira.map((t) => t.id)).toEqual(['quiet']);
  });
});

describe('statScope', () => {
  it('holds the global stats beside each entity owner by id', () => {
    const scope = statScope({ stats: [stat('destruction')], entityStats: { albus: [stat('stock')] } });
    expect(scope.global.map((s) => s.id)).toEqual(['destruction']);
    expect(scope.owners.albus.map((s) => s.id)).toEqual(['stock']);
  });

  it('holds no owners without entity stats', () => {
    expect(statScope({ stats: [] }).owners).toEqual({});
  });
});
