// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import ModelStorageService, { type StoredModelRecord } from './ModelStorageService';
import { promisifyRequest } from '@/lib/idb';

const DB = 'FORMAMORPH_MODELS_DB';
const STORE = 'models';

const blob = (text = 'vrm-bytes') => new Blob([text], { type: 'model/vrm' });

/** Reach past the service to the raw store, so legacy shapes can be planted and results inspected. */
const rawStore = async (mode: IDBTransactionMode): Promise<IDBObjectStore> => {
  await ModelStorageService.initialize();
  const db = await new Promise<IDBDatabase>((resolve) => {
    const req = indexedDB.open(DB);
    req.onsuccess = () => resolve(req.result);
  });
  return db.transaction([STORE], mode).objectStore(STORE);
};

const putRaw = async (record: unknown) => promisifyRequest((await rawStore('readwrite')).put(record));
const getRaw = async (id: string) => promisifyRequest<Record<string, unknown>>((await rawStore('readonly')).get(id));

beforeEach(async () => {
  const store = await rawStore('readwrite');
  await promisifyRequest(store.clear());
  // The migration memoizes per instance; reset it so each test's planted records are actually scanned.
  (ModelStorageService as unknown as { migration: Promise<void> | null }).migration = null;
});

describe('addModel', () => {
  it('wraps an uploaded file into a library record and strips the extension from the name', async () => {
    const file = new File([blob()], 'Robot Girl.vrm', { type: 'model/vrm' });
    const record = await ModelStorageService.addModel(file);

    expect(record.name).toBe('Robot Girl');
    expect(record.data.type).toBe('model/vrm');
    expect(record.data.size).toBe(file.size);

    await expect(ModelStorageService.getModelData(record.id)).resolves.toMatchObject({ type: 'model/vrm' });
  });

  it('defaults the type when the browser reports none', async () => {
    const record = await ModelStorageService.addModel(new File([blob()], 'x.vrm', { type: '' }));
    expect(record.data.type).toBe('model/vrm');
  });
});

describe('legacy flat-record migration', () => {
  it('folds a pre-library flat record into the wrapped shape', async () => {
    await putRaw({ id: 'old1', name: 'Legacy', type: 'model/vrm', blob: blob(), size: 9, addedAt: '2025-01-01T00:00:00.000Z' });

    const meta = await ModelStorageService.getModelMetadata();
    expect(meta).toEqual([
      { id: 'old1', name: 'Legacy', type: 'model/vrm', size: 9, createdAt: '2025-01-01T00:00:00.000Z', lastAccessed: '2025-01-01T00:00:00.000Z' },
    ]);

    const raw = await getRaw('old1');
    expect(raw.data).toMatchObject({ type: 'model/vrm', size: 9 });
    expect(raw.addedAt).toBeUndefined();
  });

  it('makes a legacy model loadable, which it would not be unmigrated', async () => {
    // Unmigrated this rejects with "Model not found": the payload sits at the top level, not under `data`.
    // fake-indexeddb's structured clone drops Blob's constructor identity, so assert reachability, not type.
    await putRaw({ id: 'old2', name: 'Legacy', type: 'model/vrm', blob: blob(), size: 9, addedAt: '2025-01-01T00:00:00.000Z' });
    const data = await ModelStorageService.getModelData('old2');
    expect(data.blob).toBeDefined();
    expect(data).toMatchObject({ type: 'model/vrm', size: 9 });
  });

  it('leaves already-wrapped records untouched', async () => {
    const record: StoredModelRecord = {
      id: 'new1',
      name: 'Modern',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastAccessed: '2026-01-01T00:00:00.000Z',
      data: { type: 'model/vrm', blob: blob(), size: 4 },
    };
    await putRaw(record);
    await ModelStorageService.getModelMetadata();
    const raw = await getRaw('new1');
    expect(raw.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('defaults a flat record missing its type and size', async () => {
    await putRaw({ id: 'old3', name: 'Sparse', blob: blob(), addedAt: '2025-01-01T00:00:00.000Z' });
    const [meta] = await ModelStorageService.getModelMetadata();
    expect(meta).toMatchObject({ type: 'model/vrm', size: 0 });
  });
});

describe('getModelMetadata', () => {
  it('sorts newest first', async () => {
    await putRaw({ id: 'a', name: 'Older', createdAt: '2025-01-01T00:00:00.000Z', data: { type: 'model/vrm', blob: blob(), size: 1 } });
    await putRaw({ id: 'b', name: 'Newer', createdAt: '2026-01-01T00:00:00.000Z', data: { type: 'model/vrm', blob: blob(), size: 1 } });
    const meta = await ModelStorageService.getModelMetadata();
    expect(meta.map((m) => m.name)).toEqual(['Newer', 'Older']);
  });
});

describe('deleteModel', () => {
  it('removes a model', async () => {
    const record = await ModelStorageService.addModel(new File([blob()], 'gone.vrm', { type: 'model/vrm' }));
    await ModelStorageService.deleteModel(record.id);
    await expect(ModelStorageService.getModelData(record.id)).rejects.toBe('Model not found');
  });
});

describe('validation', () => {
  it('rejects a record whose payload carries no blob', async () => {
    await expect(
      ModelStorageService.storeModel({
        id: 'bad',
        name: 'No blob',
        data: { type: 'model/vrm', size: 0 } as unknown as StoredModelRecord['data'],
      }),
    ).rejects.toThrow('Invalid model: missing required fields');
  });
});
