// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { IDBFactory, forceCloseDatabase } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-toastify', () => ({ toast: { info: vi.fn(), error: vi.fn(), dismiss: vi.fn() } }));

import { toast } from 'react-toastify';
import WorldStorageService, { LIBRARY_BLOCKED_MESSAGE, type StoredWorldRecord } from '@/services/WorldStorageService';
import { getUnreadableWorlds, resetUnreadableWorlds } from '@/lib/unreadableWorlds';
import { clearDeletedDefaultWorlds, readDeletedDefaultWorlds } from '@/lib/defaultWorlds';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { promisifyRequest } from '@/lib/idb';
import {
  WORLD_LIBRARY_DB, WORLD_META_STORE, WORLD_STORE, openWorldLibrary, putWorldRecord, putWorldRecords, worldMetaOf, type WorldMetaRecord,
} from './worldLibrary';
import { bundledWorlds } from '@/lib/bundledWorldText';
import { refuseReads } from '@/test/idbRefusal';

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
  resetUnreadableWorlds();
  vi.mocked(toast.info).mockClear();
  vi.mocked(toast.dismiss).mockClear();
  vi.mocked(toast.error).mockClear();
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

  it('skips a world that reads back as null, rather than abort the upgrade', async () => {
    // Out-of-line keys stand in for a stored value the browser can no longer read.
    const v1 = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(WORLD_LIBRARY_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(WORLD_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = v1.transaction([WORLD_STORE], 'readwrite');
    tx.objectStore(WORLD_STORE).put(null, 'lost');
    tx.objectStore(WORLD_STORE).put(world('y'), 'y');
    await new Promise((resolve) => { tx.oncomplete = resolve; });
    v1.close();

    const meta = await WorldStorageService.getWorldMetadata();

    expect(meta.map((m) => m.id)).toEqual(['y']);
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

  it('reconnects after the browser closes the library connection', async () => {
    await WorldStorageService.storeWorld(world('a'));
    // fake-indexeddb types the argument as the class; the function takes a connection.
    forceCloseDatabase(WorldStorageService.db as unknown as Parameters<typeof forceCloseDatabase>[0]);

    await WorldStorageService.storeWorld(world('b'));

    expect((await WorldStorageService.getWorldMetadata()).map((m) => m.id).sort()).toEqual(['a', 'b']);
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
    const { failed } = await WorldStorageService.loadDefaultWorlds([{ id: 'rampage', defaultName: 'Rampage' }], bundledWorlds);

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

describe('a library with unreadable rows', () => {
  /** Store `worlds` through the real write path, then drop the metadata rows of `noMeta`. */
  async function seedLibrary(worlds: StoredWorldRecord[], noMeta: string[] = []): Promise<void> {
    const db = await openWorldLibrary();
    try {
      await putWorldRecords(db, worlds);
      const tx = db.transaction([WORLD_META_STORE], 'readwrite');
      for (const id of noMeta) tx.objectStore(WORLD_META_STORE).delete(id);
      await new Promise((resolve) => { tx.oncomplete = resolve; });
    } finally {
      db.close();
    }
  }

  /** Have the browser read `ids` in `store` back as null, the way it reports a value it can't read. */
  function unreadable(store: string, ids: string[]): () => void {
    const lost = new Set(ids);
    const blank = (request: IDBRequest, map: (value: unknown) => unknown) => {
      let value: unknown;
      Object.defineProperty(request, 'result', { get: () => map(value), set: (next) => { value = next; } });
      return request;
    };
    // Spying on a spied method returns the same spy, so a second store calls the first store's behavior.
    const unspied = <T extends (...args: never[]) => unknown>(method: T) => (vi.isMockFunction(method) ? method.getMockImplementation() as T : method);
    const get = unspied(IDBObjectStore.prototype.get);
    const getAll = unspied(IDBObjectStore.prototype.getAll);
    const spies = [
      vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (this: IDBObjectStore, key) {
        const request = get.call(this, key);
        return this.name === store && lost.has(String(key)) ? blank(request, () => null) : request;
      }),
      vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(function (this: IDBObjectStore, ...args) {
        const request = getAll.apply(this, args);
        if (this.name !== store) return request;
        return blank(request, (rows) => (rows as { id: string }[] | undefined)
          ?.map((row) => (lost.has(row.id) ? null : row)));
      }),
    ];
    return () => spies.forEach((spy) => spy.mockRestore());
  }

  it('lists every world and rebuilds the unreadable metadata row from its world', async () => {
    await seedLibrary([world('a'), world('b')]);
    const restore = unreadable(WORLD_META_STORE, ['a']);

    const meta = await WorldStorageService.getWorldMetadata();

    restore();
    expect(meta.map((m) => m.id)).toEqual(['a', 'b']);
    await expectMetaInSync();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('rebuilds a metadata row that is missing', async () => {
    await seedLibrary([world('a'), world('b')], ['a']);

    expect((await WorldStorageService.getWorldMetadata()).map((m) => m.id)).toEqual(['a', 'b']);
    await expectMetaInSync();
  });

  it('hides a world that can not be read at all and tells the player, but lists the rest', async () => {
    await seedLibrary([world('lost'), world('b')]);
    unreadable(WORLD_META_STORE, ['lost']);
    unreadable(WORLD_STORE, ['lost']);

    expect((await WorldStorageService.getWorldMetadata()).map((m) => m.id)).toEqual(['b']);
    expect(await WorldStorageService.worldsLinking('lib-1')).toEqual([]);
    expect(getUnreadableWorlds().map((w) => w.id)).toEqual(['lost']);
  });

  it('lists the other worlds and rebuilds the row when one metadata file is lost', async () => {
    await seedLibrary([world('a'), world('b')]);
    refuseReads({ [WORLD_META_STORE]: ['a'] });

    const meta = await WorldStorageService.getWorldMetadata();

    expect(meta.map((m) => m.id)).toEqual(['a', 'b']);
    expect(getUnreadableWorlds()).toEqual([]);
  });

  it('reports a world whose metadata and record files are both lost', async () => {
    await seedLibrary([world('lost'), world('b')]);
    refuseReads({ [WORLD_META_STORE]: ['lost'], [WORLD_STORE]: ['lost'] });

    expect((await WorldStorageService.getWorldMetadata()).map((m) => m.id)).toEqual(['b']);
    expect(getUnreadableWorlds().map((w) => w.id)).toEqual(['lost']);
  });

  it('rebuilds a healthy world that follows a lost one in the same read', async () => {
    await seedLibrary([world('a-lost'), world('b-good')], ['a-lost', 'b-good']);
    refuseReads({ [WORLD_STORE]: ['a-lost'] });

    expect((await WorldStorageService.getWorldMetadata()).map((m) => m.id)).toEqual(['b-good']);
    expect(getUnreadableWorlds().map((w) => w.id)).toEqual(['a-lost']);
  });

  /** Run `before` once, just ahead of the first read-write transaction over the metadata store. */
  function beforeFirstMetaWrite(before: (db: IDBDatabase, open: IDBDatabase['transaction']) => void): void {
    const open = IDBDatabase.prototype.transaction;
    let fired = false;
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, names, mode, options) {
      const stores = typeof names === 'string' ? [names] : [...names];
      if (!fired && mode === 'readwrite' && stores.includes(WORLD_META_STORE)) {
        fired = true;
        before(this, open);
      }
      return open.call(this, names, mode, options);
    });
  }

  it('keeps a save that lands while missing metadata is rebuilt', async () => {
    await seedLibrary([world('a')], ['a']);
    const edited = world('a', { name: 'Edited', dirty: true });
    // Another save, queued just before the rebuild's write.
    beforeFirstMetaWrite((db, open) => { putWorldRecord(open.call(db, [WORLD_STORE, WORLD_META_STORE], 'readwrite'), edited); });

    const meta = await WorldStorageService.getWorldMetadata();

    vi.restoreAllMocks();
    expect(meta.find((m) => m.id === 'a')).toMatchObject({ name: 'Edited', dirty: true });
    await expectMetaInSync();
  });

  it('keeps a world that a restore makes readable just before Remove deletes it', async () => {
    await seedLibrary([world('lost')]);
    let restored = false;
    const get = IDBObjectStore.prototype.get;
    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (this: IDBObjectStore, key) {
      const request = get.call(this, key);
      if (this.name !== WORLD_STORE || key !== 'lost' || restored) return request;
      let value: unknown;
      Object.defineProperty(request, 'result', { get: () => (value === undefined ? undefined : null), set: (next) => { value = next; } });
      return request;
    });
    beforeFirstMetaWrite(() => { restored = true; });

    const removed = await WorldStorageService.removeUnreadableWorld('lost');

    vi.restoreAllMocks();
    expect(removed).toBe(false);
    expect((await readStore<StoredWorldRecord>(WORLD_STORE)).map((w) => w.id)).toEqual(['lost']);
  });

  it('still reports a world that fails to open while the connection closes', async () => {
    await seedLibrary([world('open', { name: 'Marsh' })]);
    unreadable(WORLD_STORE, ['open']);
    const open = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, names, mode, options) {
      if (names === WORLD_META_STORE || (Array.isArray(names) && names.length === 1 && names[0] === WORLD_META_STORE)) {
        throw new DOMException('The connection is closing', 'InvalidStateError');
      }
      return open.call(this, names, mode, options);
    });

    await expect(WorldStorageService.getWorldData('open')).rejects.toBe('World not found');

    await vi.waitFor(() => expect(getUnreadableWorlds()).toEqual([{ id: 'open', foundOnOpen: true }]));
  });

  it('stops reporting a world once a later list read finds it healed', async () => {
    await seedLibrary([world('lost'), world('b')]);
    const restoreMeta = unreadable(WORLD_META_STORE, ['lost']);
    const restoreWorld = unreadable(WORLD_STORE, ['lost']);
    await WorldStorageService.getWorldMetadata();
    restoreWorld();
    restoreMeta();

    await WorldStorageService.getWorldMetadata();

    expect(getUnreadableWorlds()).toEqual([]);
  });

  it('removes an unreadable entry from both stores and leaves the rest', async () => {
    await seedLibrary([world('lost'), world('b')]);
    const restoreMeta = unreadable(WORLD_META_STORE, ['lost']);
    const restoreWorld = unreadable(WORLD_STORE, ['lost']);
    await WorldStorageService.getWorldMetadata();

    expect(await WorldStorageService.removeUnreadableWorld('lost')).toBe(true);

    restoreWorld();
    restoreMeta();
    expect((await readStore<StoredWorldRecord>(WORLD_STORE)).map((w) => w.id)).toEqual(['b']);
    await expectMetaInSync();
    expect(getUnreadableWorlds()).toEqual([]);
  });

  it('removes an entry whose files are lost, and a later list read is clean', async () => {
    await seedLibrary([world('lost'), world('b')]);
    refuseReads({ [WORLD_META_STORE]: ['lost'], [WORLD_STORE]: ['lost'] });

    expect(await WorldStorageService.removeUnreadableWorld('lost')).toBe(true);

    vi.restoreAllMocks();
    expect((await readStore<StoredWorldRecord>(WORLD_STORE)).map((w) => w.id)).toEqual(['b']);
    await expectMetaInSync();
  });

  it('keeps a world that reads again when the player asks to remove it', async () => {
    await seedLibrary([world('healed')]);

    expect(await WorldStorageService.removeUnreadableWorld('healed')).toBe(false);

    expect((await readStore<StoredWorldRecord>(WORLD_STORE)).map((w) => w.id)).toEqual(['healed']);
    await expectMetaInSync();
  });

  it('leaves no tombstone, so the seeder restores a removed bundled world', async () => {
    await seedLibrary([world('rampage', { name: 'BROKEN' })]);
    const restoreMeta = unreadable(WORLD_META_STORE, ['rampage']);
    const restoreWorld = unreadable(WORLD_STORE, ['rampage']);
    await WorldStorageService.removeUnreadableWorld('rampage');
    restoreWorld();
    restoreMeta();

    await WorldStorageService.loadDefaultWorlds([{ id: 'rampage', defaultName: 'Rampage' }], bundledWorlds);

    expect(readDeletedDefaultWorlds().has('rampage')).toBe(false);
    const [stored] = await readStore<StoredWorldRecord>(WORLD_STORE);
    expect(stored.id).toBe('rampage');
    expect(stored.name).not.toBe('BROKEN');
  });

  it('reports a world that fails to open, with what its metadata still says', async () => {
    await seedLibrary([world('open', { name: 'Marsh', sourceId: 'listing-1' })]);
    unreadable(WORLD_STORE, ['open']);

    await expect(WorldStorageService.getWorldData('open')).rejects.toBe('World not found');

    await vi.waitFor(() => expect(getUnreadableWorlds()).toEqual([
      { id: 'open', name: 'Marsh', sourceId: 'listing-1', foundOnOpen: true },
    ]));
  });

  it('does not report a world that is simply absent', async () => {
    await seedLibrary([world('b')]);

    await expect(WorldStorageService.getWorldData('gone')).rejects.toBe('World not found');

    await new Promise((resolve) => { setTimeout(resolve); });
    expect(getUnreadableWorlds()).toEqual([]);
  });

  it('clears a world that fails to open once it is stored again', async () => {
    await seedLibrary([world('open', { name: 'Marsh' })]);
    const restore = unreadable(WORLD_STORE, ['open']);
    await expect(WorldStorageService.getWorldData('open')).rejects.toBe('World not found');
    await vi.waitFor(() => expect(getUnreadableWorlds()).toHaveLength(1));
    restore();

    await WorldStorageService.storeWorld(world('open', { name: 'Marsh' }));

    expect(getUnreadableWorlds()).toEqual([]);
  });

  it.each(['unreadable', 'missing'])('does not reseed a default whose metadata is %s, so its edits survive', async (state) => {
    const edited = world('rampage', { name: 'MY EDIT', dirty: true });
    await seedLibrary([edited], state === 'missing' ? ['rampage'] : []);
    const restore = state === 'unreadable' ? unreadable(WORLD_META_STORE, ['rampage']) : () => {};

    await WorldStorageService.loadDefaultWorlds([{ id: 'rampage', defaultName: 'Rampage' }], bundledWorlds);

    restore();
    expect(await readStore<StoredWorldRecord>(WORLD_STORE)).toEqual([edited]);
  });
});
