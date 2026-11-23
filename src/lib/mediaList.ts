/**
 * The world's Media List: named images and sounds that media fields link by id. Pure helpers for naming,
 * resolving, placing and comparing; the one async step is `mediaHash`.
 */
import type { GalleryImage, GalleryLink, LayeredMediaEntry, LayerVariant, MediaAsset, MediaLayer, MediaEntry, MediaFileEntry, MediaList, MediaRef } from '@/types';
import { randomUUID } from '@/lib/uuid';
import { blobHash } from '@/lib/blobHash';
import { dataUrlMime, dataUrlToBuffer, isRemoteImage } from '@/lib/imageBytes';

export type MediaEntryKind = MediaEntry['kind'];

/** The kinds that hold one file of their own. */
export type MediaFileKind = MediaFileEntry['kind'];

/** Whether an entry holds one file of its own, so it has data. */
export const isFileEntry = (entry: MediaEntry): entry is MediaFileEntry => entry.kind !== 'layered';

/** The list's entries that hold a file, for readers of bytes. */
export const fileEntries = (list: MediaList | undefined): MediaFileEntry[] => Object.values(list ?? {}).filter(isFileEntry);

/** A slot's own fields that travel with its picture: the Visibility rule and the Weather Mask. Empty ones drop. */
export const slotFields = (link: Pick<GalleryImage, 'requires' | 'weatherMask'>): Pick<GalleryImage, 'requires' | 'weatherMask'> => ({
  ...(link.requires?.length ? { requires: link.requires } : {}),
  ...(link.weatherMask ? { weatherMask: link.weatherMask } : {}),
});

/** Whether a gallery slot embeds one image's data, not a link or an embedded Layered Image. */
export const isEmbeddedImage = (link: GalleryLink): link is GalleryImage => 'data' in link;

/** Whether a stored value links a Media Entry. */
export const isMediaRef = (value: unknown): value is MediaRef =>
  !!value && typeof value === 'object' && typeof (value as Partial<MediaRef>).mediaId === 'string';

// ── Names ────────────────────────────────────────────────────────────────────

/** How names compare for uniqueness: trimmed, case-insensitive (Q5). */
export const mediaNameKey = (name: string): string => name.trim().toLowerCase();

const takenKeys = (list: MediaList | undefined, exceptId?: string): Set<string> =>
  new Set(Object.values(list ?? {}).filter((entry) => entry.id !== exceptId).map((entry) => mediaNameKey(entry.name)));

/** A file's name without its extension (Q9), or '' when it has none. */
export const mediaNameFromFile = (fileName: string | undefined): string =>
  (fileName ?? '').trim().replace(/\.[^./\\]+$/, '').trim();

/** File extensions a media file name sheds; any other dot is part of the name ("v1.5 sketch"). */
const MEDIA_EXTENSION = /\.(mp3|ogg|oga|opus|wav|m4a|aac|flac|weba|webm|mp4|png|webp|jpe?g|gif|avif|bmp|svg)$/i;

/** A stored file name without a recognized media extension (Q43), or '' when it has none. */
export const mediaNameFromAsset = (fileName: string | undefined): string =>
  (fileName ?? '').trim().replace(MEDIA_EXTENSION, '').trim();

/** A link's last path segment, decoded, as the file name a pasted URL carries; '' when it has none. */
export function urlFileName(url: string): string {
  try {
    const segment = new URL(url.trim()).pathname.split('/').filter(Boolean).pop() ?? '';
    return decodeURIComponent(segment);
  } catch {
    return '';
  }
}

/** `name`, or `name (2)`, `name (3)`… when the list already holds it (Q5). */
export function uniqueMediaName(name: string, list: MediaList | undefined, exceptId?: string): string {
  const base = name.trim();
  const taken = takenKeys(list, exceptId);
  if (!taken.has(mediaNameKey(base))) return base;
  let n = 2;
  while (taken.has(mediaNameKey(`${base} (${n})`))) n++;
  return `${base} (${n})`;
}

