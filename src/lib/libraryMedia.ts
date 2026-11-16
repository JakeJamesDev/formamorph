/**
 * The library boundary for entity galleries (Q18): library entities, cards and listings hold embedded pictures,
 * a world with a Media List holds ids. Placement runs on the way in, resolution on the way out, and the two
 * forms compare by hash token.
 */
import type { GalleryLink, MediaList, TraitRequirementRow } from '@/types';
import { galleryLinks, type ImageBearing } from '@/lib/entityImages';
import { embedGallery, isMediaRef, mediaHashes, mediaToken, placeMedia, unhashedData, type MediaHashes } from '@/lib/mediaList';

/** What a media compare reads: the world's list and the hashes of every embedded value in play. */
export interface MediaLookup {
  list: MediaList | undefined;
  hashes: MediaHashes;
}

export const NO_MEDIA_HASHES: MediaHashes = new Map();

/** The embedded gallery data of `items`, plus the list's entries without a stored hash. */
export const galleryData = (items: readonly (ImageBearing | null | undefined)[], list: MediaList | undefined): string[] =>
  unhashedData(items.flatMap((item) => galleryLinks(item)), list);

/** Hashes for placing or comparing the galleries of `items` against `list`, entries' stored hashes included. */
export async function loadMediaHashes(items: readonly (ImageBearing | null | undefined)[], list: MediaList | undefined): Promise<MediaHashes> {
  const hashes = await mediaHashes(galleryData(items, list));
  for (const entry of Object.values(list ?? {})) if (entry.hash) hashes.set(entry.data, entry.hash);
  return hashes;
}

/** The lookup a compare of `items` against a world with `list` needs. */
export const loadMediaLookup = async (items: readonly (ImageBearing | null | undefined)[], list: MediaList | undefined): Promise<MediaLookup> =>
  ({ list, hashes: await loadMediaHashes(items, list) });

/** The entity without the pre-gallery single portrait, which a rewritten `images` replaces. */
function withoutLegacyImage<T extends ImageBearing>(entity: T): T {
  const next = { ...entity };
  delete next.image;
  return next;
}

/**
 * The entity with each embedded gallery picture placed in `list` and linked by id, and the list it went into.
 * A world without a list keeps embedded pictures (Q26), and an entity with nothing embedded keeps its identity.
 */
export function placeEntityMedia<T extends ImageBearing & { name?: string }>(
  entity: T, list: MediaList | undefined, hashes: MediaHashes,
): { entity: T; list: MediaList | undefined } {
  if (!list) return { entity, list };
  const links = galleryLinks(entity);
  if (!links.some((link) => !isMediaRef(link))) return { entity, list };
  let next = list;
  const images = links.map((link): GalleryLink => {
    if (isMediaRef(link)) return link;
    const placed = placeMedia(next, { data: link.data, entryName: link.name }, { kind: 'image', subject: entity.name, hashes });
    next = placed.list;
    return { mediaId: placed.id, ...(link.requires?.length ? { requires: link.requires } : {}) };
  });
  return { entity: withoutLegacyImage({ ...entity, images }), list: next };
}

/** The entity with every gallery link turned back into an embedded picture carrying its entry's name. An entity
 *  holding no link comes back as it is. */
export function withEmbeddedMedia<T extends ImageBearing>(entity: T, list: MediaList | undefined): T {
  if (!galleryLinks(entity).some(isMediaRef)) return entity;
  return withoutLegacyImage({ ...entity, images: embedGallery(galleryLinks(entity), list) });
}

/** A gallery as two copies compare it: each picture's hash token and Visibility rule, in order. Names never
 *  compare (Q30). */
export const comparableGallery = (
  images: readonly GalleryLink[], media: MediaLookup,
): { media: string | undefined; requires?: TraitRequirementRow[] }[] =>
  images.map((image) => ({
    media: mediaToken(image, media.list, media.hashes),
    ...(image.requires?.length ? { requires: image.requires } : {}),
  }));
