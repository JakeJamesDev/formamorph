import { dataUrlToBuffer, dataUrlMime } from '@/lib/imageBytes';
import type { AvatarListingContent, VrmData } from '@/types';

/** An Avatar listing's `.vrm` bytes as a Blob, decoded from the stored content's data URL. */
export async function avatarListingBlob(content: AvatarListingContent): Promise<Blob> {
  const buffer = await dataUrlToBuffer(content.vrm);
  return new Blob([buffer], { type: dataUrlMime(content.vrm) || 'model/vrm' });
}

/** Turn a downloaded Avatar listing's content into the Model Library's stored payload. The hash and
 *  license ride along verbatim — both were already resolved from these same bytes at publish time. */
export async function avatarListingToVrmData(content: AvatarListingContent): Promise<VrmData> {
  const blob = await avatarListingBlob(content);
  return { type: blob.type, blob, size: blob.size, hash: content.hash, license: content.license };
}
