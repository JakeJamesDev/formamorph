import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VrmLicense } from '@/types';
import { avatarPublishRefusal, buildAvatarPublish } from './avatarPublish';

const getModelData = vi.fn();
const ensureThumbnail = vi.fn();
vi.mock('@/services/ModelStorageService', () => ({
  default: {
    getModelData: (id: string) => getModelData(id),
    ensureThumbnail: (id: string) => ensureThumbnail(id),
  },
}));

const PASSING: VrmLicense = {
  metaVersion: '1',
  avatarPermission: 'everyone',
  allowRedistribution: true,
  modification: 'allowModificationRedistribution',
  commercialUse: 'corporation',
};

/** The library's stored payload for one model. */
const stored = (over: Record<string, unknown> = {}) => ({
  type: 'model/vrm',
  blob: new Blob(['vrm-bytes']),
  size: 9,
  hash: 'abc123',
  license: PASSING,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  ensureThumbnail.mockResolvedValue(undefined);
  // jsdom's FileReader does not read Blobs in every version; make the data URL deterministic.
  class StubReader {
    result = 'data:model/vnd.vrm;base64,dnJtLWJ5dGVz';
    onloadend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL() { queueMicrotask(() => this.onloadend?.()); }
  }
  vi.stubGlobal('FileReader', StubReader);
});

describe('buildAvatarPublish', () => {
  it('builds a payload from a model whose file grants every right', async () => {
    getModelData.mockResolvedValue(stored({ license: { ...PASSING, title: 'Sedge', authors: ['Alice'] } }));

    const result = await buildAvatarPublish({ id: 'm1', name: 'sedge_final' });

    expect(result.allowed).toBe(true);
    expect(result.allowed && result.payload).toMatchObject({
      kind: 'model',
      name: 'Sedge',
      description: 'By Alice.',
    });
    expect(result.allowed && result.payload.contentData).toMatchObject({
      vrm: 'data:model/vnd.vrm;base64,dnJtLWJ5dGVz',
      hash: 'abc123',
    });
  });

  it('carries the model’s stored picture into the payload', async () => {
    getModelData.mockResolvedValue(stored({ thumbnail: 'data:image/webp;base64,BBBB' }));

    const result = await buildAvatarPublish({ id: 'm1', name: 'Sedge' });

    expect(result.allowed && result.payload.thumbnail).toBe('data:image/webp;base64,BBBB');
  });

  it('refuses a model whose file fails a requirement, and names the one that failed', async () => {
    getModelData.mockResolvedValue(stored({ license: { ...PASSING, allowRedistribution: false } }));

    const result = await buildAvatarPublish({ id: 'm1', name: 'Sedge' });

    expect(result.allowed).toBe(false);
    expect(!result.allowed && result.failedRequirements).toEqual(['allowRedistribution']);
  });

  it('refuses a plain glTF, which grants nothing because it says nothing', async () => {
    getModelData.mockResolvedValue(stored({ license: { metaVersion: null } }));

    const result = await buildAvatarPublish({ id: 'm1', name: 'Plain' });

    expect(result.allowed).toBe(false);
    expect(!result.allowed && result.failedRequirements).toEqual([
      'metaVersion', 'avatarPermission', 'allowRedistribution', 'modification', 'commercialUsage',
    ]);
  });

  it('refuses a model whose bytes cannot be read at all', async () => {
    getModelData.mockRejectedValue(new Error('missing'));

    const result = await buildAvatarPublish({ id: 'm1', name: 'Gone' });

    expect(result.allowed).toBe(false);
  });

  it('re-reads a stale-shape license before judging it, rather than gating on the grid’s stale copy', async () => {
    // A record stored before the gate's fields existed carries a license that would fail every
    // requirement. The backfill is what makes the verdict about the file rather than about the record's
    // age, so it has to run before the gate — not after, and not only when a thumbnail is missing.
    let refreshed = false;
    ensureThumbnail.mockImplementation(async () => { refreshed = true; });
    getModelData.mockImplementation(async () => {
      expect(refreshed).toBe(true);
      return stored();
    });

    const result = await buildAvatarPublish({ id: 'm1', name: 'Legacy' });

    expect(ensureThumbnail).toHaveBeenCalledWith('m1');
    expect(result.allowed).toBe(true);
  });

  it('still judges the file when the backfill itself fails', async () => {
    // A model that cannot be rendered must still be publishable: the backfill is a best effort, and its
    // failure says nothing about the license.
    ensureThumbnail.mockRejectedValue(new Error('no GPU context'));
    getModelData.mockResolvedValue(stored());

    const result = await buildAvatarPublish({ id: 'm1', name: 'Unrenderable' });

    expect(result.allowed).toBe(true);
  });
});

describe('avatarPublishRefusal', () => {
  it('names the one requirement that failed', () => {
    expect(avatarPublishRefusal(['allowRedistribution']))
      .toBe('This Avatar can’t be published: its file doesn’t allow redistribution.');
  });

  it('names several, reading as a list', () => {
    expect(avatarPublishRefusal(['allowRedistribution', 'commercialUsage']))
      .toBe('This Avatar can’t be published: its file doesn’t allow redistribution or commercial use.');
  });

  it('says a file with no VRM 1.0 metadata carries no permission at all', () => {
    // Every requirement fails together for a plain glTF, and listing five of them explains nothing —
    // the one thing the player can act on is the file's format.
    expect(avatarPublishRefusal(['metaVersion', 'avatarPermission', 'allowRedistribution', 'modification', 'commercialUsage']))
      .toBe('This Avatar can’t be published: its file carries no VRM 1.0 license information.');
  });
});
