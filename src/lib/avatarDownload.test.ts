import { describe, it, expect } from 'vitest';
import { avatarListingBlob, avatarListingToVrmData } from './avatarDownload';
import type { AvatarListingContent, VrmLicense } from '@/types';

const vrmDataUrl = (mime: string, bytes: string) => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;

const license: VrmLicense = {
  metaVersion: '1',
  title: 'Robot Girl',
  avatarPermission: 'everyone',
  allowRedistribution: true,
  modification: 'allowModificationRedistribution',
  commercialUse: 'corporation',
};

describe('avatarListingBlob', () => {
  it('decodes the content\'s data URL back into the original bytes', async () => {
    const content: AvatarListingContent = { vrm: vrmDataUrl('model/gltf-binary', 'vrm-bytes') };

    const blob = await avatarListingBlob(content);

    expect(blob.type).toBe('model/gltf-binary');
    expect(Buffer.from(await blob.arrayBuffer()).toString()).toBe('vrm-bytes');
  });

  it('falls back to model/vrm when the data URL carries no mime', async () => {
    const content: AvatarListingContent = { vrm: `data:;base64,${Buffer.from('vrm-bytes').toString('base64')}` };

    const blob = await avatarListingBlob(content);

    expect(blob.type).toBe('model/vrm');
  });
});

describe('avatarListingToVrmData', () => {
  it('carries the hash and license through verbatim, both already resolved at publish time', async () => {
    const content: AvatarListingContent = { vrm: vrmDataUrl('model/vrm', 'vrm-bytes'), license, hash: 'content-hash' };

    const data = await avatarListingToVrmData(content);

    expect(data.hash).toBe('content-hash');
    expect(data.license).toBe(license);
    expect(data.type).toBe('model/vrm');
    expect(data.size).toBe(data.blob.size);
    expect(Buffer.from(await data.blob.arrayBuffer()).toString()).toBe('vrm-bytes');
  });

  it('stores no thumbnail — the library backfills one lazily from the blob on first view', async () => {
    const content: AvatarListingContent = { vrm: vrmDataUrl('model/vrm', 'vrm-bytes'), license };

    const data = await avatarListingToVrmData(content);

    expect(data.thumbnail).toBeUndefined();
  });
});
