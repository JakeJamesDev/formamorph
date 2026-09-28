import { describe, it, expect } from 'vitest';
import { authoredChipScene, type AuthoredWorld } from './authoredScene';
import { chipValues } from './chipValues';
import { NONE_PLACEHOLDER } from '../promptFallbacks';
import type { Entity, GameLocation, Stat, Trait, TraitGroup, TraitLink, WorldOverview } from '@/types';
import { phValueId, phValues } from '@/test/placeholderValues';

const jetty: GameLocation = { id: 'jetty', name: 'The Jetty', isStarting: true, aiDescription: 'Wet planks over black water.' };
const landing: GameLocation = { id: 'landing', name: 'The Landing', aiDescription: 'A stone shore below the town.' };

const wren: Entity = { id: 'wren', name: 'Wren', locations: ['jetty'], aiDescription: 'The lamp-keeper.' };
const harrow: Entity = { id: 'harrow', name: 'Harrow', locations: ['landing'], aiDescription: 'Sells maps.' };

const warmth: Stat = { id: 'warmth', name: 'Warmth', type: 'number', description: '', min: 0, max: 100, value: 40, regen: 0, descriptors: [] };
const nerve: Stat = { id: 'nerve', name: 'Nerve', type: 'number', description: '', min: 10, max: 100, regen: 0, descriptors: [] };

const saltborn: Trait = { id: 'saltborn', name: 'Saltborn', isDefault: true, aiDescription: 'Raised on the coast.', statChanges: [] };
const landlocked: Trait = { id: 'landlocked', name: 'Landlocked', aiDescription: 'Never saw the sea.', statChanges: [] };

const world = (over: Partial<AuthoredWorld> = {}): AuthoredWorld => ({
  worldOverview: { name: 'Sedge Landing', description: '', systemPrompt: 'A drowned coast.' } as WorldOverview,
  stats: [warmth, nerve],
  locations: [jetty, landing],
  entities: [wren, harrow],
  traits: [saltborn, landlocked],
  dictionaries: [{
    id: 'book', name: 'Book', entries: [
      { id: 'sea', name: 'The Sea', key: ['sea'], value: 'It takes and does not give back.' },
      { id: 'lamps', name: 'Lamps', key: ['lamp'], value: 'No lamps after dusk.', position: 'before' },
      { id: 'off', name: 'Off', key: ['off'], value: 'Never injected.', enabled: false },
    ],
  }],
  ...over,
});

describe('authoredChipScene and the Character Name chip', () => {
  const keeper: Entity = { ...wren, aiDescription: '{{char}} keeps the lamps.' };

  it("resolves each entity's text with that entity as its owner", () => {
    expect(chipValues(authoredChipScene(world({ entities: [keeper, harrow] })))['<ENTITIES>'])
      .toContain('Wren keeps the lamps.');
  });

  it("takes the caller's entity resolution beside its own resolve", () => {
    const scene = authoredChipScene(world({ entities: [keeper, harrow] }), {
      resolve: (text) => text,
      resolveEntity: (entity, text) => text.replaceAll('{{char}}', entity.name.toUpperCase()),
    });
    expect(scene.entities[0].aiDescription).toBe('WREN keeps the lamps.');
  });

  it("leaves entity text to a caller's resolve that brings no entity resolution", () => {
    const scene = authoredChipScene(world({ entities: [keeper, harrow] }), { resolve: (text) => text });
    expect(scene.entities[0]).toBe(keeper);
  });
});

