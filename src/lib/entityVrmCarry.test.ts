// @vitest-environment jsdom
// Must load before the services: their singleton constructors open IndexedDB.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModelStorageService from '@/services/ModelStorageService';
import EntityStorageService from '@/services/EntityStorageService';
import WorldStorageService from '@/services/WorldStorageService';
import { promisifyRequest } from '@/lib/idb';
import { blobToDataUrl } from '@/lib/imageSource';
import { makeVrm1 } from '@/test/glbFixture';
import { buildEntityCardData, importCharacterFile } from './entityFile';
import { embedEntityCard } from './entityCard';
import { entityPublishPayload, worldPublishPayload } from './publishPayload';
import { PUBLISH_LIMITS } from './publishLimits';
import { saveDownloadToLibrary } from './librarySources';
import { withCarriedVrm } from './entityVrmCarry';
import type { Entity, MediaAsset, World } from '@/types';

vi.mock('@/lib/jsonFileWorkerUtils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await (await import('@/test/inlineJsonWorker')).inlineJsonWorker()),
}));

/**
 * An entity's Avatar travelling in a character card or entity listing: embedded on export, adopted into the
 * Avatar library by hash on import, and counted by the publish size check. Runs against the real library store.
 */

const vrmFile = (title: string) => new File([makeVrm1({ title })], `${title}.vrm`, { type: 'model/vrm' });

const asset = async (file: File): Promise<MediaAsset> =>
  ({ data: await blobToDataUrl(file), type: 'model/vrm', name: file.name, size: file.size });

/** The files added this test, by record id. fake-indexeddb's structured clone returns a stored Blob that jsdom's
 *  FileReader rejects; a browser returns the Blob itself, so a read gets the original bytes back. */
const added = new Map<string, Blob>();
const addModel = async (file: File) => {
  const record = await ModelStorageService.addModel(file);
  added.set(record.id, file);
  return record;
};

const clearLibrary = async () => {
  const db = await new Promise<IDBDatabase>((resolve) => {
    const req = indexedDB.open('FORMAMORPH_MODELS_DB');
    req.onsuccess = () => resolve(req.result);
  });
  await promisifyRequest(db.transaction(['models'], 'readwrite').objectStore('models').clear());
  db.close();
};

const libraryIds = async () => (await ModelStorageService.getModelMetadata()).map((model) => model.id);

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

