/**
 * The other image fields on the Media List: the load-time move of item pictures, map pictures, body backdrops
 * and the world cover into the list. Dictionary covers stay embedded (Q1).
 */
import type { GalleryLink, MediaList, Placeholder, WorldOverview } from '@/types';
import { galleryLinks, type ImageBearing } from './entityImages';
import { addedEntries, placeGalleryFile } from './mediaGallery';
import { isMediaRef, resolveMedia } from './mediaList';
import { labelPlaceholders } from './placementLetters';

type Fields = Record<string, unknown>;
const isRecord = (value: unknown): value is Fields => !!value && typeof value === 'object';

/** A stored single-image value that still holds embedded data (a string, not a link). */
const isEmbedded = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** The subject names the fallback uses: the map and the cover have no record to name them. */
export const MAP_SUBJECT = 'Map';
export const COVER_SUBJECT = 'Cover';
/** An unnamed Body's fallback subject (Q42). */
export const BODY_SUBJECT = 'Body';

/** The world cover's displayable data, whatever form it is stored in. A link the list lacks reads empty. */
export const coverData = (overview: Pick<WorldOverview, 'thumbnail' | 'mediaList'> | null | undefined): string | undefined =>
  resolveMedia(overview?.thumbnail, overview?.mediaList, 'image')?.data;

/** A placed link as the world cover stores it: `{ mediaId }`, embedded data, or '' once freed. */
export const storedCover = (link: GalleryLink | null): WorldOverview['thumbnail'] =>
  (!link ? '' : isMediaRef(link) ? { mediaId: link.mediaId } : link.data);

/**
 * A single picture placed for a single field (cover, backdrop): a link to its entry, plus the entries to add.
 * A world with no list keeps the picture embedded (Q26).
 */
export function linkSingle(
  list: MediaList | undefined, file: { data: string; name?: string }, subject: string | undefined,
): { link: GalleryLink; added: MediaList } {
  if (!list) return { link: { data: file.data, ...(file.name ? { name: file.name } : {}) }, added: {} };
  const placed = placeGalleryFile(list, file, 'image', subject);
  return { link: { mediaId: placed.id }, added: addedEntries(list, placed.list) };
}

/** Move item, map, backdrop and cover pictures into the world's Media List. Idempotent: a link passes through. */
export function migrateOtherImagesToMediaList(world: Fields): void {
  const overview = isRecord(world.worldOverview) ? world.worldOverview : undefined;
  if (!overview) return;
  let list: MediaList = isRecord(overview.mediaList) ? overview.mediaList as MediaList : {};
  const placeholders = Array.isArray(world.placeholders) ? world.placeholders as Placeholder[] : [];
  const subjectOf = (record: Fields) => (typeof record.name === 'string' ? labelPlaceholders(record.name, placeholders) : undefined);

  const linkAll = (links: readonly GalleryLink[], subject: string | undefined): GalleryLink[] => links.map((link) => {
    if (isMediaRef(link)) return link;
    const placed = placeGalleryFile(list, link, 'image', subject);
    list = placed.list;
    return { mediaId: placed.id, ...(link.requires?.length ? { requires: link.requires } : {}) };
  });
  const moveGallery = (record: unknown) => {
    if (!isRecord(record) || !Array.isArray(record.images) || record.images.every(isMediaRef)) return record;
    return { ...record, images: linkAll(galleryLinks(record as ImageBearing), subjectOf(record)) };
  };

  if (Array.isArray(world.items)) world.items = world.items.map(moveGallery);

  if (Array.isArray(world.bodies)) {
    world.bodies = world.bodies.map((body) => {
      if (!isRecord(body) || !isRecord(body.backdrop) || body.backdrop.kind !== 'image' || !isRecord(body.backdrop.image)) return body;
      const [link] = linkAll(galleryLinks({ images: [body.backdrop.image as unknown as GalleryLink] }), subjectOf(body) || BODY_SUBJECT);
      return link ? { ...body, backdrop: { ...body.backdrop, image: link } } : body;
    });
  }

  let next: Fields = { ...overview };
  const map = overview.mapBackground;
  if (isRecord(map) && Array.isArray(map.images) && !map.images.every(isMediaRef)) {
    next = { ...next, mapBackground: { ...map, images: linkAll(galleryLinks(map as ImageBearing), MAP_SUBJECT) } };
  }
  if (isEmbedded(overview.thumbnail)) {
    const placed = placeGalleryFile(list, { data: overview.thumbnail }, 'image', COVER_SUBJECT);
    list = placed.list;
    next = { ...next, thumbnail: { mediaId: placed.id } };
  }
  world.worldOverview = { ...next, mediaList: list };
}
