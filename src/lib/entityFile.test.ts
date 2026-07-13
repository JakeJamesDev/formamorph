import { describe, it, expect } from 'vitest';
import { buildEntityCardData, parseEntityCardData, ENTITY_FILE_KIND } from './entityFile';
import { embedEntityCard, readEntityCard } from './entityCard';
import type { Entity } from '@/types';

const entity: Entity = {
  id: 'orig-id',
  name: 'Wren',
  type: 'guide',
  playerDescription: 'A quiet marsh guide.',
  aiDescription: 'Wren knows every channel of the fen.',
  aiSummary: 'marsh guide',
  imageTags: 'woman, cloak, reeds',
  image: 'data:image/webp;base64,AAAA',
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
    expect(card.name).toBe('Bram');
  });

  it('bundles only the placeholders the entity actually uses, and reads them back on parse', () => {
    const eye = { id: 'eye', name: 'Eye Color', values: ['Red', 'Blue'] };
    const unused = { id: 'unused', name: 'Weather', values: ['Rain', 'Sun'] };
    const withChip: Entity = { id: 'y', name: 'Guard', aiDescription: 'Eyes: {{ph:eye:world:p1}}.' };
    const card = buildEntityCardData(withChip, [eye, unused]);
    expect(card.placeholders).toEqual([eye]); // only the referenced one; `unused` excluded
    // Round-trips onto the parsed entity (which mints a fresh entity id but keeps the carried defs verbatim).
    const parsed = parseEntityCardData(card);
    expect(parsed.placeholders).toEqual([eye]);
    expect(parsed.aiDescription).toContain('{{ph:eye:world:p1}}');
  });
});

describe('parseEntityCardData', () => {
  it('regenerates the id on every parse', () => {
    const raw = buildEntityCardData(entity);
    const a = parseEntityCardData(raw);
    const b = parseEntityCardData(raw);
    expect(a.id).not.toBe('orig-id');
    expect(a.id).not.toBe(b.id);
    expect(a.image).toBeUndefined(); // filled by the importer, not the parser
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
