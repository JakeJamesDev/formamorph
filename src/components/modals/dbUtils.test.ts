import { beforeEach, describe, it, expect, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { promisifyRequest, transactionDone } from '@/lib/idb';
import { refuseReads } from '@/test/idbRefusal';
import type { SaveRecord } from '@/types';

/**
 * The save DB opens a connection per operation unless `initDB` caches it. Autosave issues several
 * ops per turn, so a fresh connection each time leaks handles that block a future `DB_VERSION` bump.
 */
let db: typeof import('./dbUtils');
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  db = await import('./dbUtils');
});

/** Builds the v2 save DB with an out-of-line-key `saveRecords` store, the one way to store a row that reads
 *  back as null the way a value Chromium failed to load does. */
async function seedUnreadableRow(goodIds: string[], badId: string): Promise<void> {
  const raw = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(db.DB_NAME, db.DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(db.STORE_NAME);
      req.result.createObjectStore(db.ORDER_STORE, { keyPath: 'key' });
      req.result.createObjectStore(db.LEGACY_STORE, { keyPath: 'name' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = raw.transaction([db.STORE_NAME], 'readwrite');
  const saves = tx.objectStore(db.STORE_NAME);
  for (const id of goodIds) saves.put({ id, name: id, worldId: 'w1', isAutosave: true }, id);
  saves.put(null, badId);
  await new Promise((resolve) => { tx.oncomplete = resolve; });
  raw.close();
}

describe('getAllSaveRecords', () => {
  it('skips a row that reads back as null, so the autosave trim does not crash', async () => {
    await seedUnreadableRow(['a', 'c'], 'b');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { autosavesToTrim } = await import('@/lib/autosave');

    const records = await db.getAllSaveRecords();
    expect(records.map((r) => r.id)).toEqual(['a', 'c']);
    expect(() => autosavesToTrim(records, null, 'w1', 1)).not.toThrow();

    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(warn.mock.calls[0][0]).toContain('id b');
    const keyReads = vi.spyOn(IDBObjectStore.prototype, 'getAllKeys');
    await db.getAllSaveRecords();
    // The second read's warn pass has opened its key read; a later readwrite on the store waits for it.
    await vi.waitFor(() => expect(keyReads).toHaveBeenCalledTimes(1));
    await transactionDone((await db.initDB()).transaction([db.STORE_NAME], 'readwrite'));
    expect(warn).toHaveBeenCalledTimes(1); // once per key, not on every read
    keyReads.mockRestore();
    warn.mockRestore();
  });
});

describe('a save whose file is lost', () => {
  const save = (id: string) => ({ id, name: id, worldId: 'w1', version: '3', currentState: {} }) as unknown as SaveRecord;

  it('lists the other saves and warns once for the lost one', async () => {
    for (const id of ['a', 'b', 'c']) await db.putSaveRecord(save(id));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const restore = refuseReads({ [db.STORE_NAME]: ['b'] });

    expect((await db.getAllSaveRecords()).map((r) => r.id)).toEqual(['a', 'c']);

    restore();
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(warn.mock.calls[0][0]).toContain('id b');
    warn.mockRestore();
  });

  it('keeps every readable save on a later read', async () => {
    for (const id of ['a', 'b']) await db.putSaveRecord(save(id));
    const restore = refuseReads({ [db.STORE_NAME]: ['b'] });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await db.getAllSaveRecords();
    restore();

    expect((await db.getAllSaveRecords()).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('migrates the readable legacy saves and leaves the lost row in place', async () => {
    const conn = await db.initDB();
    const seed = conn.transaction([db.LEGACY_STORE], 'readwrite');
    for (const name of ['old-a', 'old-lost']) seed.objectStore(db.LEGACY_STORE).put({ name, worldName: 'Marsh' });
    await transactionDone(seed);
    const restore = refuseReads({ [db.LEGACY_STORE]: ['old-lost'] });

    await db.migrateLegacySaves(() => 'w1');

    restore();
    const left = await promisifyRequest(conn.transaction([db.LEGACY_STORE]).objectStore(db.LEGACY_STORE).getAllKeys());
    expect(left).toEqual(['old-lost']);
    expect((await db.getAllSaveRecords()).map((r) => [r.name, r.worldId])).toEqual([['old-a', 'w1']]);
  });
});

describe('initDB connection caching', () => {
  it('returns the same connection across calls instead of opening a new one each time', async () => {
    const [a, b] = await Promise.all([db.initDB(), db.initDB()]);
    expect(a).toBe(b);
    expect(await db.initDB()).toBe(a); // still cached after the initial opens settle
  });

  it('lets a later call retry after a failed open', async () => {
    const open = vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      const req = {} as IDBOpenDBRequest;
      queueMicrotask(() => req.onerror?.(new Event('error')));
      Object.defineProperty(req, 'error', { value: new Error('boom') });
      return req;
    });
    await expect(db.initDB()).rejects.toBeTruthy();
    open.mockRestore();
    await expect(db.initDB()).resolves.toBeTruthy(); // cache cleared → open retried
  });
});
