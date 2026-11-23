/**
 * Delete From World: every link to one Media Entry dropped, record by record, and the entry itself removed (Q6).
 * Each helper returns its input unchanged when it held no link, so an untouched record keeps its identity.
 */
import type { Body, Entity, GameLocation, Item, MediaList, WorldOverview } from '@/types';
import { withOutline } from './bodyLayout';
import { galleryLink } from './entityImages';
import { listWithoutVariant } from './layeredEdit';
import { isMediaRef, uniqueMediaName } from './mediaList';

const linksTo = (value: unknown, id: string): boolean => isMediaRef(value) && value.mediaId === id;

/** A stored gallery without its links to `id`, as a picture or a Weather Mask; the same array when it had none. */
function withoutGalleryLink<T>(images: T[] | undefined, id: string): T[] | undefined {
  if (!images) return images;
  let changed = false;
  const kept = images.flatMap((raw) => {
    if (linksTo(galleryLink(raw), id)) { changed = true; return []; }
    if (!isRecord(raw) || raw.weatherMask !== id) return [raw];
    changed = true;
    const { weatherMask: _gone, ...rest } = raw;
    return [rest as T];
  });
  return changed ? kept : images;
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

/** `record` with an optional `field` dropped when it links `id`. The field reads as unknown: its declared type holds no link yet. */
function withoutSingle<T extends object>(record: T, field: keyof T & string, id: string): T {
  if (!linksTo(record[field], id)) return record;
  const { [field]: _gone, ...rest } = record;
  return rest as T;
}

function withoutGallery<T extends { images?: unknown[] }>(record: T, id: string): T {
  const images = withoutGalleryLink(record.images, id);
  return images === record.images ? record : { ...record, images };
}

export const entityWithoutMedia = (entity: Entity, id: string): Entity =>
  withoutSingle(withoutGallery(entity, id), 'sound', id);

export const locationWithoutMedia = (location: GameLocation, id: string): GameLocation =>
  withoutSingle(withoutGallery(location, id), 'ambientSound', id);

export const itemWithoutMedia = (item: Item, id: string): Item => withoutGallery(item, id);

/** A Body whose Custom Image linked `id` goes back to the Humanoid outline, as removing its file does. */
export const bodyWithoutMedia = (body: Body, id: string): Body =>
  body.backdrop.kind === 'image' && linksTo(body.backdrop.image, id) ? withOutline(body, 'humanoid') : body;

/** The overview without `id`: its entry, the cover and music links, the Map Background's links and the Variants that link it. */
export function overviewWithoutMedia(overview: WorldOverview, id: string): WorldOverview {
  let next = overview;
  if (linksTo(next.thumbnail, id)) next = { ...next, thumbnail: null };
  if (linksTo(next.bgm, id)) next = { ...next, bgm: null };
  const map = next.mapBackground;
  const mapImages = withoutGalleryLink(map?.images, id);
  if (map && mapImages !== map.images) {
    // The map field goes with its last image.
    const { mapBackground: _gone, ...rest } = next;
    next = mapImages?.length ? { ...next, mapBackground: { ...map, images: mapImages } } : rest;
  }
  const mediaList = listWithoutVariant(next.mediaList, id);
  if (mediaList !== next.mediaList) next = { ...next, mediaList };
  if (next.mediaList?.[id]) {
    const { [id]: _gone, ...rest } = next.mediaList;
    next = { ...next, mediaList: rest };
  }
  return next;
}

/** The list with entry `id` renamed, made unique against the others (Q5). A blank name or a missing entry leaves it. */
export function renameMediaEntry(list: MediaList | undefined, id: string, name: string): MediaList | undefined {
  const entry = list?.[id];
  if (!list || !entry || !name.trim()) return list;
  const unique = uniqueMediaName(name, list, id);
  return unique === entry.name ? list : { ...list, [id]: { ...entry, name: unique } };
}