/** Copy that names an entry's kind. */
export const MEDIA_KIND_WORDS: Record<MediaEntryKind, { one: string; many: string }> = {
  image: { one: 'Image', many: 'Images' },
  sound: { one: 'Sound', many: 'Sounds' },
  layered: { one: 'Layered Image', many: 'Layered Images' },
  mask: { one: 'Mask', many: 'Masks' },
};

/** The subject's name plus the next free number, starting at 1 (Q10). A blank subject reads as the kind. */
export function fallbackMediaName(subject: string | undefined, kind: MediaEntryKind, list: MediaList | undefined): string {
  const base = subject?.trim() || MEDIA_KIND_WORDS[kind].one;
  const taken = takenKeys(list);
  let n = 1;
  while (taken.has(mediaNameKey(`${base} ${n}`))) n++;
  return `${base} ${n}`;
}

/** A new entry's name: the file's name, else the subject fallback, made unique in `list`. */
export const newMediaName = (fileName: string | undefined, subject: string | undefined, kind: MediaEntryKind, list: MediaList | undefined): string =>
  uniqueMediaName(mediaNameFromFile(fileName) || fallbackMediaName(subject, kind, list), list);

// ── Hash ─────────────────────────────────────────────────────────────────────

/** The content hash of embedded data, with the Avatar store's hasher. A linked (http) value has none. */
export async function mediaHash(data: string): Promise<string | undefined> {
  if (!data || isRemoteImage(data)) return undefined;
  return blobHash(new Blob([await dataUrlToBuffer(data)]));
}

/** Data value → content hash, built ahead of the sync steps below. */
export type MediaHashes = ReadonlyMap<string, string>;

/** The hashes of every embedded value in `values`, for placement and comparison. */
export async function mediaHashes(values: Iterable<string>): Promise<Map<string, string>> {
  const unique = [...new Set(values)].filter((value) => value && !isRemoteImage(value));
  const hashes = await Promise.all(unique.map(mediaHash));
  return new Map(unique.flatMap((value, i) => (hashes[i] ? [[value, hashes[i]] as [string, string]] : [])));
}

// ── Resolver ─────────────────────────────────────────────────────────────────

/** The entry `id` names, when it is of `kind` (any kind when unset). */
export function mediaEntry(list: MediaList | undefined, id: string, kind?: MediaFileKind): MediaFileEntry | undefined {
  const entry = list?.[id];
  return entry && isFileEntry(entry) && entry.data && (!kind || entry.kind === kind) ? entry : undefined;
}

/** The Layered Image `id` names, or undefined. */
export function layeredEntry(list: MediaList | undefined, id: string): LayeredMediaEntry | undefined {
  const entry = list?.[id];
  return entry?.kind === 'layered' ? entry : undefined;
}

/** The Variant of `layer` that `mediaId` names while the Layer still holds it and it names an image (Q32). */
export const heldVariant = (layer: MediaLayer, list: MediaList | undefined, mediaId: string): LayerVariant | undefined =>
  layer.variants.find((variant) => variant.mediaId === mediaId && mediaEntry(list, variant.mediaId, 'image'));

/** A single media field's value: a link, an embedded file, or embedded data. */
export type MediaValue = MediaRef | MediaAsset | string | null | undefined;

/**
 * The one resolver: a link or an embedded value in, the displayable file out. An id with no entry, or an
 * entry of another kind, resolves to nothing.
 */
export function resolveMedia(value: MediaValue, list: MediaList | undefined, kind?: MediaFileKind): MediaAsset | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return { data: value, type: dataUrlMime(value) };
  if (isMediaRef(value)) {
    const entry = mediaEntry(list, value.mediaId, kind);
    return entry ? { data: entry.data, type: entry.type ?? dataUrlMime(entry.data), name: entry.name } : undefined;
  }
  return value.data ? value : undefined;
}

/** A gallery link as an embedded picture, its rule and Weather Mask kept; an entry's name rides along. Missing id, or a Layered
 *  Image in either form, = null. */
export function resolveGalleryImage(link: GalleryLink, list: MediaList | undefined): GalleryImage | null {
  const fields = slotFields(link);
  if ('layered' in link) return null;
  if (!('mediaId' in link)) return link.data ? { data: link.data, ...(link.name ? { name: link.name } : {}), ...fields } : null;
  const entry = mediaEntry(list, link.mediaId, 'image');
  return entry ? { data: entry.data, name: entry.name, ...fields } : null;
}

