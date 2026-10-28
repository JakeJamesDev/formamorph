import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { bytesToDataUrl } from '@/lib/imageBytes';
import { buildPublishBody } from '@/lib/publishBody';
import { tinyWebp } from '@/test/webpFixture';
import { DEFAULT_MASCOT_RIG, MASCOT_PICK_NAMES, type MascotLayer, type MascotRig } from './mascot';
import type { MascotCardExportDeps } from './mascotCardFile';
import { addMascotImage, clearMascotImages } from './mascotImageStore';
import { buildMascotPublish, bundledMascotParts } from './mascotPublish';

const MB = 1024 * 1024;

const look = tinyWebp();
const deps: Partial<MascotCardExportDeps> = { render: async () => ({ bytes: look, width: 4, height: 4 }), appVersion: 'test' };

const stored = async (bytes: Uint8Array<ArrayBuffer> = tinyWebp()) => ({ kind: 'stored' as const, id: await addMascotImage(new Blob([bytes], { type: 'image/webp' })) });

/** A rig of stored images only, with `extra` more layers after the one that holds `art`. */
async function ownRig(art: Uint8Array<ArrayBuffer> = tinyWebp(), extra: MascotLayer[] = []): Promise<MascotRig> {
  const wave: MascotLayer = { id: 'wave', name: 'Wave', kind: 'state', enabled: true, images: [await stored(art)] };
  return {
    ...DEFAULT_MASCOT_RIG,
    base: await stored(),
    layers: [wave, ...extra],
    mask: null,
    picks: Object.fromEntries(MASCOT_PICK_NAMES.map((name) => [name, { expression: null, state: name === 'initial' ? 'wave' : null }])) as MascotRig['picks'],
  };
}

beforeEach(async () => {
  await clearMascotImages();
});

describe('publishing a Mascot', () => {
  it('sends the card data with the Initial render as the thumbnail', async () => {
    const attempt = await buildMascotPublish('Captain', await ownRig(), deps);
    if (!attempt.allowed) throw new Error(attempt.message);
    expect(attempt.payload).toMatchObject({ kind: 'mascot', name: 'Captain', description: '', tags: [], thumbnail: bytesToDataUrl(look, 'image/webp') });
    expect(attempt.payload.contentData).toMatchObject({ formamorphKind: 'mascot', name: 'Captain' });
  });

  it('refuses the Default rig and names the parts that hold bundled art', async () => {
    const attempt = await buildMascotPublish('Copy', DEFAULT_MASCOT_RIG, deps);
    expect(attempt).toMatchObject({ allowed: false, reason: 'bundled' });
    expect(bundledMascotParts(DEFAULT_MASCOT_RIG)).toEqual(expect.arrayContaining(['Base Image', 'Wave']));
  });

  it('names only the layer that still holds bundled art', async () => {
    const mixed: MascotLayer = { ...DEFAULT_MASCOT_RIG.layers[0], id: 'bundled-layer', name: 'Old Face' };
    const rig = await ownRig(tinyWebp(), [mixed]);
    expect(bundledMascotParts(rig)).toEqual(['Old Face']);
    const attempt = await buildMascotPublish('Mixed', rig, deps);
    expect(attempt).toMatchObject({ allowed: false, reason: 'bundled', message: expect.stringContaining('Old Face') });
  });

  it('refuses a Mascot over 10 MB of decoded image bytes and states its size', async () => {
    const attempt = await buildMascotPublish('Huge', await ownRig(new Uint8Array(11 * MB)), deps);
    expect(attempt).toMatchObject({ allowed: false, reason: 'size' });
    if (attempt.allowed || attempt.reason !== 'size') throw new Error('expected a size refusal');
    expect(attempt.bytes).toBeGreaterThan(11 * MB);
    expect(attempt.message).toContain('11 MB');
    expect(attempt.message).toContain('10 MB');
  });

  it('counts decoded bytes, not the larger JSON: 9 MB of art goes through', async () => {
    const attempt = await buildMascotPublish('Big', await ownRig(new Uint8Array(9 * MB)), deps);
    if (!attempt.allowed) throw new Error(attempt.message);
    // The JSON carries the base64 text, a third larger than the 10 MB cap.
    expect(buildPublishBody(attempt.payload, null).body.size).toBeGreaterThan(10 * MB);
    expect(buildPublishBody(attempt.payload, null).bytes).toBeLessThan(10 * MB);
  });
});
