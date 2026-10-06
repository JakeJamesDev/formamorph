// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-toastify', () => ({ toast: { info: vi.fn(), dismiss: vi.fn() } }));

import { toast } from 'react-toastify';
import WorldStorageService, { LIBRARY_BLOCKED_MESSAGE, type StoredWorldRecord } from '@/services/WorldStorageService';
import { clearDeletedDefaultWorlds } from '@/lib/defaultWorlds';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { promisifyRequest } from '@/lib/idb';
import {
  WORLD_LIBRARY_DB, WORLD_META_STORE, WORLD_STORE, openWorldLibrary, worldMetaOf, type WorldMetaRecord,
} from './worldLibrary';

/** Open the library database the way a version 1 build did. */
function openVersion1(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WORLD_LIBRARY_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(WORLD_STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStore<T>(store: string): Promise<T[]> {
  const db = await openWorldLibrary();
  try {
    return await promisifyRequest<T[]>(db.transaction([store], 'readonly').objectStore(store).getAll());
  } finally {
    db.close();
  }
}

/** Assert every stored world has exactly its derived metadata, and no metadata outlives its world. */
async function expectMetaInSync(): Promise<void> {
  const worlds = await readStore<StoredWorldRecord>(WORLD_STORE);
  const meta = await readStore<WorldMetaRecord>(WORLD_META_STORE);
  expect(meta).toEqual(worlds.map(worldMetaOf));
}

const world = (id: string, overrides: Partial<StoredWorldRecord> = {}): StoredWorldRecord => ({
  id,
  name: `World ${id}`,
  description: 'A marsh.',
  author: 'Ann',
  thumbnail: '',
  data: {
    worldOverview: { name: `World ${id}`, tags: ['marsh'] },
    stats: [], locations: [], entities: [], traits: [], statUpdates: [],
  },
  ...overrides,
});

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  WorldStorageService.db = null;
  localStorage.clear();
  clearDeletedDefaultWorlds();
  vi.mocked(toast.info).mockClear();
  vi.mocked(toast.dismiss).mockClear();
});

afterEach(() => {
  WorldStorageService.db?.close();
  WorldStorageService.db = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the version 2 upgrade', () => {
  it('fills one metadata record per world from a version 1 library', async () => {
    const token = encodePlaceholderToken({ id: 'fen', mode: 'world', placementId: 'p1' });
    const records = [
      world('a'),
      world('b', { sourceId: 'srv-b', dirty: true, thumbnail: 'https://example.com/x.png' }),
      {
        ...world('c', { description: `Adrift in the ${token}.` }),
        data: {
          ...world('c').data,
          placeholders: [{ id: 'fen', name: 'fen', values: ['Sedge Fen'] }],
          entities: [{ id: 'e1', name: 'Mara', link: { libraryId: 'lib-1' } }],
        },
      },
    ];
    const v1 = await openVersion1();
    const tx = v1.transaction([WORLD_STORE], 'readwrite');
    for (const record of records) tx.objectStore(WORLD_STORE).put(record);
    await new Promise((resolve) => { tx.oncomplete = resolve; });
    v1.close();

    const meta = await WorldStorageService.getWorldMetadata();

    expect(meta.map((m) => m.id).sort()).toEqual(['a', 'b', 'c']);
    await expectMetaInSync();
    expect(meta.find((m) => m.id === 'c')?.description).toBe('Adrift in the Sedge Fen.');
    expect(await WorldStorageService.linkedCopies('lib-1')).toEqual([
      { worldId: 'c', worldName: 'World c', itemId: 'e1', itemName: 'Mara', kind: 'entity', link: { libraryId: 'lib-1' } },
    ]);
  });

  it('keeps the raw blurb of a world whose placeholder defs are malformed, rather than abort the upgrade', async () => {
    const token = encodePlaceholderToken({ id: 'fen', mode: 'world', placementId: 'p1' });
    const broken = { ...world('x', { description: `Adrift in the ${token}.` }), data: { ...world('x').data, placeholders: [null] } };
    const v1 = await openVersion1();
    const tx = v1.transaction([WORLD_STORE], 'readwrite');
    tx.objectStore(WORLD_STORE).put(broken);
    tx.objectStore(WORLD_STORE).put(world('y'));
    await new Promise((resolve) => { tx.oncomplete = resolve; });
    v1.close();

    const meta = await WorldStorageService.getWorldMetadata();

    expect(meta.map((m) => m.id)).toEqual(['x', 'y']);
    expect(meta[0].description).toBe(`Adrift in the ${token}.`);
  });

  it('shows a message while a version 1 tab blocks it, and finishes once that tab closes', async () => {
    const v1 = await openVersion1();
    const reading = WorldStorageService.getWorldMetadata();
    try {
      await vi.waitFor(() => expect(toast.info).toHaveBeenCalledWith(LIBRARY_BLOCKED_MESSAGE, expect.anything()));
      expect(toast.dismiss).not.toHaveBeenCalled();
    } finally {
      v1.close();
      // Settle the open, so a failure here leaves no connection for the next test.
      await reading.catch(() => {});
    }

    await expect(reading).resolves.toEqual([]);
    expect(toast.dismiss).toHaveBeenCalled();
  });

  it('closes its own connection when a newer version asks for the library', async () => {
    await WorldStorageService.storeWorld(world('a'));
    const blocked = vi.fn();

    const newer = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(WORLD_LIBRARY_DB, 3);
      request.onblocked = blocked;
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    expect(blocked).not.toHaveBeenCalled();
    expect(WorldStorageService.db).toBeNull();
    newer.close();
  });
});

