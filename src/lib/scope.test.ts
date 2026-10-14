import { describe, expect, it } from 'vitest';
import type { Entity, PersonaRef, PlayerStat, Trait } from '@/types';
import { keyedOf, playedEntityIds, scopedOf, PLAYER_OWNER } from './scope';
import { resolveOwners } from './owners';
import { gateScope, playerOwnerIds } from './traitGates';
import { traitForceScope, traitGateInput, type TraitForceState, type TraitWorld } from './traitRuntime';
import { statScope } from './statOwners';

const trait = (id: string, over: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...over });
const stat = (id: string, value = 50): PlayerStat => ({
  id, name: id, type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [],
});

// The root holds Brave. Albus (a world persona) owns Paladin; Bram (cast) owns Hardy; Mira is the Custom
// Persona entity and owns Quiet. Sable is a library persona that owns Sly.
const brave = trait('brave');
// Paladin moves a global stat, so the stand-in fold of stat traits would carry it into global scope.
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
  return { traits: world.traits, groups: [], entities: gate.entities, owners: gate.owners, persona };
};

const forceState = (over: Partial<TraitForceState> = {}): TraitForceState => ({
  traits: [brave],
  disabledTraitIds: [],
  ownedTraits: { albus: { chosen: ['paladin'] }, bram: { chosen: ['hardy'] }, mira: { chosen: ['quiet'] }, sable: { chosen: ['sly'] } },
  ...over,
});

describe('scopedOf and keyedOf', () => {
  it('splits the stand-in key into the global part and keeps every other key as an owner', () => {
    const scoped = scopedOf({ [PLAYER_OWNER]: ['brave'], albus: ['paladin'] }, []);
    expect(scoped).toEqual({ global: ['brave'], owners: { albus: ['paladin'] } });
  });

  it('fills a global part the map lacks with the empty value', () => {
    expect(scopedOf({ albus: ['paladin'] }, [] as string[]).global).toEqual([]);
  });

  it('round-trips a keyed map', () => {
    const keyed = { [PLAYER_OWNER]: ['brave'], albus: ['paladin'], bram: [] };
    expect(keyedOf(scopedOf(keyed, []))).toEqual(keyed);
  });
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

  it('leaves the stand-in player set as it was', () => {
    expect(playerOwnerIds(asAlbus, world.entities)).toEqual([PLAYER_OWNER, 'albus']);
    expect(playerOwnerIds(asSable, world.entities)).toEqual([PLAYER_OWNER, 'sable', 'mira']);
    expect(playerOwnerIds(asNone, world.entities)).toEqual([PLAYER_OWNER, 'mira']);
  });
});

describe('gateScope', () => {
  it('puts the root in the global part and reaches the played persona through its own id', () => {
    const scope = gateScope(traitGateInput({ ...forceState(), stats: [stat('destruction')] }, traitWorld(asAlbus)));
    expect(scope.global.tree?.traits.map((t) => t.id)).toEqual(['brave']);
    expect(scope.global.active).toEqual(['brave']);
    expect(Object.keys(scope.global.stats)).toEqual(['destruction']);
    expect(scope.played).toEqual(['albus']);
    const played = scope.owners[scope.played[0]];
    expect(played.tree?.traits.map((t) => t.id)).toEqual(['paladin']);
    expect(played.active).toEqual(['paladin']);
  });

  it('keys every owner part by entity id, a dormant pick with no tree', () => {
    const scope = gateScope(traitGateInput({ ...forceState(), stats: [] }, traitWorld(asAlbus)));
    expect(Object.keys(scope.owners).sort()).toEqual(['albus', 'bram', 'mira', 'sable']);
    // Mira's pick lies dormant under a world persona; Sable is not in this playthrough.
    expect(scope.owners.mira).toEqual({ active: ['quiet'], stats: {} });
    expect(scope.owners.sable.tree).toBeUndefined();
  });

  it('reaches each played entity under a library persona through its own id', () => {
    const scope = gateScope(traitGateInput({ ...forceState(), stats: [] }, traitWorld(asSable, [sable])));
    expect(scope.played).toEqual(['sable', 'mira']);
    expect(scope.played.map((id) => scope.owners[id].active)).toEqual([['sly'], ['quiet']]);
  });

  it('gives a played entity with no tree, picks or stats an empty part', () => {
    const scope = gateScope(traitGateInput({ ...forceState({ ownedTraits: {} }), stats: [] }, traitWorld(asSable)));
    expect(scope.played).toEqual(['sable', 'mira']);
    expect(scope.owners.sable).toEqual({ active: [], stats: {} });
  });

  it('gives an owner with stats but no tree an empty active list', () => {
    const scope = gateScope({
      owners: [], active: {}, stats: { bram: { vigor: { name: 'Vigor', value: 1, min: 0, max: 5 } } },
      entities: [], persona: asNone,
    });
    expect(scope.owners.bram).toEqual({ active: [], stats: { vigor: { name: 'Vigor', value: 1, min: 0, max: 5 } } });
    expect(scope.global).toEqual({ active: [], stats: {} });
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
      { traits: linked.traits, groups: [], entities: gate.entities, owners: gate.owners, persona: asAlbus },
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

  it('round-trips to the keyed map the stat runtime reads', () => {
    const scope = statScope({ stats: [stat('destruction')], entityStats: { albus: [stat('stock')] } });
    expect(keyedOf(scope)).toEqual({ [PLAYER_OWNER]: [stat('destruction')], albus: [stat('stock')] });
  });

  it('holds no owners without entity stats', () => {
    expect(statScope({ stats: [] }).owners).toEqual({});
  });
});
