/**
 * The community caches the age gate is allowed to throw away.
 *
 * Two of the three community-derived stores hold nothing but browsing: the catalog is the listing the
 * browser renders, and the thumbnail store is the pictures on those cards. Both are re-fetched on the
 * next visit, so dropping them costs the player nothing and leaves no unattested content on disk.
 *
 * The remote-image cache is deliberately not in here. It serves the pictures inside worlds already in
 * the player's library, which the gate never touches.
 */
import { clearCatalog } from './worldCatalog';
import { clearThumbs } from './thumbnailCache';

/** Drop the cached community listing and its thumbnails. Best-effort: a failed delete is not fatal. */
export async function purgeCommunityCaches(): Promise<void> {
  await Promise.all([
    clearCatalog().catch((error: unknown) => console.error('Failed to drop the catalog cache:', error)),
    clearThumbs().catch((error: unknown) => console.error('Failed to drop the thumbnail cache:', error)),
  ]);
}
