/**
 * The library boundary for entity galleries (Q18): library entities, cards and listings hold embedded pictures,
 * a world with a Media List holds ids. Placement runs on the way in, resolution on the way out, and the two
 * forms compare by hash token.
 */
import type { GalleryLink, MediaAsset, MediaList, MediaRef, TraitRequirementRow } from '@/types';
import { galleryLinks, type ImageBearing } from '@/lib/entityImages';
import { embedGallery, isMediaRef, mediaHashes, mediaNameFromAsset, mediaToken, placeMedia, unhashedData, type MediaHashes } from '@/lib/mediaList';
import { resolveSound } from '@/lib/mediaSounds';

/** A record whose gallery and sound cross the boundary: a library or world entity. */
export type MediaBearing = ImageBearing & { name?: string; sound?: MediaAsset | MediaRef };

/** What a media compare reads: the world's list and the hashes of every embedded value in play. */
export interface MediaLookup {
  list: MediaList | undefined;
  hashes: MediaHashes;
}

export const NO_MEDIA_HASHES: MediaHashes = new Map();

/** The embedded gallery and sound data of `items`, plus the list's entries without a stored hash. */
export const galleryData = (items: readonly (MediaBearing | null | undefined)[], list: MediaList | undefined): string[] =>
  unhashedData(items.flatMap((item) => [...galleryLinks(item), ...(item?.sound ? [item.sound] : [])]), list);

/** Hashes for placing or comparing the galleries of `items` against `list`, entries' stored hashes included. */
export async function loadMediaHashes(items: readonly (MediaBearing | null | undefined)[], list: MediaList | undefined): Promise<MediaHashes> {
  const hashes = await mediaHashes(galleryData(items, list));
  for (const entry of Object.values(list ?? {})) if (entry.hash) hashes.set(entry.data, entry.hash);
  return hashes;
}

/** The lookup a compare of `items` against a world with `list` needs. */
export const loadMediaLookup = async (items: readonly (MediaBearing | null | undefined)[], list: MediaList | undefined): Promise<MediaLookup> =>
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
export function placeEntityMedia<T extends MediaBearing>(
  entity: T, list: MediaList | undefined, hashes: MediaHashes,
): { entity: T; list: MediaList | undefined } {
  if (!list) return { entity, list };
  let next = list;
  let out = entity;
  const links = galleryLinks(entity);
  if (links.some((link) => !isMediaRef(link))) {
    const images = links.map((link): GalleryLink => {
      if (isMediaRef(link)) return link;
      const placed = placeMedia(next, { data: link.data, entryName: link.name }, { kind: 'image', subject: entity.name, hashes });
      next = placed.list;
      return { mediaId: placed.id, ...(link.requires?.length ? { requires: link.requires } : {}) };
    });
    out = withoutLegacyImage({ ...out, images });
  }
  const sound = entity.sound;
  if (sound && !isMediaRef(sound) && sound.data) {
    // A sound's stored name is a file name; only a media extension drops (Q43).
    const placed = placeMedia(next, { data: sound.data, type: sound.type, entryName: mediaNameFromAsset(sound.name) }, { kind: 'sound', subject: entity.name, hashes });
    next = placed.list;
    out = { ...out, sound: { mediaId: placed.id } };
  }
  return { entity: out, list: next };
}

/** The entity with every gallery and sound link turned back into an embedded file carrying its entry's name. An
 *  entity holding no link comes back as it is. A link the list lacks drops. */
export function withEmbeddedMedia<T extends MediaBearing>(entity: T, list: MediaList | undefined): T {
  let out = entity;
  if (galleryLinks(entity).some(isMediaRef)) out = withoutLegacyImage({ ...out, images: embedGallery(galleryLinks(entity), list) });
  if (isMediaRef(entity.sound)) {
    const sound = resolveSound(entity.sound, list);
    if (sound) out = { ...out, sound };
    else {
      out = { ...out };
      delete out.sound;
    }
  }
  return out;
}

/** A sound as two copies compare it: its hash token, so a link and the same embedded file read equal. */
export const comparableSound = (sound: MediaAsset | MediaRef | undefined, media: MediaLookup): string | undefined =>
  (sound ? mediaToken(sound, media.list, media.hashes) : undefined);

/** A gallery as two copies compare it: each picture's hash token and Visibility rule, in order. Names never
 *  compare (Q30). */
export const comparableGallery = (
  images: readonly GalleryLink[], media: MediaLookup,
): { media: string | undefined; requires?: TraitRequirementRow[] }[] =>
  images.map((image) => ({
    media: mediaToken(image, media.list, media.hashes),
    ...(image.requires?.length ? { requires: image.requires } : {}),
  }));
