// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ModelStorageService from '@/services/ModelStorageService';
import { makeVrm1 } from '@/test/glbFixture';
import { buildAvatarPublish } from './avatarPublish';

// The publish attempt against the real library: records stored by the service, the bundled file served by fetch.
const vrmFile = async (title: string) => new File([await makeVrm1({ name: title })], `${title}.vrm`, { type: 'model/vrm' });
const serve = (body: Blob) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => body }));

beforeEach(() => {
  (ModelStorageService as unknown as { bundledDefaultHash: unknown }).bundledDefaultHash = null;
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('buildAvatarPublish against the library', () => {
  it('refuses the seeded default, and a re-import of its file under a new name after the seed is deleted', async () => {
    const bundled = await vrmFile('Default Avatar');
    serve(bundled);
    await ModelStorageService.seedDefaultModel('./default-avatar.vrm');

    await expect(buildAvatarPublish({ id: 'default-avatar', name: 'Default Avatar' }))
      .resolves.toMatchObject({ allowed: false, reason: 'defaultAvatar' });

    const copy = await ModelStorageService.addModel(new File([bundled], 'My Model.vrm', { type: 'model/vrm' }));
    await ModelStorageService.deleteModel('default-avatar');

    await expect(buildAvatarPublish({ id: copy.id, name: 'My Model' }))
      .resolves.toMatchObject({ allowed: false, reason: 'defaultAvatar' });
  });

  it('lets another model through to the license gate', async () => {
    serve(await vrmFile('Default Avatar'));
    const other = await ModelStorageService.addModel(await vrmFile('Sedge'));

    await expect(buildAvatarPublish({ id: other.id, name: 'Sedge' }))
      .resolves.not.toMatchObject({ reason: 'defaultAvatar' });
  });
});
