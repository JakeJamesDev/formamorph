import { describe, it, expect, vi } from 'vitest';

// The encoder needs a canvas; the gallery shape is what is under test, so each picture passes through.
vi.mock('./imageOptim', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./imageOptim')>()),
  optimizeImageDataUrl: async (url: string) => `OPT:${url}`,
}));

const { importCharacterFile } = await import('./entityFile');
const { readStPersonaFiles } = await import('./stPersonaImport');
const { bytesToDataUrl } = await import('./imageOptim');

const enc = new TextEncoder();

/** A PNG carrying one `chara` text chunk with the card JSON in base64. */
function tavernPng(card: unknown): Uint8Array<ArrayBuffer> {
  const chunk = (type: string, data: Uint8Array) => {
    const len = data.length;
    return [(len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff, ...enc.encode(type), ...data, 0, 0, 0, 0];
  };
  const text = btoa(String.fromCharCode(...enc.encode(JSON.stringify(card))));
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('tEXt', enc.encode(`chara\0${text}`)),
    ...chunk('IEND', new Uint8Array()),
  ]);
}

describe('a foreign character’s portrait', () => {
  it('lands as one image with no rule from a SillyTavern PNG card', async () => {
    const bytes = tavernPng({ spec: 'chara_card_v2', spec_version: '2.0', data: { name: 'Aria', description: 'Kind.' } });
    const { entity } = await importCharacterFile(new File([bytes], 'aria.png', { type: 'image/png' }));
    expect(entity.images).toEqual([{ data: `OPT:${bytesToDataUrl(bytes, 'image/png')}` }]);
  });

  it('lands as one image with no rule from a SillyTavern persona backup', async () => {
    const backup = new File([JSON.stringify({ personas: { 'aria.png': 'Aria' }, persona_descriptions: {} })], 'personas.json');
    const avatar = new File([new Uint8Array([1, 2, 3])], 'aria.png', { type: 'image/png' });
    const { personas } = await readStPersonaFiles(backup, [avatar]);
    expect(personas[0].entity.images).toEqual([{ data: `OPT:${bytesToDataUrl(new Uint8Array([1, 2, 3]), 'image/png')}` }]);
  });
});
