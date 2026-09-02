import { describe, it, expect } from 'vitest';
import { buildEntityCardData, parseEntityCardData, ENTITY_FILE_KIND } from './entityFile';
import { embedEntityCard, readEntityCard } from './entityCard';
import type { Entity } from '@/types';

import { phValues } from '@/test/placeholderValues';
const entity: Entity = {
  id: 'orig-id',
  name: 'Wren',
  type: 'guide',
  playerDescription: 'A quiet marsh guide.',
  aiDescription: 'Wren knows every channel of the fen.',
  aiSummary: 'marsh guide',
  imageTags: 'woman, cloak, reeds',
  images: ['data:image/webp;base64,AAAA', 'data:image/webp;base64,BBBB'],
  model: { data: 'data:model', type: 'model/gltf-binary' },
  sound: { data: 'data:sound', type: 'audio/mpeg' },
};

// A minimal simple-lossy WebP container to embed into (framing only; the bitstream bytes are arbitrary).
function fakeWebp(): Uint8Array {
  const payload = [1, 2, 3, 4];
  const out = new Uint8Array(12 + 8 + payload.length);
  const view = new DataView(out.buffer);
  const put4 = (s: string, at: number) => { for (let i = 0; i < 4; i++) out[at + i] = s.charCodeAt(i); };
  put4('RIFF', 0);
  view.setUint32(4, out.length - 8, true);
  put4('WEBP', 8);
  put4('VP8 ', 12);
  view.setUint32(16, payload.length, true);
  out.set(payload, 20);
  return out;
}

