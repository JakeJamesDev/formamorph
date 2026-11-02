// @vitest-environment jsdom
// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import ModelStorageService from './ModelStorageService';
import { BUNDLED_AVATARS, BUNDLED_DEFAULT_URL } from '@/lib/defaultAvatar';
import { promisifyRequest } from '@/lib/idb';
import { makeVrm1 } from '@/test/glbFixture';

// Vitest serves the build's define as a global, so the real modules read this value as a `none` build would.
vi.hoisted(() => { (globalThis as Record<string, unknown>).__AVATAR_SET__ = 'none'; });

vi.mock('@/lib/vrmThumbnail', () => ({ renderVrmThumbnail: vi.fn(async () => undefined) }));

const added = (name: string) => new File([makeVrm1({ name })], `${name}.vrm`, { type: 'model/vrm' });

beforeEach(async () => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => makeVrm1({ name: 'Bundled' }) })));
  await ModelStorageService.initialize();
  const db = await new Promise<IDBDatabase>((resolve) => {
    const request = indexedDB.open('FORMAMORPH_MODELS_DB');
    request.onsuccess = () => resolve(request.result);
  });
  await promisifyRequest(db.transaction(['models'], 'readwrite').objectStore('models').clear());
});
afterEach(() => vi.unstubAllGlobals());

describe('the library on a build with no bundled Avatar', () => {
  it('holds no bundled entry and no default file', () => {
    expect(BUNDLED_AVATARS).toEqual([]);
    expect(BUNDLED_DEFAULT_URL).toBeUndefined();
  });

  it('seeds nothing and requests nothing', async () => {
    await ModelStorageService.seedBundledAvatars();
    expect(await ModelStorageService.getModelMetadata()).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requests no bundled file for the hash check', async () => {
    await ModelStorageService.addModel(added('Mine'));
    expect(await ModelStorageService.defaultAvatarHashes()).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('can delete its last Avatar and reach zero', async () => {
    const only = await ModelStorageService.addModel(added('Mine'));
    await ModelStorageService.deleteModel(only.id);
    expect(await ModelStorageService.getModelMetadata()).toEqual([]);
  });

  it('stores an added .vrm and serves it', async () => {
    const record = await ModelStorageService.addModel(added('Mine'));
    expect((await ModelStorageService.getModelMetadata()).map((model) => model.id)).toEqual([record.id]);
    // fake-indexeddb's clone drops a jsdom File's bytes, so the bytes themselves are read in a real browser only.
    await expect(ModelStorageService.getModelData(record.id)).resolves.toMatchObject({ hash: record.data.hash });
  });
});
