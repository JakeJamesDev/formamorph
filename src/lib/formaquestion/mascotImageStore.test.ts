import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

describe('mascot image store', () => {
  // A fresh module per test drops the cached connection, as a reload does; the factory keeps the data.
  let store: typeof import('./mascotImageStore');
  const reload = async () => {
    vi.resetModules();
    store = await import('./mascotImageStore');
  };
  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    await reload();
  });
  afterEach(() => vi.unstubAllGlobals());

  const png = (text: string) => new Blob([text], { type: 'image/png' });

  it('adds an image under a new id and gets its blob back', async () => {
    const id = await store.addMascotImage(png('eyes'));
    const other = await store.addMascotImage(png('mouth'));
    expect(other).not.toBe(id);
    const blob = await store.getMascotImage(id);
    expect(blob?.type).toBe('image/png');
    expect(blob?.size).toBe(4);
  });

  it('keeps the blob across a reload', async () => {
    const id = await store.addMascotImage(png('base-art'));
    await reload();
    expect((await store.getMascotImage(id))?.size).toBe(8);
  });

  it('deletes one image and leaves the others', async () => {
    const gone = await store.addMascotImage(png('a'));
    const kept = await store.addMascotImage(png('b'));
    await store.deleteMascotImage(gone);
    expect(await store.getMascotImage(gone)).toBeNull();
    expect(await store.getMascotImage(kept)).not.toBeNull();
  });

  it('clears every image', async () => {
    const ids = [await store.addMascotImage(png('a')), await store.addMascotImage(png('b'))];
    await store.clearMascotImages();
    for (const id of ids) expect(await store.getMascotImage(id)).toBeNull();
  });

  it('reads an unknown id as null', async () => {
    expect(await store.getMascotImage('nothing')).toBeNull();
  });
});