describe('every write keeps metadata in step', () => {
  it('store', async () => {
    await WorldStorageService.storeWorld(world('a'));
    await WorldStorageService.storeWorld(world('a', { name: 'Renamed', dirty: true }));
    await WorldStorageService.storeWorld(world('b', { sourceId: 'srv-b' }));

    await expectMetaInSync();
    expect((await WorldStorageService.getWorldMetadata()).find((m) => m.id === 'a')?.name).toBe('Renamed');
  });

  it('keeps sticky fields read from metadata across a save that omits them', async () => {
    await WorldStorageService.storeWorld(world('a', { sourceId: 'srv-a', sourceHash: 'h1', downloadedAt: 'd1' }));
    const createdAt = (await readStore<WorldMetaRecord>(WORLD_META_STORE))[0].createdAt;

    await WorldStorageService.storeWorld(world('a', { dirty: true }));

    const [record] = await readStore<StoredWorldRecord & { createdAt?: string }>(WORLD_STORE);
    expect(record).toMatchObject({ sourceId: 'srv-a', sourceHash: 'h1', downloadedAt: 'd1', dirty: true, createdAt });
    await expectMetaInSync();
  });

  it('content update', async () => {
    await WorldStorageService.storeWorld(world('a'));

    await WorldStorageService.updateWorldContent('a', (data) => ({
      ...data,
      worldOverview: { name: 'World a', tags: ['fen'] },
      dictionaries: [{ id: 'd1', name: 'Lore', link: { libraryId: 'lib-2' } }],
    }));

    await expectMetaInSync();
    expect((await WorldStorageService.getWorldMetadata())[0].tags).toEqual(['fen']);
    expect(await WorldStorageService.worldsLinking('lib-2')).toEqual([{ id: 'a', name: 'World a' }]);
  });

  it('listing link', async () => {
    await WorldStorageService.storeWorld(world('a'));

    await WorldStorageService.linkWorldToListing('a', 'srv-a', '2026-01-02');

    await expectMetaInSync();
    expect(await WorldStorageService.getWorldListingLink('a')).toEqual({ sourceId: 'srv-a', downloadedAt: undefined });
  });

  it('delete', async () => {
    await WorldStorageService.storeWorld(world('a'));
    await WorldStorageService.storeWorld(world('b'));

    await WorldStorageService.deleteWorld('a');

    await expectMetaInSync();
    expect((await WorldStorageService.getWorldMetadata()).map((m) => m.id)).toEqual(['b']);
  });

  it('default seeding', async () => {
    const { failed } = await WorldStorageService.loadDefaultWorlds([{ id: 'rampage', defaultName: 'Rampage' }]);

    expect(failed).toEqual([]);
    await expectMetaInSync();
    expect((await readStore<WorldMetaRecord>(WORLD_META_STORE))[0].sourceHash).toEqual(expect.any(String));
  });
});

describe('the list reads', () => {
  it('never read world data as a whole store', async () => {
    await WorldStorageService.storeWorld(world('a', {
      data: { ...world('a').data, entities: [{ id: 'e1', name: 'Mara', link: { libraryId: 'lib-1' } }] },
    }));
    const wholeReads: string[] = [];
    const getAll = IDBObjectStore.prototype.getAll;
    const openCursor = IDBObjectStore.prototype.openCursor;
    vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(function (this: IDBObjectStore, ...args) {
      wholeReads.push(this.name);
      return getAll.apply(this, args);
    });
    vi.spyOn(IDBObjectStore.prototype, 'openCursor').mockImplementation(function (this: IDBObjectStore, ...args) {
      wholeReads.push(this.name);
      return openCursor.apply(this, args);
    });

    await WorldStorageService.getWorldMetadata();
    await WorldStorageService.worldsLinking('lib-1');
    await WorldStorageService.linkedCopies('lib-1');
    await WorldStorageService.getWorldListingLink('a');

    expect(wholeReads.length).toBeGreaterThan(0);
    expect(wholeReads).not.toContain(WORLD_STORE);
  });
});