describe('buildEntityCardData', () => {
  it('drops image/model/sound and stamps kind + version', () => {
    const card = buildEntityCardData(entity);
    expect(card.formamorphKind).toBe(ENTITY_FILE_KIND);
    expect(typeof card.version).toBe('string');
    expect(card.name).toBe('Wren');
    expect(card.aiDescription).toBe('Wren knows every channel of the fen.');
    expect(card).not.toHaveProperty('image');
    expect(card).not.toHaveProperty('model');
    expect(card).not.toHaveProperty('sound');
    expect(card).not.toHaveProperty('id');
  });

  it('omits empty optional fields', () => {
    const card = buildEntityCardData({ id: 'x', name: 'Bram' });
    expect(card).not.toHaveProperty('type');
    expect(card).not.toHaveProperty('aiSummary');
    expect(card).not.toHaveProperty('aliases');
    expect(card.name).toBe('Bram');
  });

  it('round-trips aliases, dropping empty/blank ones', () => {
    const card = buildEntityCardData({ id: 'z', name: 'Synthia', aliases: ['Matron', 'Em'] });
    expect(card.aliases).toEqual(['Matron', 'Em']);
    expect(parseEntityCardData(card).aliases).toEqual(['Matron', 'Em']);
    // A card whose aliases are all blank parses to no aliases field at all.
    expect(parseEntityCardData({ formamorphKind: 'entity', name: 'X', aliases: ['  ', ''] })).not.toHaveProperty('aliases');
    expect(buildEntityCardData({ id: 'q', name: 'Y', aliases: [] })).not.toHaveProperty('aliases');
  });

  it('bundles only the shared placeholders the entity actually uses, and reads them back on parse', () => {
    const eye = { id: 'eye', name: 'Eye Color', values: phValues(['Red', 'Blue']) };
    const unused = { id: 'unused', name: 'Weather', values: phValues(['Rain', 'Sun']) };
    const withChip: Entity = { id: 'y', name: 'Guard', aiDescription: 'Eyes: {{ph:eye:world:p1}}.' };
    const card = buildEntityCardData(withChip, [eye, unused]);
    expect(card.sharedPlaceholders).toEqual([eye]); // only the referenced one; `unused` excluded
    expect(card).not.toHaveProperty('placeholders'); // nothing of its own
    // Round-trips onto the parsed entity (which mints a fresh entity id but keeps the carried defs verbatim).
    const parsed = parseEntityCardData(card);
    expect(parsed.sharedPlaceholders).toEqual([eye]);
    expect(parsed.aiDescription).toContain('{{ph:eye:world:p1}}');
  });

  it('bundles the placeholders a name or an alias uses, not only the descriptions', () => {
    const town = { id: 'town', name: 'Town', values: phValues(['Sedge', 'Marrow']) };
    const beast = { id: 'beast', name: 'Beast', values: phValues(['Wolf']) };
    const unused = { id: 'unused', name: 'Weather', values: phValues(['Rain']) };
    // Nothing here has a description — without the name and alias being scanned, the card would carry
    // no defs and its chips would arrive pointing at ids the receiving world never had.
    const named: Entity = {
      id: 'z',
      name: 'Keeper {{ph:town:world:p1}}',
      aliases: ['the {{ph:beast:world:p2}}'],
    };
    const card = buildEntityCardData(named, [town, beast, unused]);
    expect(card.sharedPlaceholders).toEqual([town, beast]);
    expect(parseEntityCardData(card).name).toContain('{{ph:town:world:p1}}');
  });

  it('writes the entity’s own placeholders as they are, and the shared defs they and its chips reach', () => {
    const weather = { id: 'weather', name: 'Weather', values: phValues(['Rain', 'Sun']) };
    const unused = { id: 'unused', name: 'Season', values: phValues(['Spring']) };
    // Eyes is Molly's own and never placed in her text; its value reaches the shared Weather.
    const eyes = { id: 'eyes', name: 'Eyes', values: phValues(['{{ph:weather:world:v1}} gray']) };
    const molly: Entity = { id: 'm', name: 'Molly', imageTags: 'woman, {{ph:unused:world:p3}}', placeholders: [eyes] };
    const card = buildEntityCardData(molly, [weather, unused, eyes]);
    expect(card.placeholders).toEqual([eyes]);
    expect(card.sharedPlaceholders).toEqual([weather, unused]);
    const parsed = parseEntityCardData(card);
    expect(parsed.placeholders).toEqual([eyes]);
    expect(parsed.sharedPlaceholders).toEqual([weather, unused]);
    // A card written before the split reads its placeholders as owned.
    expect(parseEntityCardData({ formamorphKind: 'entity', name: 'Old', placeholders: [weather] }).placeholders).toEqual([weather]);
  });

  it('carries a shared def only a pin reaches, so the pin still resolves after import', () => {
    const weather = { id: 'weather', name: 'Weather', values: phValues(['Rain', 'Sun']) };
    const unused = { id: 'unused', name: 'Season', values: phValues(['Spring']) };
    const mood = {
      id: 'mood',
      name: 'Mood',
      values: [{ id: 'v:wild', text: 'wild', pins: [{ placeholderId: 'weather', value: 'Rain' }] }],
    };
    // Nothing Molly writes places Weather; only Mood's pin reaches it.
    const molly: Entity = { id: 'm', name: 'Molly', placeholders: [mood] };
    const card = buildEntityCardData(molly, [weather, unused, mood]);
    expect(card.sharedPlaceholders).toEqual([weather]);
    expect(card.placeholders?.[0].values[0].pins).toEqual([{ placeholderId: 'weather', value: 'Rain' }]);
  });

  it('drops the folder reference from every def it carries — folders are the world’s', () => {
    const weather = { id: 'weather', name: 'Weather', values: phValues(['Rain']), groupId: 'sky' };
    const eyes = { id: 'eyes', name: 'Eyes', values: phValues(['gray']), groupId: 'body' };
    const molly: Entity = { id: 'm', name: '{{ph:weather:world:p1}}', placeholders: [eyes] };
    const card = buildEntityCardData(molly, [weather, eyes]);
    expect(card.placeholders?.[0]).not.toHaveProperty('groupId');
    expect(card.sharedPlaceholders?.[0]).not.toHaveProperty('groupId');
    expect(card.sharedPlaceholders?.[0].id).toBe('weather');
  });

  it('reads a library entity’s own pool, owned then shared, when no world pool is given', () => {
    const weather = { id: 'weather', name: 'Weather', values: phValues(['Rain']) };
    const eyes = { id: 'eyes', name: 'Eyes', values: phValues(['gray']) };
    const stored: Entity = { id: 's', name: '{{ph:weather:world:p1}}', placeholders: [eyes], sharedPlaceholders: [weather] };
    const card = buildEntityCardData(stored);
    expect(card.placeholders).toEqual([eyes]);
    expect(card.sharedPlaceholders).toEqual([weather]);
  });
});

