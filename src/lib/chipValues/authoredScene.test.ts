import { describe, it, expect } from 'vitest';
import { authoredChipScene, type AuthoredWorld } from './authoredScene';
import { chipValues } from './chipValues';
import { NONE_PLACEHOLDER } from '../promptFallbacks';
import type { Entity, GameLocation, Stat, Trait, WorldOverview } from '@/types';
import { phValues } from '@/test/placeholderValues';

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
