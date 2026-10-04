import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { composeMascot, type MascotImageRef, type MascotLayer, type MascotRig } from './mascot';
import { embedEntityCard, readEntityCard } from '@/lib/entityCard';
import { exportMascotCard, readMascotCard, storeMascotCard, type MascotCardExportDeps, type MascotCardStore } from './mascotCardFile';
import { addMascotImage, clearMascotImages, deleteMascotImage, getMascotImage } from './mascotImageStore';
import { mascotImageRefs } from './mascotRigEdits';
import { tinyWebp as webp } from '@/test/webpFixture';

const png = (text: string) => new Blob([text], { type: 'image/png' });

/** Each image's text, in order: the art here is text standing in for pixels. */
const texts = (blobs: readonly Blob[]) => Promise.all(blobs.map((blob) => blob.text()));

/** The stored rig: each image a different text, one shared by two layers. */
async function storedRig(): Promise<MascotRig> {
  const id = (text: string) => addMascotImage(png(text));
  const [body, arm, mouth, eyes] = [await id('body'), await id('arm'), await id('mouth'), await id('eyes')];
  const ref = (stored: string): MascotImageRef => ({ kind: 'stored', id: stored });
  const layer = (layerId: string, kind: MascotLayer['kind'], images: string[]): MascotLayer =>
    ({ id: layerId, name: layerId, kind, enabled: true, images: images.map(ref) });
  return {
    base: ref(body),
    layers: [layer('wave', 'state', [arm]), layer('smile', 'expression', [mouth, eyes]), layer('grin', 'expression', [mouth])],
    mask: { x: 4, y: 0, width: 40, height: 30 },
    picks: { initial: { expression: 'smile', state: 'wave' }, idle: { expression: null, state: null }, thinking: { expression: 'grin', state: null } },
    voice: 'Short.',
    transition: { mode: 'jelly', jelly: { durationMs: 300, squash: 0.1, overshoot: 0.05, settle: 0 }, dissolve: { durationMs: 200 } },
  };
}

/** Export through the real store, with a renderer that records what it was asked to draw. */
function exporter() {
  const drawn: Blob[][] = [];
  const deps: Partial<MascotCardExportDeps> = {
    render: async (layers) => { drawn.push([...layers]); return { bytes: webp(), width: 48, height: 32 }; },
    appVersion: 'test',
  };
  return { drawn, run: (rig: MascotRig, name = 'Captain') => exportMascotCard(name, rig, deps) };
}

/** Each rig image's text, in rig order: the base, then each layer's overlays. */
const rigTexts = async (rig: MascotRig) => texts(await Promise.all(mascotImageRefs(rig).map(async (ref) =>
  (ref.kind === 'stored' ? (await getMascotImage(ref.id))! : png('missing')))));

/** A store that records what it adds and fails on the add numbered `failAt`. */
function failingStore(failAt: number): MascotCardStore & { added: string[] } {
  const added: string[] = [];
  return {
    added,
    add: async (blob) => {
      if (added.length + 1 === failAt) throw new Error('Quota exceeded.');
      const id = await addMascotImage(blob);
      added.push(id);
      return id;
    },
    remove: deleteMascotImage,
  };
}

beforeEach(async () => {
  await clearMascotImages();
});

describe('the mascot card file', () => {
  it('round-trips the rig through export and import, images included', async () => {
    const rig = await storedRig();
    const card = await exporter().run(rig);
    const back = await storeMascotCard(await readMascotCard(card));
    const shape = (from: MascotRig) => ({ ...from, base: null, layers: from.layers.map((layer) => ({ ...layer, images: layer.images.length })) });
    expect(shape(back)).toEqual(shape(rig));
    expect(await rigTexts(back)).toEqual(await rigTexts(rig));
    // The shared image comes back as one stored image in both layers.
    expect(back.layers[1].images[0]).toEqual(back.layers[2].images[0]);
  });

  it('carries the mascot name', async () => {
    expect((await readMascotCard(await exporter().run(await storedRig(), 'Old Friend'))).name).toBe('Old Friend');
  });

  it('draws the Initial look as the visible image', async () => {
    const rig = await storedRig();
    const { drawn, run } = exporter();
    await run(rig);
    expect(drawn).toHaveLength(1);
    expect(await texts(drawn[0])).toEqual(['body', 'arm', 'mouth', 'eyes']);
    expect(drawn[0]).toHaveLength(composeMascot(rig, 'initial', null).length);
  });

  it('refuses an export when a stored image is gone', async () => {
    const rig = await storedRig();
    await deleteMascotImage((rig.layers[0].images[0] as { id: string }).id);
    const { drawn, run } = exporter();
    await expect(run(rig)).rejects.toThrow('One of your mascot images is missing. Replace it, then export again.');
    expect(drawn).toHaveLength(0);
  });
});

describe('a refused mascot card file', () => {
  it('refuses an image with no card data', async () => {
    await expect(readMascotCard(new Blob([webp()]))).rejects.toThrow("This image isn't a Formamorph mascot card.");
  });

  it('refuses a card of an unknown version by its number', async () => {
    const json = JSON.stringify({ formamorphKind: 'mascot', version: 9, appVersion: '9.0.0', images: [], rig: {} });
    await expect(readMascotCard(new Blob([embedEntityCard(webp(), json, { w: 1, h: 1 })])))
      .rejects.toThrow('This mascot card is version 9. This build reads version 1.');
  });

  it('refuses a card with a bad field by name', async () => {
    const card = await exporter().run(await storedRig());
    const json = readEntityCard(new Uint8Array(await card.arrayBuffer()))!.replace('"kind":"state"', '"kind":"pose"');
    await expect(readMascotCard(new Blob([embedEntityCard(webp(), json, { w: 1, h: 1 })])))
      .rejects.toThrow('This mascot card has a missing or bad field: rig.layers.0.kind.');
  });

  it('takes back every image it stored when one fails, and keeps the images already there', async () => {
    const kept = await addMascotImage(png('keep'));
    const card = await readMascotCard(await exporter().run(await storedRig()));
    const store = failingStore(3);
    await expect(storeMascotCard(card, store)).rejects.toThrow('Quota exceeded.');
    expect(store.added).toHaveLength(2);
    for (const id of store.added) expect(await getMascotImage(id)).toBeNull();
    expect(await (await getMascotImage(kept))!.text()).toBe('keep');
  });
});
