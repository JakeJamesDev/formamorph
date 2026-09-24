import { describe, it, expect } from 'vitest';
import { liveChipScene, type LiveSceneSources } from './liveScene';
import { chipValues } from './chipValues';
import type { Entity, GameLocation, PlayerStat, Trait } from '@/types';

// The harbor: the Quay contains the Warehouse.
const quay: GameLocation = { id: 'quay', name: 'Quay', aiDescription: 'Wet stone and rope.' };
const warehouse: GameLocation = { id: 'warehouse', name: 'Warehouse', parentId: 'quay', aiDescription: 'Crates to the rafters.' };

// The authored cast, plus a character the story invented in the Warehouse.
const harbormaster: Entity = { id: 'harbormaster', name: 'Harbormaster', locations: ['quay'], aiDescription: 'Keeps the ledger.' };
const porter: Entity = { id: 'porter', name: 'Porter', locations: ['warehouse'], aiDescription: 'Hauls crates.' };
const stray: Entity = { id: 'stray', name: 'Stray', locations: ['warehouse'], aiDescription: 'Turned up one night.' };
const entities = [harbormaster, porter];

const grit: PlayerStat = {
  id: 'grit', name: 'Grit', type: 'number', description: 'Nerve.', min: 0, max: 10, value: 4, regen: 0, descriptors: [],
};
const seaLegs: Trait = { id: 'sea-legs', name: 'Sea Legs', aiDescription: 'Steady on {{deck}}.', statChanges: [] };

const sources = (over: Partial<LiveSceneSources> = {}): LiveSceneSources => ({
  overview: 'A working harbor.',
  stats: [grit],
  traits: [seaLegs],
  traitGroups: [],
  resolve: (text) => text.replaceAll('{{deck}}', 'a wet deck'),
  resolveTrait: (_trait, text) => text.replaceAll('{{deck}}', 'any deck'),
  persona: null,
  location: quay,
  locations: [quay, warehouse],
  connections: [],
  entities,
  allEntities: [...entities, stray],
  participants: [],
  notes: '',
  time: null,
  ...over,
});

describe('the live adapter', () => {
  it('rosters Here from the full cast and the outer scopes from the authored cast', () => {
    const values = chipValues(liveChipScene(sources({ location: warehouse })));
    expect(values['<ENTITIES|name>']).toBe('Porter, Stray');
    // Back on the Quay, the invented character is in the Warehouse but the outer scope never lists it.
    expect(chipValues(liveChipScene(sources()))['<ENTITIES|sublocations.name>']).toBe('Porter');
  });

  it('splits the participants into scene ids and ad-hoc names, dropping a cast member who lives elsewhere', () => {
    const scene = liveChipScene(sources({ participants: ['Harbormaster', 'the ferryman', 'Porter'] }));
    expect(scene.inSceneIds).toEqual(['harbormaster']);
    expect(scene.inSceneNames).toEqual(['the ferryman']);
    expect(chipValues(scene)['<ENTITIES|inscene.name>']).toBe('Harbormaster, the ferryman');
  });

  it('scopes the scene to the location a turn was routed to', () => {
    expect(liveChipScene(sources(), warehouse).presentIds).toEqual(['porter', 'stray']);
  });

  it('resolves a trait with its own pins before the scene resolves the rest', () => {
    const values = chipValues(liveChipScene(sources()));
    expect(values['<TRAITS DESCRIPTION>']).toContain('Steady on any deck.');
  });

  it('reads the stats, traits and resolution from a before box in flight, and nothing else from it', () => {
    const hardened: PlayerStat = { ...grit, value: 9 };
    const scene = liveChipScene(sources(), null, {
      activeStats: [hardened],
      activeTraits: [],
      resolve: (text) => text.replaceAll('{{deck}}', 'the box deck'),
      resolveTrait: (_trait, text) => text,
    });
    expect(scene.stats).toEqual([hardened]);
    expect(scene.traits).toEqual([]);
    expect(scene.location).toBe(quay);
    expect(scene.resolve('{{deck}}')).toBe('the box deck');
  });

  it('carries no lore, since activation is per turn', () => {
    expect(liveChipScene(sources()).lore).toEqual([]);
  });
});
