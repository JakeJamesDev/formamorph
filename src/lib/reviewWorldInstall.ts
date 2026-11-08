import { migrateWorld } from '@/lib/version';
import { withImportedWorldTools } from '@/lib/tools/worldTools';
import { resolveImportedWorld } from '@/lib/worldBundleRun';
import { randomUUID } from '@/lib/uuid';
import WorldStorageService, { assertWorldFields } from '@/services/WorldStorageService';
import type { ReviewQueueItem } from '@/services/ReviewService';

/** Library name of a copy taken from the review queue. */
export const reviewCopyName = (name: string) => `${name} (Pending Review)`;

/**
 * Store a waiting world's content as a new library world, so staff can play the version under review.
 *
 * The copy names no listing: the catalog serves the approved version, and a link would show this copy as
 * a download of it.
 *
 * @returns The library name the copy was stored under
 */
export async function installReviewWorld(
  content: unknown, item: Pick<ReviewQueueItem, 'name' | 'author'>,
): Promise<string> {
  const migrated = migrateWorld(content);
  assertWorldFields(migrated);
  const uploader = item.author?.username?.trim();
  if (migrated.worldOverview && !migrated.worldOverview.author?.trim() && uploader) {
    migrated.worldOverview.author = uploader;
  }
  const { world } = withImportedWorldTools(await resolveImportedWorld(migrated));

  const id = `uploaded-${randomUUID()}`;
  world.id = id;
  const name = reviewCopyName(world.worldOverview?.name || item.name || 'World');
  await WorldStorageService.storeWorld({
    id,
    name,
    description: world.worldOverview?.description || '',
    author: uploader || '',
    thumbnail: world.worldOverview?.thumbnail ?? undefined,
    data: world,
  });
  return name;
}
