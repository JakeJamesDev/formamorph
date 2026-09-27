import { describe, it, expect } from 'vitest';
import { liveChipScene, type LiveSceneSources } from './liveScene';
import { chipValues } from './chipValues';
import { resolveEntityText } from '../placeholders';
import { buildCharacterUserMessage, buildDiaryUserMessage } from '../stagedPlanning';
import { buildToolSnapshot } from '../tools/toolSnapshot';
import type { Entity, GameLocation, PlayerStat, Trait } from '@/types';

// The harbor: the Quay contains the Warehouse.
const quay: GameLocation = { id: 'quay', name: 'Quay', aiDescription: 'Wet stone and rope.' };
const warehouse: GameLocation = { id: 'warehouse', name: 'Warehouse', parentId: 'quay', aiDescription: 'Crates to the rafters.' };

// The authored cast, plus a character the story invented in the Warehouse.
const harbormaster: Entity = { id: 'harbormaster', name: 'Harbormaster', locations: ['quay'], aiDescription: 'Keeps the ledger.' };
const porter: Entity = {
  id: 'porter', name: 'Porter', locations: ['warehouse'], aiDescription: '{{char}} hauls crates.',
  aiSummary: '{{char}}, a hauler.',
};
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
  resolveEntity: (entity, text) => resolveEntityText(entity, text, { placeholders: [], rolls: {} }),
  persona: null,
  location: quay,
  locations: [quay, warehouse],
  connections: [],
  entities,
  allEntities: [...entities, stray],
  participants: [],
  notes: '',
  time: null,
  placeholders: [],
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
      resolveEntity: (_entity, text) => text.replaceAll('{{char}}', 'the box hauler'),
    });
    expect(scene.stats).toEqual([hardened]);
    expect(scene.traits).toEqual([]);
    expect(scene.location).toBe(quay);
    expect(scene.resolve('{{deck}}')).toBe('the box deck');
    expect(scene.entities.find((e) => e.id === 'porter')?.aiDescription).toBe('the box hauler hauls crates.');
  });

  it("resolves each entity's text with that entity as the Character Name", () => {
    const scene = liveChipScene(sources({ location: warehouse }));
    expect(chipValues(scene)['<ENTITIES>']).toContain('Porter hauls crates.');
    expect(buildToolSnapshot(scene, []).world.entities.find((e) => e.id === 'porter'))
      .toMatchObject({ description: 'Porter hauls crates.', summary: 'Porter, a hauler.' });
  });

  it('gives a Tool the shared placeholders, and an entity’s own under a before box’s entity resolution', () => {
    const shade = { id: 'shade', name: 'Shade', values: [{ id: 'shade-1', text: 'gray' }] };
    const cap = { id: 'cap', name: 'Cap', values: [{ id: 'cap-1', text: 'the cap of {{char}}' }] };
    const capped = entities.map((e) => (e.id === 'porter' ? { ...e, placeholders: [cap] } : e));
    const scene = liveChipScene(sources({ allEntities: capped, placeholders: [shade] }), null, {
      activeStats: [grit], activeTraits: [], resolve: (text) => text, resolveTrait: (_trait, text) => text,
      resolveEntity: (_entity, text) => `${text} [box]`,
    });
    const snapshot = buildToolSnapshot(scene, []);
    expect(Object.keys(snapshot.placeholders)).toEqual(['Shade']);
    expect(snapshot.world.entities.find((e) => e.id === 'porter')!.placeholders.Cap).toMatch(/ \[box\]$/);
  });

  it('hands the character pass a blurb with no raw chip in it', () => {
    const scene = liveChipScene(sources({ location: warehouse }));
    const entity = scene.entities.find((e) => e.id === 'porter');
    const message = buildCharacterUserMessage({ character: { name: 'Porter', entity }, scene: '', action: 'Wave.' });
    expect(message).toContain('My background (who I am in general, not this exact moment): Porter, a hauler.');
    expect(message).not.toContain('{{');
    const diary = buildDiaryUserMessage({ name: 'Porter', entity, narration: 'Porter waved.' });
    expect(diary).toContain('Porter, a hauler.');
    expect(diary).not.toContain('{{');
  });

  it("resolves the persona's own text with the persona as the Character Name", () => {
    const wren: Entity = { id: 'wren', name: 'Wren', persona: true, aiDescription: '{{char}} rows the ferry.' };
    const scene = liveChipScene(sources({ persona: { source: 'world', entity: wren } }));
    expect(chipValues(scene)['<PERSONA>']).toContain('Wren rows the ferry.');
  });

  describe('owned traits', () => {
    const loyal: Trait = { id: 'loyal', name: 'Loyal', aiDescription: '{{char}} stands by the player.', statChanges: [] };
    const sullen: Trait = { id: 'sullen', name: 'Sullen', aiDescription: '{{char}} answers in grunts.', statChanges: [] };
    const owned = entities.map((e) => (e.id === 'harbormaster' ? { ...e, traits: [loyal, sullen] } : e));
    const cast = sources({ entities: owned, allEntities: [...owned, stray] });

    it("gives an NPC its chosen traits minus the ones switched off, each resolved with its owner", () => {
      const values = chipValues(liveChipScene({
        ...cast, ownedTraits: { harbormaster: { chosen: ['loyal', 'sullen'], disabled: ['sullen'] } },
      }));
      expect(values['<ENTITIES>']).toContain('Loyal: Harbormaster stands by the player.');
      expect(values['<ENTITIES>']).not.toContain('Sullen');
      expect(values['<ENTITIES|summary>']).toContain('traits: Loyal');
    });

    it('gives an NPC nothing when the playthrough chose none of its traits', () => {
      expect(chipValues(liveChipScene(cast))['<ENTITIES>']).not.toContain('traits');
    });

    it("joins the played entity's owned traits to the player's", () => {
      const scar: Trait = { id: 'scar', name: 'Scarred', aiDescription: '{{char}} carries a scar.', statChanges: [] };
      const wren: Entity = { id: 'wren', name: 'Wren', persona: true, aiDescription: 'Rows the ferry.', traits: [scar] };
      const values = chipValues(liveChipScene({
        ...cast, persona: { source: 'world', entity: wren }, ownedTraits: { wren: { chosen: ['scar'] } },
      }));
      expect(values['<TRAITS DESCRIPTION>']).toBe('Sea Legs: Steady on any deck.\nScarred: Wren carries a scar.');
    });
  });

  it('carries no lore, since activation is per turn', () => {
    expect(liveChipScene(sources()).lore).toEqual([]);
  });
});
