// Must load before constructing a store: the constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { LibraryStore, type StoredRecord } from './LibraryStore';

interface Payload {
  entries?: string[];
  label?: string;
}

interface Meta {
  id: string;
  name: string;
  count: number;
}

/** A store on its own database, so each test's records can't collide with another's. */
let dbSeq = 0;
const makeStore = (isValid?: (data: Payload) => boolean) =>
  new LibraryStore<Payload, Meta>({
    dbName: `testDB-${++dbSeq}`,
    storeName: 'things',
    noun: 'Widget',
    isValid,
    toMetadata: (record) => ({ id: record.id, name: record.name, count: record.data?.entries?.length ?? 0 }),
  });

const record = (over: Partial<StoredRecord<Payload>> = {}): StoredRecord<Payload> => ({
  id: 'a1',
  name: 'Alpha',
  data: { entries: ['x'] },
  ...over,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('store + getData', () => {
  it('round-trips a record and returns its payload', async () => {
    const store = makeStore();
    await store.store(record());
    await expect(store.getData('a1')).resolves.toEqual({ entries: ['x'] });
  });

  it('rejects a missing id with the noun-specific message', async () => {
    const store = makeStore();
    await expect(store.getData('')).rejects.toBe('Widget ID is required');
  });

  it('rejects an unknown id as not found', async () => {
    const store = makeStore();
    await expect(store.getData('nope')).rejects.toBe('Widget not found');
  });

  it('throws when name is absent', async () => {
    const store = makeStore();
    await expect(store.store(record({ name: '' }))).rejects.toThrow('Invalid widget: missing required fields');
  });

  it('throws when data is absent', async () => {
    const store = makeStore();
    await expect(
      store.store(record({ data: undefined as unknown as Payload })),
    ).rejects.toThrow('Invalid widget: missing required fields');
  });
});

describe('isValid', () => {
  it('rejects a structurally invalid payload on store', async () => {
    const store = makeStore((d) => Array.isArray(d.entries));
    await expect(store.store(record({ data: { label: 'no entries' } })))
      .rejects.toThrow('Invalid widget: missing required fields');
  });

  it('treats a stored-but-invalid payload as not found on read', async () => {
    // Validation tightening after the fact must not surface a malformed record.
    const lenient = makeStore();
    await lenient.store(record({ data: { label: 'no entries' } }));
    const strict = new LibraryStore<Payload, Meta>({
      dbName: lenient.dbName,
      storeName: lenient.storeName,
      noun: 'Widget',
      isValid: (d) => Array.isArray(d.entries),
      toMetadata: (r) => ({ id: r.id, name: r.name, count: 0 }),
    });
    await expect(strict.getData('a1')).rejects.toBe('Widget not found');
  });

  it('defaults to accepting any present payload', async () => {
    const store = makeStore();
    await store.store(record({ data: { label: 'fine' } }));
    await expect(store.getData('a1')).resolves.toEqual({ label: 'fine' });
  });
});

describe('timestamps', () => {
  it('keeps createdAt sticky across re-stores but bumps lastAccessed', async () => {
    // Fake only Date: fake-indexeddb drives its requests off real timers and would deadlock otherwise.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const store = makeStore();
    await store.store(record());

    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'));
    await store.store(record({ name: 'Alpha renamed' }));

    const all = await store.getMetadata();
    expect(all).toHaveLength(1);
    // Read the raw record to assert the stamps the metadata projection drops.
    const raw = await new Promise<StoredRecord<Payload>>((resolve) => {
      const req = store.db!.transaction(['things'], 'readonly').objectStore('things').get('a1');
      req.onsuccess = () => resolve(req.result);
    });
    expect(raw.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(raw.lastAccessed).toBe('2026-06-01T00:00:00.000Z');
    expect(raw.name).toBe('Alpha renamed');
  });

  it('honors a caller-supplied createdAt on first store only', async () => {
    const store = makeStore();
    await store.store(record({ createdAt: '2020-05-05T00:00:00.000Z' }));
    await store.store(record({ createdAt: '2099-01-01T00:00:00.000Z' }));
    const raw = await new Promise<StoredRecord<Payload>>((resolve) => {
      const req = store.db!.transaction(['things'], 'readonly').objectStore('things').get('a1');
      req.onsuccess = () => resolve(req.result);
    });
    expect(raw.createdAt).toBe('2020-05-05T00:00:00.000Z');
  });
});

describe('getMetadata', () => {
  it('projects every record through toMetadata', async () => {
    const store = makeStore();
    await store.store(record({ id: 'a1', name: 'Alpha', data: { entries: ['x', 'y'] } }));
    await store.store(record({ id: 'b2', name: 'Beta', data: { entries: [] } }));
    const meta = await store.getMetadata();
    expect(meta).toEqual(
      expect.arrayContaining([
        { id: 'a1', name: 'Alpha', count: 2 },
        { id: 'b2', name: 'Beta', count: 0 },
      ]),
    );
  });

  it('returns an empty list for an empty store', async () => {
    await expect(makeStore().getMetadata()).resolves.toEqual([]);
  });
});

describe('delete', () => {
  it('removes a record', async () => {
    const store = makeStore();
    await store.store(record());
    await store.delete('a1');
    await expect(store.getData('a1')).rejects.toBe('Widget not found');
  });

  it('requires an id', async () => {
    await expect(makeStore().delete('')).rejects.toThrow('Widget ID is required');
  });
});
