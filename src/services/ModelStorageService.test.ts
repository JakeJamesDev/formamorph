// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ModelStorageService, { type StoredModelRecord } from './ModelStorageService';
import { promisifyRequest } from '@/lib/idb';
import { makeVrm1, THUMB_DATA_URL } from '@/test/glbFixture';

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
  localStorage.clear();
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
  it('removes a model when another remains', async () => {
    const gone = await ModelStorageService.addModel(new File([blob('a')], 'gone.vrm', { type: 'model/vrm' }));
    await ModelStorageService.addModel(new File([blob('b')], 'kept.vrm', { type: 'model/vrm' }));
    await ModelStorageService.deleteModel(gone.id);
    await expect(ModelStorageService.getModelData(gone.id)).rejects.toBe('Model not found');
  });

  it('refuses to delete the last model, so the player always has one to be', async () => {
    const only = await ModelStorageService.addModel(new File([blob()], 'only.vrm', { type: 'model/vrm' }));
    await expect(ModelStorageService.deleteModel(only.id)).rejects.toThrow('Cannot delete the last model');
    await expect(ModelStorageService.getModelData(only.id)).resolves.toBeDefined();
  });

  it('allows deleting the last model once a second exists, whichever one it is', async () => {
    // The rule is "keep at least one", not "keep the first/bundled one".
    const first = await ModelStorageService.addModel(new File([blob('a')], 'first.vrm', { type: 'model/vrm' }));
    await ModelStorageService.addModel(new File([blob('b')], 'second.vrm', { type: 'model/vrm' }));
    await expect(ModelStorageService.deleteModel(first.id)).resolves.toBeUndefined();
  });

  it('does not block deleting an id the library does not hold', async () => {
    await ModelStorageService.addModel(new File([blob()], 'only.vrm', { type: 'model/vrm' }));
    // The single stored model isn't the target, so the invariant is not at risk.
    await expect(ModelStorageService.deleteModel('not-here')).resolves.toBeUndefined();
  });
});

describe('seedDefaultModel', () => {
  const vrmUrl = './default-model.vrm';
  const serve = (blob: Blob) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: async () => blob }));

  afterEach(() => vi.unstubAllGlobals());

  it('seeds the bundled model under a stable id, named from its own title', async () => {
    serve(await makeVrm1({ name: 'Default Model' }));
    await ModelStorageService.seedDefaultModel(vrmUrl);
    const [meta] = await ModelStorageService.getModelMetadata();
    expect(meta).toMatchObject({ id: 'default-model', name: 'Default Model' });
  });

  it('only seeds once, so a deleted default stays deleted', async () => {
    serve(await makeVrm1({ name: 'Default Model' }));
    await ModelStorageService.seedDefaultModel(vrmUrl);
    await ModelStorageService.addModel(new File([blob('other')], 'Other.vrm', { type: 'model/vrm' }));
    await ModelStorageService.deleteModel('default-model');

    await ModelStorageService.seedDefaultModel(vrmUrl);
    const names = (await ModelStorageService.getModelMetadata()).map((m) => m.id);
    expect(names).not.toContain('default-model');
  });

  it('does not re-fetch on a later launch', async () => {
    serve(await makeVrm1({ name: 'Default Model' }));
    await ModelStorageService.seedDefaultModel(vrmUrl);
    await ModelStorageService.seedDefaultModel(vrmUrl);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('survives a fetch failure rather than breaking the library', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(ModelStorageService.seedDefaultModel(vrmUrl)).resolves.toBeUndefined();
    await expect(ModelStorageService.getModelMetadata()).resolves.toEqual([]);
  });
});

