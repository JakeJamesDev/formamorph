// @vitest-environment jsdom
// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ModelStorageService from '@/services/ModelStorageService';
import { makeVrm1 } from '@/test/glbFixture';
import { renderVrmThumbnail } from '@/lib/vrmThumbnail';
import { buildAvatarPublish } from './avatarPublish';

// jsdom has no WebGL; the one test that needs a portrait supplies it.
vi.mock('@/lib/vrmThumbnail', () => ({ renderVrmThumbnail: vi.fn(async () => undefined) }));
// fake-indexeddb's structured clone strips Blob identity, so FileReader refuses the stored file; the bytes aren't under test.
vi.mock('@/lib/imageSource', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/imageSource')>(),
  blobToDataUrl: vi.fn(async () => 'data:model/vrm;base64,'),
}));

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

  it('publishes the thumbnail the player chose', async () => {
    serve(await vrmFile('Default Avatar'));
    const permissive = {
      name: 'Sedge', avatarPermission: 'everyone', allowRedistribution: true,
      modification: 'allowModificationRedistribution', commercialUsage: 'corporation',
    };
    const file = new File([await makeVrm1(permissive, true)], 'Sedge.vrm', { type: 'model/vrm' });
    const other = await ModelStorageService.addModel(file);
    vi.mocked(renderVrmThumbnail).mockResolvedValueOnce('data:image/webp;base64,GENERATED');
    await ModelStorageService.setThumbnailSource(other.id, 'generated');

    const attempt = await buildAvatarPublish({ id: other.id, name: 'Sedge' });
    expect(attempt.allowed && attempt.payload.thumbnail).toBe('data:image/webp;base64,GENERATED');
  });

  it('lets another model through to the license gate', async () => {
    serve(await vrmFile('Default Avatar'));
    const other = await ModelStorageService.addModel(await vrmFile('Sedge'));

    await expect(buildAvatarPublish({ id: other.id, name: 'Sedge' }))
      .resolves.not.toMatchObject({ reason: 'defaultAvatar' });
  });
});