describe('authoredChipScene', () => {
  it('opens the world at its starting location with the cast the author placed there', () => {
    const scene = authoredChipScene(world());
    expect(scene.location).toBe(jetty);
    expect(scene.presentIds).toEqual(['wren']);
    // No turn has happened, so the scene holds only who is here.
    expect(scene.inSceneIds).toEqual(['wren']);
    expect(scene.entities).toEqual([wren, harrow]);
  });

  it('starts every stat at its authored value, or its minimum when none is set', () => {
    const scene = authoredChipScene(world());
    expect(scene.stats.map((s) => [s.name, s.value])).toEqual([['Warmth', 40], ['Nerve', 10]]);
  });

  it('holds the default traits in force and leaves the others out', () => {
    expect(authoredChipScene(world()).traits).toEqual([saltborn]);
  });

  it("holds each entity's default owned traits in force, as the entry step preselects them", () => {
    const keen: Trait = { id: 'keen', name: 'Keen-Eyed', isDefault: true, aiDescription: '{{char}} sees the far shore.', statChanges: [] };
    const idle: Trait = { id: 'idle', name: 'Idle', aiDescription: 'Sits all day.', statChanges: [] };
    const scene = authoredChipScene(world({ entities: [{ ...wren, traits: [keen, idle] }, harrow] }));
    expect(scene.ownedTraits).toEqual({ wren: ['keen'] });
    expect(chipValues(scene)['<ENTITIES>']).toContain('Keen-Eyed: Wren sees the far shore.');
  });

  it("resolves an owned trait's text with its owner and its own pins", () => {
    const coat = { id: 'coat', name: 'Coat', values: phValues(['gray', 'red']) };
    const worn: Trait = {
      id: 'worn', name: 'Red Coat', isDefault: true, aiDescription: '{{char}} wears a {{ph:coat:world:p1}} coat.',
      statChanges: [], placeholderPins: [{ placeholderId: 'coat', value: 'crimson' }],
    };
    const scene = authoredChipScene(world({ entities: [{ ...wren, traits: [worn] }, harrow], placeholders: [coat] }));
    expect(chipValues(scene)['<ENTITIES>']).toContain('Red Coat: Wren wears a crimson coat.');
  });

  describe('linked traits', () => {
    const blueprints: TraitGroup = { id: 'blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' };
    const garb = { id: 'garb', name: 'Garb', values: phValues(['robes', 'chain']) };
    const paladin: Trait = {
      id: 'paladin', name: 'Paladin', groupId: 'blueprints', isDefault: true, statChanges: [],
      aiDescription: '{{char}} swore the oath in {{ph:garb:world:p1}}.',
      placeholderPins: [{ placeholderId: 'garb', valueId: phValueId('robes'), value: 'robes' }],
    };
    const link = (id: string, over: Partial<TraitLink> = {}): TraitLink =>
      ({ id, originalId: 'paladin', kind: 'trait', originalName: 'Paladin', groupId: null, ...over });
    /** A link overriding Paladin's pins list with one plain pin on Garb. */
    const pinning = (id: string, value: string) => link(id, {
      overrides: { paladin: { placeholderPins: { value: [{ placeholderId: 'garb', value }], blueprint: paladin.placeholderPins! } } },
    });
    const linked = (over: Partial<AuthoredWorld> = {}) => world({
      traits: [saltborn, paladin], traitGroups: [blueprints], placeholders: [garb], ...over,
    });

    it("holds a cast entity's default link in force: full text with the link's own pins, and its name in the summary", () => {
      const knight = { ...wren, traitLinks: [pinning('l1', 'silver plate')] };
      const scene = authoredChipScene(linked({ entities: [knight, harrow] }));
      expect(scene.ownedTraits).toEqual({ wren: ['paladin'] });
      const values = chipValues(scene);
      expect(values['<ENTITIES>']).toContain('Paladin: Wren swore the oath in silver plate.');
      expect(values['<ENTITIES|summary>']).toContain('traits: Paladin');
    });

    it("names a cast entity's linked trait for that entity in the summary", () => {
      const vow: Trait = { id: 'vow', name: '{{char}}’s Vow', groupId: 'blueprints', isDefault: true, statChanges: [] };
      const knight = { ...wren, traitLinks: [link('l1', { originalId: 'vow', originalName: 'Vow' })] };
      const values = chipValues(authoredChipScene(linked({ traits: [saltborn, vow], entities: [knight, harrow] })));
      expect(values['<ENTITIES|summary>']).toContain('traits: Wren’s Vow');
    });

    it("names the player in the player's group text", () => {
      const oaths: TraitGroup = { id: 'oaths', name: 'Oaths', aiDescription: '{{char}} is sworn.', parentId: null };
      const sworn: Trait = { id: 'sworn', name: 'Sworn', groupId: 'oaths', isDefault: true, statChanges: [] };
      const values = chipValues(authoredChipScene(linked({ traits: [sworn], traitGroups: [blueprints, oaths] })));
      expect(values['<TRAITS DESCRIPTION>']).toBe('Oaths:\n  The player is sworn.\n  Sworn');
    });

    it("reads a link's own default-on over the original's", () => {
      const knight = { ...wren, traitLinks: [link('l1', { overrides: { paladin: { isDefault: { value: false, blueprint: true } } } })] };
      expect(authoredChipScene(linked({ entities: [knight, harrow] })).ownedTraits).toEqual({});
    });

    it("reads a cast entity's linked trait with the original's pins when the link reads them live", () => {
      const knight = { ...wren, traitLinks: [link('l1')] };
      expect(chipValues(authoredChipScene(linked({ entities: [knight, harrow] })))['<ENTITIES>'])
        .toContain('Paladin: Wren swore the oath in robes.');
    });

    it("reads a blueprint chip in a linked original's text through the entity's own copy", () => {
      const vow: Trait = { id: 'vow', name: 'Vow', groupId: 'blueprints', isDefault: true, statChanges: [], aiDescription: '{{char}} wears {{ph:garb:world:p2}}.' };
      // Wren's copy rewords robes and removes chain, so it reads one fixed value.
      const copy = {
        id: 'wren-garb', name: 'Garb', values: [], blueprintId: 'garb',
        valueOverrides: { [phValueId('robes')]: { text: { value: 'sackcloth', blueprint: 'robes' } }, [phValueId('chain')]: { removed: true as const } },
      };
      const knight = { ...wren, placeholders: [copy], traitLinks: [link('l1', { originalId: 'vow', originalName: 'Vow' })] };
      const values = chipValues(authoredChipScene(linked({ traits: [saltborn, vow], entities: [knight, harrow] })));
      expect(values['<ENTITIES>']).toContain('Vow: Wren wears sackcloth.');
    });

    it("never counts a default Blueprints trait as the player's", () => {
      expect(chipValues(authoredChipScene(linked()))['<TRAITS DESCRIPTION>']).toBe('Saltborn: Raised on the coast.');
    });

    it("holds a Custom Persona entity's default link under the entity, and never folds it into the root", () => {
      const newcomer: Entity = { id: 'cp', name: 'Newcomer', customPersona: true, traitLinks: [pinning('l2', 'plain robes')] };
      const scene = authoredChipScene(linked({ entities: [newcomer, wren, harrow] }));
      expect(scene.ownedTraits).toEqual({ cp: ['paladin'] });
      expect(scene.traits).toEqual([saltborn]);
      // The marked entity is never in the cast, so it opens nowhere.
      expect(scene.presentIds).toEqual(['wren']);
    });
  });

  it('holds every enabled lore entry with its position, since no keyword has fired yet', () => {
    const scene = authoredChipScene(world());
    expect(scene.lore.map((e) => [e.name, e.position ?? 'after'])).toEqual([['The Sea', 'after'], ['Lamps', 'before']]);
  });

  it('has no persona, no notes and no clock', () => {
    const scene = authoredChipScene(world());
    expect(scene.persona).toBeNull();
    expect(scene.notes).toBe('');
    expect(scene.time).toBeNull();
  });

  it('reads nowhere for a world with no locations', () => {
    const scene = authoredChipScene(world({ locations: [], entities: [] }));
    expect(scene.location).toBeNull();
    expect(chipValues(scene)['<LOCATION>']).toBe(NONE_PLACEHOLDER);
  });

  it('resolves a placeholder chip against a fresh roll, so a Wildcard shows a value and not its token', () => {
    const w = world({
      worldOverview: { name: 'Sedge Landing', description: '', systemPrompt: 'The tide is {{ph:tide:world:p1}}.' } as WorldOverview,
      placeholders: [{ id: 'tide', name: 'Tide', values: phValues(['out']) }],
    });
    expect(chipValues(authoredChipScene(w))['<WORLD DESCRIPTION>']).toBe('The tide is out.');
  });

  it('takes the Opening instrument’s overrides: traits, settled stats, location and resolution', () => {
    const settled = [{ ...warmth, value: 77 }];
    const scene = authoredChipScene(world(), {
      activeTraitIds: ['landlocked'],
      stats: settled,
      location: landing,
      resolve: (text) => text.replace('Harrow', 'Peddler'),
    });
    expect(scene.traits).toEqual([landlocked]);
    expect(scene.stats).toBe(settled);
    expect(scene.location).toBe(landing);
    expect(scene.presentIds).toEqual(['harrow']);
    expect(chipValues(scene)['<ENTITIES|name>']).toBe('Peddler');
  });

  it('treats a null location override as nowhere, not as a missing field', () => {
    expect(authoredChipScene(world(), { location: null }).location).toBeNull();
  });
});
