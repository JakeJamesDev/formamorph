import { describe, expect, it } from 'vitest';
import { openingFold, openingStateOf, type OpeningFoldWorld } from './openingState';
import type { Entity, GameLocation, Stat, StatChange, Trait } from '@/types';

const stat = (id: string, value: number, over: Partial<Stat> = {}): Stat => ({
  id, name: id, type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [], ...over,
});
const trait = (id: string, statChanges: StatChange[] = [], over: Partial<Trait> = {}): Trait => ({
  id, name: id, statChanges, playerToggle: true, ...over,
});

// Giant raises the HP cap before Tough adds to it, so authored order decides whether the clamp bites.
const giant = trait('giant', [{ statId: 'hp', value: 10, type: 'max' }]);
const tough = trait('tough', [{ statId: 'hp', value: 5, type: 'starting' }]);
// Bram (cast) owns Vigor; Hardy raises it, and Boast's row on Gold is a global row (Bram owns no Gold).
const hardy = trait('hardy', [{ statId: 'vigor', value: 2, type: 'starting' }]);
const boast = trait('boast', [{ statId: 'gold', value: 1, type: 'starting' }]);
// Albus is a world persona with its own Stock; Paladin raises it.
const paladin = trait('paladin', [{ statId: 'stock', value: 3, type: 'starting' }]);
const bram: Entity = { id: 'bram', name: 'Bram', description: '', locations: [], stats: [stat('vigor', 3)], traits: [hardy, boast] } as Entity;
const albus: Entity = { id: 'albus', name: 'Albus', description: '', locations: [], persona: true, stats: [stat('stock', 4)], traits: [paladin] } as Entity;
const town = { id: 'town', name: 'Town', description: '' } as GameLocation;
const gate = { id: 'gate', name: 'Gate', description: '', isStarting: true } as GameLocation;

const world: OpeningFoldWorld = {
  stats: [stat('hp', 10, { max: 12 }), stat('gold', 5)],
  statGroups: [],
  traits: [giant, tough],
  traitGroups: [],
  entities: [bram, albus],
  locations: [town, gate],
  dictionaries: [],
};

const valueOf = (stats: readonly { id: string; value?: number }[] | undefined, id: string) => stats?.find((s) => s.id === id)?.value;
const ownerStats = (state: ReturnType<typeof openingStateOf>, id: string) => state.owners?.find((o) => o.id === id)?.stats;

describe('openingStateOf', () => {
  it('folds the held picks, the global rows and the owned traits under the persona, as Enter World opens a game', () => {
    const state = openingStateOf(
      world,
      // Click order puts Tough first; authored order applies Giant first, so HP reaches 15 under a cap of 22.
      { traits: ['tough', 'giant'], owned: { bram: ['hardy', 'boast'], albus: ['paladin'] } },
      { ref: { source: 'world', entityId: 'albus' } },
    );

    expect(state.stats.find((s) => s.id === 'hp')).toMatchObject({ value: 15, max: 22 });
    // Bram's Boast reaches the global Gold through its global row.
    expect(valueOf(state.stats, 'gold')).toBe(6);
    expect(state.ownerTraits.acquired.map((t) => t.id)).toEqual(['giant', 'tough']);
    expect(state.ownerTraits.ownedTraits).toMatchObject({ bram: { chosen: ['hardy', 'boast'] }, albus: { chosen: ['paladin'] } });
    expect(state.ownerTraits.world.persona).toEqual({ source: 'world', entityId: 'albus' });
    expect(valueOf(ownerStats(state, 'bram'), 'vigor')).toBe(5);
    expect(valueOf(ownerStats(state, 'albus'), 'stock')).toBe(7);
    expect(state.enabled).toEqual({ hp: true, gold: true });
    expect(state.clock).toEqual({ deltaHours: 0, elapsedHours: 0 });
  });

  it('opens the authored world at turn one with no picks and no persona', () => {
    const state = openingStateOf(world);

    expect(state.stats.find((s) => s.id === 'hp')).toMatchObject({ value: 10, max: 12 });
    expect(valueOf(state.stats, 'gold')).toBe(5);
    expect(state.ownerTraits.acquired).toEqual([]);
    expect(state.ownerTraits.world.persona).toEqual({ source: 'none' });
    expect(valueOf(ownerStats(state, 'bram'), 'vigor')).toBe(3);
    expect(state.clock).toEqual({ deltaHours: 0, elapsedHours: 0 });
    expect(state.placeholders).toMatchObject({ rolls: {} });
    expect(state.placeholders?.pins).toBeUndefined();
    expect(state.places).toEqual({ locations: world.locations, location: { id: 'gate', name: 'Gate' }, connections: [] });
    expect(state.ownerTraits.discovered).toBeUndefined();
  });

  it('seeds and plays a library persona, and seeds the added library characters', () => {
    const rook: Entity = { id: 'rook', name: 'Rook', description: '', locations: [], persona: true, stats: [stat('grit', 2)], traits: [trait('steady', [{ statId: 'grit', value: 4, type: 'starting' }])] } as Entity;
    const vale: Entity = { id: 'vale', name: 'Vale', description: '', locations: [], stats: [stat('calm', 6)] } as Entity;
    const fold = openingFold(world, { traits: [], owned: { rook: ['steady'] } }, {
      ref: { source: 'library', entityId: 'rook' }, libraryEntity: rook, characters: [vale],
    });

    expect(fold.state.ownerTraits.library?.map((e) => e.id)).toEqual(['rook', 'vale']);
    expect(valueOf(ownerStats(fold.state, 'rook'), 'grit')).toBe(6);
    expect(valueOf(fold.entityStats.vale, 'calm')).toBe(6);
  });

  it('stands nowhere in a world with no locations', () => {
    expect(openingStateOf({ ...world, locations: [] }).places).toEqual({ locations: [], location: null, connections: [] });
  });

  it('hands play every seeded entity and the traits its log names', () => {
    // Albus is played, so Bram's Boast row stays out of the log and Albus's own Boast row is in it.
    const albusBoast = trait('albus-boast', [{ statId: 'gold', value: 2, type: 'starting' }]);
    const played = { ...world, entities: [bram, { ...albus, traits: [paladin, albusBoast] }] };
    const fold = openingFold(
      played, { traits: ['tough'], owned: { bram: ['hardy', 'boast'], albus: ['albus-boast'] } }, { ref: { source: 'world', entityId: 'albus' } },
    );
    expect(Object.keys(fold.entityStats)).toEqual(['bram', 'albus']);
    expect(fold.startingTraits.map(({ trait: t, ownerId }) => [t.id, ownerId])).toEqual([['tough', null], ['albus-boast', 'albus']]);
    expect(fold.traitState.entityStats).toBe(fold.entityStats);
  });
});