/** A gallery link's displayable data, or undefined for a missing id. */
export const galleryLinkData = (link: GalleryLink, list: MediaList | undefined): string | undefined =>
  resolveGalleryImage(link, list)?.data;

// ── Placement (into a world) ─────────────────────────────────────────────────

/** A file entering a world: its data, MIME type and original name. */
export type PlacedFile = Pick<MediaAsset, 'data'> & Partial<Pick<MediaAsset, 'type' | 'name'>> & {
  /** An entry name carried from outside a world, taken as-is (no extension drop) and made unique. */
  entryName?: string;
};

export interface PlaceOptions {
  kind: MediaFileKind;
  /** Whose media this is, for the Q10 name when the file has none. */
  subject?: string;
  /** Hashes of embedded data, from `mediaHashes`. */
  hashes: MediaHashes;
}

/**
 * The list with `file` in it, and the id that holds it (Q14, Q18). An entry of the same kind with the same
 * content hash, or the same URL for a link, is reused; otherwise a new entry joins under a unique name.
 * Embedded data missing from `hashes` throws, since it could not be matched.
 */
export function placeMedia(list: MediaList | undefined, file: PlacedFile, { kind, subject, hashes }: PlaceOptions): { list: MediaList; id: string } {
  const linked = isRemoteImage(file.data);
  const hash = linked ? undefined : hashes.get(file.data);
  if (!linked && !hash) throw new Error('placeMedia: embedded data has no hash in `hashes`');
  const held = fileEntries(list).find((entry) => entry.kind === kind
    && (linked ? entry.data === file.data : !!hash && (entry.hash ?? hashes.get(entry.data)) === hash));
  if (held) return { list: list ?? {}, id: held.id };
  const id = randomUUID();
  const entry: MediaFileEntry = {
    id, name: file.entryName?.trim() ? uniqueMediaName(file.entryName, list) : newMediaName(file.name, subject, kind, list), kind, data: file.data,
    ...(file.type ? { type: file.type } : {}),
    ...(hash ? { hash } : {}),
  };
  return { list: { ...list, [id]: entry }, id };
}

// ── Resolution (out of a world) ──────────────────────────────────────────────

/** A gallery with every link turned back into an embedded picture named as its entry (Q18). Missing ids drop. */
export const embedGallery = (links: readonly GalleryLink[], list: MediaList | undefined): GalleryImage[] =>
  links.flatMap((link) => resolveGalleryImage(link, list) ?? []);

// ── Comparison ───────────────────────────────────────────────────────────────

/**
 * A media value as a comparable token, the way Avatar picks compare (`lib/vrmPickMatch`). Embedded data and
 * an entry compare by content hash, so the same file reads equal in either form; a link compares by URL. A
 * missing id is undefined. Data with no known hash matches only the same string.
 */
export function mediaToken(value: MediaValue | GalleryLink, list: MediaList | undefined, hashes: MediaHashes): string | undefined {
  let data: string | undefined;
  let hash: string | undefined;
  if (typeof value === 'string') data = value;
  else if (value && 'mediaId' in value) {
    const entry = mediaEntry(list, value.mediaId);
    data = entry?.data;
    hash = entry?.hash;
  } else if (value && 'data' in value) data = value.data;
  if (!data) return undefined;
  if (isRemoteImage(data)) return `url:${data}`;
  hash ??= hashes.get(data);
  return hash ? `media:${hash}` : `data:${data}`;
}

/** Every embedded value a token needs hashed: the given values and the list's entries without a hash. */
export function unhashedData(values: Iterable<MediaValue | GalleryLink>, list: MediaList | undefined): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (typeof value === 'string') out.push(value);
    else if (value && 'layered' in value) out.push(...value.layered.layers.flatMap((layer) => layer.variants.map((v) => v.data)));
    else if (value && 'data' in value && value.data) out.push(value.data);
  }
  for (const entry of fileEntries(list)) if (!entry.hash) out.push(entry.data);
  return out;
}
