// @vitest-environment node
// Node's Blob survives fake-indexeddb's clone; the dom project's does not.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll } from 'vitest';
import source from './profileMergeSource.cjs';
import profileMerge from './profileMerge.cjs';

const { pageSummaries, pageRecord } = source;
const { SOURCE_STORES } = profileMerge;

const open = (name, store) => new Promise((resolve, reject) => {
  const req = indexedDB.open(name, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(store, { keyPath: 'id' });
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const put = (db, store, value) => new Promise((resolve, reject) => {
  const tx = db.transaction([store], 'readwrite');
  tx.objectStore(store).put(value);
  tx.oncomplete = resolve;
  tx.onerror = () => reject(tx.error);
});

const FILE = 'x'.repeat(2500);

beforeAll(async () => {
  const models = await open(SOURCE_STORES.avatars.db, SOURCE_STORES.avatars.store);
  await put(models, 'models', {
    id: 'av', name: 'Avatar', createdAt: '2026-01-01T00:00:00.000Z',
    data: { type: 'model/vrm', blob: new Blob([FILE], { type: 'model/vrm' }), size: FILE.length },
  });
  await put(models, 'models', { id: 'flat', name: 'Flat', blob: new Blob(['abcd']), addedAt: '2026-01-01T00:00:00.000Z' });
  models.close();
  const images = await open(SOURCE_STORES.mascotImages.db, SOURCE_STORES.mascotImages.store);
  await put(images, 'images', { id: 'img', blob: new Blob(['png'], { type: 'image/png' }) });
  images.close();
});

describe('AppData reader', () => {
  it('weighs a record by its file, not by its JSON', async () => {
    const out = await pageSummaries([
      { key: 'avatars', ...SOURCE_STORES.avatars },
      { key: 'mascotImages', ...SOURCE_STORES.mascotImages },
    ]);
    expect(out.avatars.find((s) => s.id === 'av').size).toBe(FILE.length);
    expect(out.avatars.find((s) => s.id === 'flat').size).toBe(4);
    expect(out.mascotImages[0].size).toBe(3);
  });

  it('sends a nested file as base64 that decodes to its bytes and type', async () => {
    const record = await pageRecord({ ...SOURCE_STORES.avatars, id: 'av' });
    expect(record.data.blob).toMatchObject({ __blob: true, type: 'model/vrm' });
    expect(atob(record.data.blob.base64)).toBe(FILE);
    expect(record.data.size).toBe(FILE.length);
  });

  it('sends a top-level file the same way', async () => {
    const record = await pageRecord({ ...SOURCE_STORES.mascotImages, id: 'img' });
    expect(record.blob).toMatchObject({ __blob: true, type: 'image/png' });
    expect(atob(record.blob.base64)).toBe('png');
  });

  it('answers null for an id or a database the profile lacks', async () => {
    expect(await pageRecord({ ...SOURCE_STORES.mascotImages, id: 'nope' })).toBeNull();
    expect(await pageRecord({ db: 'absentDB', store: 's', id: 'x' })).toBeNull();
  });
});
