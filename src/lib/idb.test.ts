import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { cachedConnection, pruneLeastRecent, promisifyRequest, transactionDone } from './idb';

const STORES = [{ name: 'rows', keyPath: 'id' }];

describe('cachedConnection', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens once and hands every caller the same connection', async () => {
    const open = vi.spyOn(indexedDB, 'open');
    const connect = cachedConnection('conn-db', 1, STORES);
    const [a, b] = await Promise.all([connect(), connect()]);
    expect(a).toBe(b);
    expect(await connect()).toBe(a);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('retries the open on the next call after a failed open', async () => {
    const real = indexedDB.open.bind(indexedDB);
    const open = vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      const request = {} as IDBOpenDBRequest;
      queueMicrotask(() => {
        Object.defineProperty(request, 'error', { value: new DOMException('blocked', 'AbortError') });
        request.onerror?.(new Event('error'));
      });
      return request;
    });
    open.mockImplementation(real);

    const connect = cachedConnection('retry-db', 1, STORES);
    await expect(connect()).rejects.toThrow('blocked');
    const db = await connect();
    expect(db.name).toBe('retry-db');
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('keeps separate connections for separate helpers', async () => {
    const a = await cachedConnection('db-a', 1, STORES)();
    const b = await cachedConnection('db-b', 1, STORES)();
    expect(a).not.toBe(b);
  });
});

describe('pruneLeastRecent', () => {
  interface Row { id: string; usedAt: number }

  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const seed = async (count: number) => {
    const db = await cachedConnection('prune-db', 1, STORES)();
    const tx = db.transaction(['rows'], 'readwrite');
    for (let i = 0; i < count; i += 1) tx.objectStore('rows').put({ id: `r${i}`, usedAt: i } satisfies Row);
    await transactionDone(tx);
    return db;
  };

  const prune = async (db: IDBDatabase, max: number) => {
    const tx = db.transaction(['rows'], 'readwrite');
    pruneLeastRecent<Row>(tx.objectStore('rows'), max, (r) => r.usedAt, (r) => r.id);
    await transactionDone(tx);
  };

  const ids = async (db: IDBDatabase) =>
    (await promisifyRequest<Row[]>(db.transaction(['rows']).objectStore('rows').getAll())).map((r) => r.id).sort();

  it('keeps every entry at the cap', async () => {
    const db = await seed(5);
    await prune(db, 5);
    expect(await ids(db)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4']);
  });

  it('drops the least recent entries over the cap', async () => {
    const db = await seed(6);
    await prune(db, 4);
    expect(await ids(db)).toEqual(['r2', 'r3', 'r4', 'r5']);
  });

  it('does not read the records while at or under the cap', async () => {
    const db = await seed(3);
    const tx = db.transaction(['rows'], 'readwrite');
    const store = tx.objectStore('rows');
    const getAll = vi.spyOn(store, 'getAll');
    pruneLeastRecent<Row>(store, 3, (r) => r.usedAt, (r) => r.id);
    await transactionDone(tx);
    expect(getAll).not.toHaveBeenCalled();
  });
});