/** The entity as a character card file, written the way `exportEntityCard` writes one. */
const cardFile = async (entity: Entity, store?: World['worldOverview']['vrmStore']) => {
  const bytes = embedEntityCard(fakeWebp(), JSON.stringify(buildEntityCardData(await withCarriedVrm(entity, store))), { w: 4, h: 4 });
  const file = new File([bytes], 'card.webp', { type: 'image/webp' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
  return file;
};

beforeEach(async () => {
  await ModelStorageService.initialize();
  await clearLibrary();
  // Reset the private migration latch so each test reads the cleared store.
  (ModelStorageService as unknown as { migration: Promise<void> | null }).migration = null;
  localStorage.clear();
  added.clear();
  const read = ModelStorageService.getModelData.bind(ModelStorageService);
  vi.spyOn(ModelStorageService, 'getModelData').mockImplementation(async (id) => {
    const data = await read(id);
    return added.has(id) ? { ...data, blob: added.get(id)! } : data;
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const record of await EntityStorageService.getEntityMetadata()) await EntityStorageService.deleteEntity(record.id);
});

describe('character card export', () => {
  it('carries the library Avatar the entity picks', async () => {
    const file = vrmFile('Heron');
    const record = await addModel(file);

    const card = buildEntityCardData(await withCarriedVrm({ id: 'e1', name: 'Wren', vrmPick: { kind: 'library', id: record.id } }));

    expect(card.vrmPick).toEqual({ kind: 'library', id: record.id });
    expect(card.vrm).toMatchObject({ name: 'Heron', file: { data: await blobToDataUrl(file) } });
    expect(card.vrm?.hash).toBeTruthy();
  });

  it("carries a world entity's store Avatar", async () => {
    const file = await asset(vrmFile('Kite'));
    const store = { w1: { name: 'Kite', file, hash: 'kite-hash' } };

    const card = buildEntityCardData(await withCarriedVrm({ id: 'e1', name: 'Wren', vrmPick: { kind: 'world', id: 'w1' } }, store));

    expect(card.vrm).toEqual({ name: 'Kite', file, hash: 'kite-hash' });
  });

  it("exports none and User's Default as they are, with no file", async () => {
    const none = buildEntityCardData(await withCarriedVrm({ id: 'e1', name: 'Wren' }));
    const fallback = buildEntityCardData(await withCarriedVrm({ id: 'e1', name: 'Wren', vrmPick: { kind: 'default' } }));

    expect(none).not.toHaveProperty('vrmPick');
    expect(none).not.toHaveProperty('vrm');
    expect(fallback.vrmPick).toEqual({ kind: 'default' });
    expect(fallback).not.toHaveProperty('vrm');
  });

  it('carries the newly picked Avatar over the one the entity already embeds', async () => {
    const embedded = { name: 'Heron', file: await asset(vrmFile('Heron')), hash: 'heron-hash' };
    const file = vrmFile('Kite');
    const record = await addModel(file);

    const card = buildEntityCardData(await withCarriedVrm({ id: 'e1', name: 'Wren', vrmPick: { kind: 'library', id: record.id }, vrm: embedded }));

    expect(card.vrm).toMatchObject({ name: 'Kite', file: { data: await blobToDataUrl(file) } });
  });

  it('keeps an embedded Avatar the pick still names', async () => {
    const file = await asset(vrmFile('Kite'));
    const embedded = { name: 'Kite (shared)', file, hash: 'kite-hash' };
    const store = { w1: { name: 'Kite', file, hash: 'kite-hash' } };

    const card = buildEntityCardData(await withCarriedVrm({ id: 'e1', name: 'Wren', vrmPick: { kind: 'world', id: 'w1' }, vrm: embedded }, store));

    expect(card.vrm).toEqual(embedded);
  });

  it('keeps an embedded Avatar the pick cannot find on this device', async () => {
    const embedded = { name: 'Kite', file: await asset(vrmFile('Kite')), hash: 'kite-hash' };

    const card = buildEntityCardData(await withCarriedVrm({ id: 'e1', name: 'Wren', vrmPick: { kind: 'library', id: 'authors-device' }, vrm: embedded }));

    expect(card.vrmPick).toEqual({ kind: 'library', id: 'authors-device' });
    expect(card.vrm).toEqual(embedded);
  });

  it('exports a pick whose Avatar is gone as none', async () => {
    const card = buildEntityCardData(await withCarriedVrm({ id: 'e1', name: 'Wren', vrmPick: { kind: 'library', id: 'deleted' } }));

    expect(card).not.toHaveProperty('vrmPick');
    expect(card).not.toHaveProperty('vrm');
  });
});

describe('character card import', () => {
  it('adds the carried Avatar once and points every import at it', async () => {
    const record = await addModel(vrmFile('Heron'));
    const card = await cardFile({ id: 'e1', name: 'Wren', vrmPick: { kind: 'library', id: record.id } });
    // Another device: the importer's library does not hold the author's record.
    await clearLibrary();

    const first = (await importCharacterFile(card)).entity;
    const second = (await importCharacterFile(card)).entity;

    const ids = await libraryIds();
    expect(ids).toHaveLength(1);
    expect(first.vrmPick).toEqual({ kind: 'library', id: ids[0] });
    expect(second.vrmPick).toEqual({ kind: 'library', id: ids[0] });
    expect(first).not.toHaveProperty('vrm');
  });

  it('reuses a library record that already holds the same file', async () => {
    const file = vrmFile('Heron');
    const held = await addModel(file);
    const card = await cardFile({ id: 'e1', name: 'Wren', vrmPick: { kind: 'world', id: 'w1' } }, { w1: { name: 'Heron', file: await asset(file) } });

    const { entity } = await importCharacterFile(card);

    expect(entity.vrmPick).toEqual({ kind: 'library', id: held.id });
    expect(await libraryIds()).toEqual([held.id]);
  });

  it("keeps User's Default and drops a library pick that carries no file", async () => {
    const fallback = (await importCharacterFile(await cardFile({ id: 'e1', name: 'Wren', vrmPick: { kind: 'default' } }))).entity;
    const bytes = embedEntityCard(fakeWebp(), JSON.stringify({ ...buildEntityCardData({ id: 'e2', name: 'Moth' }), vrmPick: { kind: 'library', id: 'elsewhere' } }), { w: 4, h: 4 });
    const bare = new File([bytes], 'card.webp', { type: 'image/webp' });
    Object.defineProperty(bare, 'arrayBuffer', { value: async () => bytes.buffer });

    expect(fallback.vrmPick).toEqual({ kind: 'default' });
    expect((await importCharacterFile(bare)).entity).not.toHaveProperty('vrmPick');
    expect(await libraryIds()).toEqual([]);
  });

  it('keeps the pick when a card that names a listing is stored through the listing path', async () => {
    const record = await addModel(vrmFile('Heron'));
    const card = await cardFile({ id: 'e1', name: 'Wren', vrmPick: { kind: 'library', id: record.id } });
    await clearLibrary();

    const { entity } = await importCharacterFile(card);
    const installed = await saveDownloadToLibrary('entity', entity, { sourceId: 'listing-1', name: 'Wren' });

    const ids = await libraryIds();
    expect(ids).toHaveLength(1);
    expect((await EntityStorageService.getEntityData(installed.libraryId)).vrmPick).toEqual({ kind: 'library', id: ids[0] });
  });

  it('ignores an Avatar file that is not embedded, and fetches nothing', async () => {
    const fetchSpy = vi.fn();
    const bytes = embedEntityCard(fakeWebp(), JSON.stringify({
      ...buildEntityCardData({ id: 'e2', name: 'Moth' }),
      vrmPick: { kind: 'library', id: 'elsewhere' },
      vrm: { name: 'Remote', file: { data: 'https://files.example/remote.vrm', type: 'model/vrm' }, hash: 'h' },
    }), { w: 4, h: 4 });
    const remote = new File([bytes], 'card.webp', { type: 'image/webp' });
    Object.defineProperty(remote, 'arrayBuffer', { value: async () => bytes.buffer });
    vi.stubGlobal('fetch', fetchSpy);

    const { entity } = await importCharacterFile(remote);

    expect(entity).not.toHaveProperty('vrmPick');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await libraryIds()).toEqual([]);
  });
});

describe('entity listing download', () => {
  it('adds the carried Avatar to the library before storing the entity', async () => {
    const file = await asset(vrmFile('Heron'));
    const content = { id: 'author-id', name: 'Wren', vrmPick: { kind: 'library', id: 'author-record' }, vrm: { name: 'Heron', file, hash: 'h' } };

    const installed = await saveDownloadToLibrary('entity', content as Entity, { sourceId: 'listing-1', name: 'Wren' });
    await saveDownloadToLibrary('entity', content as Entity, { sourceId: 'listing-2', name: 'Wren' });

    const ids = await libraryIds();
    expect(ids).toHaveLength(1);
    const stored = await EntityStorageService.getEntityData(installed.libraryId);
    expect(stored.vrmPick).toEqual({ kind: 'library', id: ids[0] });
    expect(stored).not.toHaveProperty('vrm');
  });
});

describe('publish size', () => {
  const sendNothing = () => vi.stubGlobal('fetch', vi.fn());

  it('counts the embedded Avatar against the entity limit and refuses before sending', async () => {
    // 20 MB of file is under the 25 MB limit on disk, and over it once embedded as base64.
    const big = new File([new Uint8Array(20 * 1024 * 1024)], 'Big.vrm', { type: 'model/vrm' });
    const record = await addModel(vrmFile('Big'));
    added.set(record.id, big);
    const payload = entityPublishPayload(await withCarriedVrm({ id: 'e1', name: 'Wren', vrmPick: { kind: 'library', id: record.id } }));
    sendNothing();

    await expect(WorldStorageService.publishItem(payload)).rejects.toThrow(/^Entity is 26\.7 MB, over the 25 MB publish limit\.$/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("counts the world's Avatar store against the world limit and refuses before sending", async () => {
    // Only the overview is measured, so the rest of the world is left out.
    const world = { worldOverview: { name: 'Fen', vrmStore: { w1: { name: 'Big', file: { data: 'A'.repeat(2048), type: 'model/vrm' } } } } } as unknown as World;
    // The world limit lowered for this case, so the store that exceeds it stays small; the store is what is measured.
    const limit = PUBLISH_LIMITS.world;
    PUBLISH_LIMITS.world = 2048;
    sendNothing();
    try {
      await expect(WorldStorageService.publishItem(worldPublishPayload(world))).rejects.toThrow(/^World is .+ over the .+ publish limit\.$/);
      PUBLISH_LIMITS.world = 4096;
      vi.mocked(fetch).mockRejectedValue(new Error('sent'));
      await expect(WorldStorageService.publishItem(worldPublishPayload({ ...world, worldOverview: { ...world.worldOverview, vrmStore: {} } })))
        .rejects.toThrow(/logged in/);
    } finally {
      PUBLISH_LIMITS.world = limit;
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
