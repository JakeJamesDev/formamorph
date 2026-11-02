// @vitest-environment jsdom
// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ModelStorageService from '@/services/ModelStorageService';
import { PRALINE_AVATAR_ID } from '@/lib/defaultAvatar';
import { buildAvatarPublish } from './avatarPublish';

// This file runs as an NSFW build. The flag is a build-time define, so the list is the one seam left to set.
vi.mock('@/lib/defaultAvatar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/defaultAvatar')>();
  return { ...actual, BUNDLED_AVATARS: actual.bundledAvatarsFor('nsfw') };
});
vi.mock('@/lib/vrmThumbnail', () => ({ renderVrmThumbnail: vi.fn(async () => undefined) }));
// fake-indexeddb's structured clone strips Blob identity, so FileReader refuses the stored file; the bytes aren't under test.
vi.mock('@/lib/imageSource', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/imageSource')>(),
  blobToDataUrl: vi.fn(async () => 'data:model/vrm;base64,'),
}));

const pralineBytes = readFileSync('build-assets/praline-avatar.vrm');
const defaultBytes = readFileSync('public/default-avatar.vrm');
const file = (bytes: Uint8Array<ArrayBuffer> | Buffer, name: string) => new File([new Uint8Array(bytes)], name, { type: 'model/vrm' });

beforeEach(() => {
  localStorage.clear();
  // The bundled file hashes memoize per instance; reset them so each test's served file is read.
  (ModelStorageService as unknown as { bundledHashes: Map<string, unknown> }).bundledHashes.clear();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const bytes = url.includes('praline') ? pralineBytes : defaultBytes;
    return { ok: true, blob: async () => new Blob([new Uint8Array(bytes)]) };
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('publishing Praline', () => {
  it('seeds her real file under her own name, and refuses it though her license passes', async () => {
    await ModelStorageService.seedBundledAvatars();
    const seeded = (await ModelStorageService.getModelMetadata()).find((model) => model.id === PRALINE_AVATAR_ID);
    expect(seeded?.name).toBe('Praline');

    await expect(buildAvatarPublish({ id: PRALINE_AVATAR_ID, name: 'Praline' }))
      .resolves.toMatchObject({ allowed: false, reason: 'defaultAvatar' });
  });

  it('refuses a re-import of her unedited file after the seeded copy is gone', async () => {
    await ModelStorageService.seedBundledAvatars();
    await ModelStorageService.deleteModel(PRALINE_AVATAR_ID);
    const copy = await ModelStorageService.addModel(file(pralineBytes, 'Renamed.vrm'));

    await expect(buildAvatarPublish({ id: copy.id, name: 'Renamed' }))
      .resolves.toMatchObject({ allowed: false, reason: 'defaultAvatar' });
  });

  it('lets an edited copy through, since its license still passes', async () => {
    await ModelStorageService.seedBundledAvatars();
    const edited = new Uint8Array(pralineBytes.length + 4);
    edited.set(pralineBytes);
    const copy = await ModelStorageService.addModel(file(edited, 'Edited.vrm'));

    await expect(buildAvatarPublish({ id: copy.id, name: 'Edited' })).resolves.toMatchObject({ allowed: true });
  });
});
