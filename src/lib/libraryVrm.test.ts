// @vitest-environment jsdom
// Must load before the services: their singleton constructors open IndexedDB.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModelStorageService from '@/services/ModelStorageService';
import { promisifyRequest } from '@/lib/idb';
import { blobHash } from '@/lib/blobHash';
import { blobToDataUrl } from '@/lib/imageSource';
import { makeVrm1 } from '@/test/glbFixture';
import { embedLibraryPicks, loadVrmLookup, toLibraryPick, withLibraryPick } from './libraryVrm';
import { pickToken } from './vrmPickMatch';
import type { Entity, MediaAsset, WorldVrm } from '@/types';

/**
 * Moving an Avatar pick between a world's store and the player's Avatar library, against the real library store.
 */

const vrmFile = (title: string) => new File([makeVrm1({ title })], `${title}.vrm`, { type: 'model/vrm' });

const asset = async (file: File): Promise<MediaAsset> =>
  ({ data: await blobToDataUrl(file), type: 'model/vrm', name: file.name, size: file.size });

/** The files added this test, by record id. fake-indexeddb's structured clone returns a stored Blob that jsdom's
 *  FileReader rejects; a browser returns the Blob itself, so a read gets the original bytes back. */
const added = new Map<string, File>();
const addModel = async (file: File) => {
  const record = await ModelStorageService.addModel(file);
  added.set(record.id, file);
  return record;
};

const libraryCount = async () => (await ModelStorageService.getModelMetadata()).length;

beforeEach(async () => {
  await ModelStorageService.initialize();
  const db = await new Promise<IDBDatabase>((resolve) => {
    const req = indexedDB.open('FORMAMORPH_MODELS_DB');
    req.onsuccess = () => resolve(req.result);
  });
  await promisifyRequest(db.transaction(['models'], 'readwrite').objectStore('models').clear());
  (ModelStorageService as unknown as { migration: Promise<void> | null }).migration = null;
  localStorage.clear();
  added.clear();
  const read = ModelStorageService.getModelData.bind(ModelStorageService);
  vi.spyOn(ModelStorageService, 'getModelData').mockImplementation(async (id) => {
    const data = await read(id);
    return added.has(id) ? { ...data, blob: added.get(id)! } : data;
  });
});

afterEach(() => vi.restoreAllMocks());

describe('toLibraryPick', () => {
  it('names the library record that holds the same file, without importing it again', async () => {
    const file = vrmFile('Heron');
    const record = await addModel(file);
    const store: Record<string, WorldVrm> = { w1: { name: 'Heron', file: await asset(file) } };

    expect(await toLibraryPick({ kind: 'world', id: 'w1' }, store)).toEqual({ kind: 'library', id: record.id });
    expect(await libraryCount()).toBe(1);
  });

  it('imports a world Avatar the library lacks, once', async () => {
    const store: Record<string, WorldVrm> = { w1: { name: 'Crane', file: await asset(vrmFile('Crane')) } };

    const first = await toLibraryPick({ kind: 'world', id: 'w1' }, store);
    const second = await toLibraryPick({ kind: 'world', id: 'w1' }, store);

    expect(first?.kind).toBe('library');
    expect(second).toEqual(first);
    expect(await libraryCount()).toBe(1);
  });

  it("keeps None and User's Default, and drops a store id the store lacks", async () => {
    expect(await toLibraryPick(undefined, {})).toBeUndefined();
    expect(await toLibraryPick({ kind: 'default' }, {})).toEqual({ kind: 'default' });
    expect(await toLibraryPick({ kind: 'world', id: 'gone' }, {})).toBeUndefined();
  });

  it('rewrites only the pick of an item it is given', async () => {
    const store: Record<string, WorldVrm> = { w1: { name: 'Crane', file: await asset(vrmFile('Crane')) } };
    const entity = { id: 'e1', name: 'Wren', vrmPick: { kind: 'world', id: 'w1' } } as Entity;
    const next = await withLibraryPick(entity, store);
    expect(next).toMatchObject({ id: 'e1', name: 'Wren' });
    expect(next.vrmPick?.kind).toBe('library');
  });
});

describe('embedLibraryPicks', () => {
  it('embeds the library file, so the world entry matches its library record by hash', async () => {
    const file = vrmFile('Heron');
    const record = await addModel(file);
    const entity = { id: 'e1', name: 'Wren', vrmPick: { kind: 'library', id: record.id } } as Entity;

    const placed = await embedLibraryPicks([entity], undefined);
    const [id, entry] = Object.entries(placed.store ?? {})[0];

    expect(placed.entities[0].vrmPick).toEqual({ kind: 'world', id });
    expect(entry.name).toBe('Heron');
    expect(entry.hash).toBe(await blobHash(file));
    const lookup = await loadVrmLookup(placed.store);
    expect(pickToken({ kind: 'world', id }, lookup)).toBe(pickToken({ kind: 'library', id: record.id }, lookup));
  });

  it('reuses a store entry that carries no hash when its file is the same', async () => {
    const file = vrmFile('Heron');
    const record = await addModel(file);
    const store: Record<string, WorldVrm> = { 'legacy-player-avatar': { name: 'Player', file: await asset(file) } };
    const entity = { id: 'e1', name: 'Wren', vrmPick: { kind: 'library', id: record.id } } as Entity;

    const placed = await embedLibraryPicks([entity], store);

    expect(placed.store).toBe(store);
    expect(placed.entities[0].vrmPick).toEqual({ kind: 'world', id: 'legacy-player-avatar' });
  });
});

describe('ModelStorageService.getModelHashes', () => {
  it('lists each record by name and hash', async () => {
    const file = vrmFile('Heron');
    const record = await addModel(file);
    expect((await ModelStorageService.getModelHashes()).get(record.id)).toEqual({ name: 'Heron', hash: await blobHash(file) });
  });
});
