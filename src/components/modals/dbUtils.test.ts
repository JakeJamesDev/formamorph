import { beforeEach, describe, it, expect, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

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