describe('parseEntityCardData', () => {
  it('regenerates the id on every parse', () => {
    const raw = buildEntityCardData(entity);
    const a = parseEntityCardData(raw);
    const b = parseEntityCardData(raw);
    expect(a.id).not.toBe('orig-id');
    expect(a.id).not.toBe(b.id);
    // Only the carried extras come back; the primary is the card's own pixels, added by the importer.
    expect(a.images).toEqual(['data:image/webp;base64,BBBB']);
    expect(a.name).toBe('Wren');
    expect(a.imageTags).toBe('woman, cloak, reeds');
  });

  it('rejects world, save, and dictionary payloads with distinct messages', () => {
    expect(() => parseEntityCardData({ formamorphKind: 'world' })).toThrow(/world/i);
    expect(() => parseEntityCardData({ formamorphKind: 'save' })).toThrow(/save/i);
    expect(() => parseEntityCardData({ formamorphKind: 'dictionary' })).toThrow(/dictionary/i);
    expect(() => parseEntityCardData({ foo: 1 })).toThrow(/not a character card/i);
    expect(() => parseEntityCardData(null)).toThrow();
  });

  it('defaults a missing name', () => {
    expect(parseEntityCardData({ formamorphKind: 'entity' }).name).toBe('Imported Character');
  });
});

describe('embed → read → parse chain', () => {
  it('round-trips the text fields through a WebP card', () => {
    const bytes = embedEntityCard(fakeWebp(), JSON.stringify(buildEntityCardData(entity)), { w: 4, h: 4 });
    const json = readEntityCard(bytes);
    expect(json).not.toBeNull();
    const parsed = parseEntityCardData(JSON.parse(json as string));
    expect(parsed.name).toBe('Wren');
    expect(parsed.aiSummary).toBe('marsh guide');
    expect(parsed.type).toBe('guide');
    expect(parsed.id).not.toBe('orig-id');
  });
});

/**
 * Listing tags on a character card.
 *
 * The card payload is an allowlist, not a spread — a field nobody adds to it is silently dropped on
 * export, which is exactly how somebody loses their tags by round-tripping a character through a file.
 */
describe('a character card’s tags', () => {
  it('travels with the card', () => {
    const built = buildEntityCardData({ ...entity, tags: ['npc', 'guide'] });

    expect(built.tags).toEqual(['npc', 'guide']);
    expect(parseEntityCardData(built).tags).toEqual(['npc', 'guide']);
  });

  it('is left off entirely when there are none', () => {
    // Absent rather than an empty array, like every other optional field on the card.
    expect(buildEntityCardData(entity)).not.toHaveProperty('tags');
    expect(parseEntityCardData(buildEntityCardData(entity))).not.toHaveProperty('tags');
  });

  it('stays separate from the image tags', () => {
    // `imageTags` is a booru string for the generator; these are what the catalog filters on. Reading one
    // as the other would tag a character with its own portrait prompt.
    const built = buildEntityCardData({ ...entity, tags: ['npc'] });

    expect(built.imageTags).toBe('woman, cloak, reeds');
    expect(built.tags).toEqual(['npc']);
  });

  it('drops junk in the list rather than importing it', () => {
    const parsed = parseEntityCardData({
      formamorphKind: ENTITY_FILE_KIND, version: '2.8.0', name: 'Wren',
      tags: ['npc', 7, '', null, '  '],
    });

    expect(parsed.tags).toEqual(['npc']);
  });
});
