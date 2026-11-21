/**
 * Sounds on the Media List: entity sounds, location ambience and world music. The load-time move of embedded
 * sounds into the list, the one read every player goes through, and the editor's write of a sound slot.
 */
import type { MediaAsset, MediaList, MediaRef, Placeholder } from '@/types';
import { placeGalleryFile } from './mediaGallery';
import { isFileEntry, isMediaRef, mediaNameFromAsset, resolveMedia, type MediaValue } from './mediaList';
import { labelPlaceholders } from './placementLetters';

/** World music's subject for the Q10 fallback name (Q43): `Music 1`. */
export const MUSIC_SUBJECT = 'Music';

/** A stored sound field: a link, an embedded file, or (world music) embedded data. */
export type SoundValue = MediaRef | MediaAsset | string | null | undefined;

/** World music as the overview stores it: a link, or bare data for an embedded file. */
export const storedMusic = (next: MediaRef | Pick<MediaAsset, 'data'> | null | undefined): MediaRef | string | null =>
  (next ? (isMediaRef(next) ? next : next.data) : null);

/** The playable file a sound field holds. A link the list lacks, or one to an image, reads as no sound. */
export const resolveSound = (value: SoundValue, list: MediaList | undefined): MediaAsset | undefined =>
  resolveMedia(value as MediaValue, list, 'sound');

/** The list with an embedded sound in it and the link to store. Its MIME type is kept (Q24); its file name, minus a media extension, names a new entry (Q43). */
export function placeSound(list: MediaList, file: Pick<MediaAsset, 'data'> & Partial<MediaAsset>, subject: string | undefined): { list: MediaList; link: MediaRef } {
  const placed = placeGalleryFile(list, { data: file.data, name: mediaNameFromAsset(file.name) }, 'sound', subject);
  const entry = placed.list[placed.id];
  const added = placed.list !== list && file.type && isFileEntry(entry) && entry.type !== file.type
    ? { ...placed.list, [placed.id]: { ...entry, type: file.type } }
    : placed.list;
  return { list: added, link: { mediaId: placed.id } };
}

type Fields = Record<string, unknown>;
const isRecord = (value: unknown): value is Fields => !!value && typeof value === 'object';

/** A stored sound as a file to place, or undefined when it holds nothing to move. */
function embeddedSound(value: unknown): (Pick<MediaAsset, 'data'> & Partial<MediaAsset>) | undefined {
  if (typeof value === 'string') return value ? { data: value } : undefined;
  if (!isRecord(value) || isMediaRef(value) || typeof value.data !== 'string' || !value.data) return undefined;
  return value as Pick<MediaAsset, 'data'> & Partial<MediaAsset>;
}

/**
 * Move every entity sound, location ambience and the world music into the world's Media List, merging
 * identical files (Q14). Runs after the gallery step, which gives every world a list. Idempotent: a link
 * passes through.
 */
export function migrateSoundsToMediaList(world: Fields): void {
  const overview = isRecord(world.worldOverview) ? world.worldOverview : undefined;
  if (!overview) return;
  const start: MediaList = isRecord(overview.mediaList) ? overview.mediaList as MediaList : {};
  let list = start;
  const placeholders = Array.isArray(world.placeholders) ? world.placeholders as Placeholder[] : [];
  const subjectOf = (record: Fields) => (typeof record.name === 'string' ? labelPlaceholders(record.name, placeholders) : undefined);
  const moveField = (record: unknown, field: string) => {
    if (!isRecord(record) || !(field in record) || isMediaRef(record[field])) return record;
    const file = embeddedSound(record[field]);
    if (!file) return record;
    const placed = placeSound(list, file, subjectOf(record));
    list = placed.list;
    return { ...record, [field]: placed.link };
  };
  if (Array.isArray(world.entities)) world.entities = world.entities.map((e) => moveField(e, 'sound'));
  if (Array.isArray(world.locations)) world.locations = world.locations.map((l) => moveField(l, 'ambientSound'));
  let nextOverview: Fields = overview;
  const music = embeddedSound(overview.bgm);
  if (music) {
    const placed = placeSound(list, music, MUSIC_SUBJECT);
    list = placed.list;
    nextOverview = { ...overview, bgm: placed.link };
  }
  if (list !== start || nextOverview !== overview) world.worldOverview = { ...nextOverview, mediaList: list };
}