describe('findDuplicate', () => {
  it('finds a stored model with identical bytes', async () => {
    const added = await ModelStorageService.addModel(new File([blob('same')], 'orig.vrm', { type: 'model/vrm' }));
    const match = await ModelStorageService.findDuplicate(new Blob(['same']));
    expect(match?.id).toBe(added.id);
  });

  it('returns null for different bytes', async () => {
    await ModelStorageService.addModel(new File([blob('one')], 'orig.vrm', { type: 'model/vrm' }));
    await expect(ModelStorageService.findDuplicate(new Blob(['two']))).resolves.toBeNull();
  });

  it('ignores legacy records that carry no hash', async () => {
    await putRaw({ id: 'old', name: 'Legacy', type: 'model/vrm', blob: blob('same'), size: 4, addedAt: '2025-01-01T00:00:00.000Z' });
    // Migration wraps it but can't invent a hash; it must not match by accident.
    await expect(ModelStorageService.findDuplicate(new Blob(['same']))).resolves.toBeNull();
  });
});

describe('addModel metadata', () => {
  it('records a content hash', async () => {
    const record = await ModelStorageService.addModel(new File([blob()], 'x.vrm', { type: 'model/vrm' }));
    expect(record.data.hash).toBeTruthy();
  });

  it('prefers the VRM title over the filename', async () => {
    const vrm = await makeVrm1({ name: 'Proper Name' }).arrayBuffer();
    const record = await ModelStorageService.addModel(new File([vrm], 'export_final_v2.vrm', { type: 'model/vrm' }));
    expect(record.name).toBe('Proper Name');
    expect(record.data.license?.metaVersion).toBe('1');
  });

  it('falls back to the filename when the model has no title', async () => {
    const record = await ModelStorageService.addModel(new File([blob()], 'Fallback.vrm', { type: 'model/vrm' }));
    expect(record.name).toBe('Fallback');
  });

  it('keeps the embedded thumbnail at import, with no render needed', async () => {
    const vrm = await makeVrm1({ name: 'Thumbed' }, true).arrayBuffer();
    const record = await ModelStorageService.addModel(new File([vrm], 'thumbed.vrm', { type: 'model/vrm' }));
    expect(record.data.thumbnail).toBe(THUMB_DATA_URL);
  });
});

describe('ensureThumbnail', () => {
  it('returns the embedded thumbnail without attempting a render', async () => {
    const vrm = await makeVrm1({ name: 'Thumbed' }, true).arrayBuffer();
    const record = await ModelStorageService.addModel(new File([vrm], 'thumbed.vrm', { type: 'model/vrm' }));
    await expect(ModelStorageService.ensureThumbnail(record.id)).resolves.toBe(THUMB_DATA_URL);
  });

  it('survives a legacy record it cannot read rather than breaking the caller', async () => {
    // fake-indexeddb's structured clone strips Blob's methods, so the backfill's `blob.arrayBuffer()` throws
    // here in a way it wouldn't against real IndexedDB. That makes this a test of the never-throw contract,
    // NOT of the backfill — the backfill itself is verified against real IndexedDB in the browser.
    const vrm = new Uint8Array(await makeVrm1({ name: 'Legacy VRM' }).arrayBuffer());
    await putRaw({ id: 'old', name: 'Legacy', type: 'model/vrm', blob: new Blob([vrm]), size: vrm.byteLength, addedAt: '2025-01-01T00:00:00.000Z' });
    await expect(ModelStorageService.ensureThumbnail('old')).resolves.toBeUndefined();
  });

  it('marks a model whose thumbnail cannot be produced, so it is not retried every view', async () => {
    // jsdom has no WebGL, so the render fallback yields nothing — the same path as an unrenderable model.
    const record = await ModelStorageService.addModel(new File([blob()], 'plain.vrm', { type: 'model/vrm' }));
    await expect(ModelStorageService.ensureThumbnail(record.id)).resolves.toBeUndefined();

    const raw = await getRaw(record.id);
    expect((raw.data as Record<string, unknown>).thumbnailFailed).toBe(true);
  });

  it('returns undefined for a model that is not in the library', async () => {
    await expect(ModelStorageService.ensureThumbnail('missing')).resolves.toBeUndefined();
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
