/**
 * Galleries on the Media List: the load-time move of embedded entity and location pictures into the list, and
 * the editor's two-way bridge between a stored gallery of links and the pictures its widget edits. Synchronous:
 * files match by their encoded content, so nothing here hashes.
 */
import type { GalleryImage, GalleryLink, MediaFileEntry, MediaList, Placeholder, PortableLayered } from '@/types';
import { contentHash } from './contentHash';
import { galleryLinks, type ImageBearing } from './entityImages';
import type { LocationImageBearing } from './locationImages';
import { isRemoteImage, dataUrlMime } from './imageBytes';
import { fallbackMediaName, fileEntries, isEmbeddedImage, isMediaRef, layeredEntry, resolveGalleryImage, uniqueMediaName, type MediaFileKind } from './mediaList';
import { labelPlaceholders } from './placementLetters';
import { isEmbeddedLayered, placeLayered } from './portableLayered';

/** What makes two stored values one file: a link's URL, or embedded data's base64 payload (its MIME string aside). */
export function mediaContentKey(data: string): string {
  if (isRemoteImage(data)) return `url:${data.trim()}`;
  const comma = data.indexOf(',');
  return `data:${comma === -1 ? data : data.slice(comma + 1)}`;
}

/** The id a file's content gives it, so a world migrated twice from the same JSON gets the same ids. */
function contentId(key: string, list: MediaList): string {
  const base = `m-${contentHash(key)}`;
  let id = base;
  for (let n = 2; list[id]; n++) id = `${base}-${n}`;
  return id;
}

/** A file entering a world's list from a gallery. */
export interface GalleryFile {
  data: string;
  /** A carried entry name, taken as-is and made unique (Q31). */
  name?: string;
}

/**
 * The list with `file` in it and the id that holds it. An entry of `kind` with the same content is reused (Q14);
 * otherwise a new one joins under the carried name, else the subject fallback (Q10).
 */
export function placeGalleryFile(list: MediaList, file: GalleryFile, kind: MediaFileKind, subject: string | undefined): { list: MediaList; id: string } {
  const key = mediaContentKey(file.data);
  const held = fileEntries(list).find((entry) => entry.kind === kind && mediaContentKey(entry.data) === key);
  if (held) return { list, id: held.id };
  const id = contentId(key, list);
  const name = file.name?.trim() ? uniqueMediaName(file.name, list) : fallbackMediaName(subject, kind, list);
  const type = isRemoteImage(file.data) ? undefined : dataUrlMime(file.data);
  const entry: MediaFileEntry = { id, name, kind, data: file.data, ...(type ? { type } : {}) };
  return { list: { ...list, [id]: entry }, id };
}

/** The list with an embedded rig placed in it, Variants as gallery pictures, and the id that holds it. */
export const placeGalleryLayered = (list: MediaList, layered: PortableLayered): { list: MediaList; id: string } =>
  placeLayered(list, layered, (into, variant, layerName) => placeGalleryFile(into, variant, 'image', layerName), (into, key) => contentId(`layered:${key}`, into));

/** `links` with every embedded picture and Layered Image placed into `list` and linked by id, rules kept. */
function linkGallery(links: readonly GalleryLink[], list: MediaList, subject: string | undefined): { links: GalleryLink[]; list: MediaList } {
  let next = list;
  const out = links.map((link): GalleryLink => {
    if (isMediaRef(link)) return link;
    const placed = isEmbeddedLayered(link) ? placeGalleryLayered(next, link.layered) : placeGalleryFile(next, link, 'image', subject);
    next = placed.list;
    return { mediaId: placed.id, ...(link.requires?.length ? { requires: link.requires } : {}) };
  });
  return { links: out, list: next };
}

type Fields = Record<string, unknown>;
const isRecord = (value: unknown): value is Fields => !!value && typeof value === 'object';

/**
 * Move every entity and location gallery picture into the world's Media List (Q14), and give the world a list
 * when it has none (Q26). Runs after the gallery folds, so galleries are already canonical. Idempotent: a
 * gallery that holds only links passes through.
 */
export function migrateGalleriesToMediaList(world: Fields): void {
  const overview = isRecord(world.worldOverview) ? world.worldOverview : undefined;
  let list: MediaList = isRecord(overview?.mediaList) ? overview.mediaList as MediaList : {};
  const placeholders = Array.isArray(world.placeholders) ? world.placeholders as Placeholder[] : [];
  const subjectOf = (record: Fields) => (typeof record.name === 'string' ? labelPlaceholders(record.name, placeholders) : undefined);
  const move = (record: unknown) => {
    if (!isRecord(record) || !Array.isArray(record.images) || record.images.every(isMediaRef)) return record;
    const linked = linkGallery(galleryLinks(record as ImageBearing), list, subjectOf(record));
    list = linked.list;
    return { ...record, images: linked.links };
  };
  if (Array.isArray(world.entities)) world.entities = world.entities.map(move);
  if (Array.isArray(world.locations)) world.locations = world.locations.map(move);
  if (overview?.mediaList !== list) world.worldOverview = { ...overview, mediaList: list };
}

// ── The editor's bridge ──────────────────────────────────────────────────────

/** The world's list and the stored link behind each picture a gallery widget shows, position for position. */
export interface GalleryMedia {
  list: MediaList;
  links: GalleryLink[];
  /** The slots also take Layered Images (Q6). */
  layered?: true;
}

/** The tile a gallery widget shows for a Layered Image link. Its data names the entry, so relinking keeps each link. */
export const layeredTile = (entryId: string): string =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="288" viewBox="0 0 24 28" data-layered="${entryId.replace(/[^\w-]/g, '')}"><rect width="24" height="28" fill="#8884"/><g transform="translate(6 8) scale(.5)" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></g></svg>`)}`;

/** A gallery link's picture for the widget: an image's own, or a Layered Image's tile, with the link's rule. */
function widgetImage(link: GalleryLink, list: MediaList | undefined): GalleryImage | null {
  const layered = 'mediaId' in link ? layeredEntry(list, link.mediaId) : undefined;
  if (!layered) return resolveGalleryImage(link, list);
  return { data: layeredTile(layered.id), name: layered.name, ...(link.requires?.length ? { requires: link.requires } : {}) };
}

/** A stored gallery's pictures for the widget, with the link each came from. A link the list lacks drops. */
export function galleryView(links: readonly GalleryLink[], list: MediaList | undefined): { images: GalleryImage[]; links: GalleryLink[] } {
  const images: GalleryImage[] = [];
  const kept: GalleryLink[] = [];
  for (const link of links) {
    const image = widgetImage(link, list);
    if (!image) continue;
    images.push(image);
    kept.push(link);
  }
  return { images, links: kept };
}

/**
 * The stored gallery after the widget wrote `next`. A picture whose data a current link shows keeps that link
 * with its new rule; a new picture is placed into the list (a picked file's name, else the subject fallback).
 */
export function relinkGallery(
  current: readonly GalleryLink[], list: MediaList, next: readonly GalleryImage[], subject: string | undefined,
): { links: GalleryLink[]; list: MediaList } {
  const { images, links } = galleryView(current, list);
  const used = new Set<number>();
  let nextList = list;
  const out = next.map((image): GalleryLink => {
    const rules = image.requires?.length ? { requires: image.requires } : {};
    const at = images.findIndex((shown, i) => !used.has(i) && shown.data === image.data);
    if (at !== -1) {
      used.add(at);
      const link = links[at];
      return isMediaRef(link) ? { mediaId: link.mediaId, ...rules } : { ...link, requires: image.requires };
    }
    // A picked Layered Image arrives as its tile.
    const layered = Object.values(list).find((entry) => entry.kind === 'layered' && layeredTile(entry.id) === image.data);
    if (layered) return { mediaId: layered.id, ...rules };
    const placed = placeGalleryFile(nextList, { data: image.data, name: image.name }, 'image', subject);
    nextList = placed.list;
    return { mediaId: placed.id, ...rules };
  });
  return { links: out.map(withoutEmptyRule), list: nextList };
}

/** The tile key of the embedded Layered Image in slot `slot`. */
const embeddedTile = (slot: number): string => layeredTile(`embedded-${slot}`);

/** An embedded gallery's pictures for the widget, outside a world: an embedded Layered Image shows as its tile. */
export const embeddedGalleryView = (links: readonly GalleryLink[]): GalleryImage[] =>
  links.flatMap((link, slot): GalleryImage[] => {
    if (isEmbeddedLayered(link)) return [{ data: embeddedTile(slot), name: link.layered.name, ...(link.requires?.length ? { requires: link.requires } : {}) }];
    return isEmbeddedImage(link) ? [link] : [];
  });

/** The embedded gallery after the widget wrote `next`: a Layered Image's tile keeps that rig, with its new rule. */
export function relinkEmbeddedGallery(current: readonly GalleryLink[], next: readonly GalleryImage[]): GalleryLink[] {
  const rigs = new Map(current.flatMap((link, slot) => (isEmbeddedLayered(link) ? [[embeddedTile(slot), link.layered] as const] : [])));
  return next.map((image) => {
    const rig = rigs.get(image.data);
    return withoutEmptyRule(rig ? { layered: rig, requires: image.requires } : image);
  });
}

/** A gallery write against the world's list: the links to store and the entries to add. No list keeps them embedded (Q26). */
export function editGallery(
  current: readonly GalleryLink[], list: MediaList | undefined, next: GalleryImage[], subject: string | undefined,
): { links: GalleryLink[]; added: MediaList } {
  if (!list) return { links: next, added: {} };
  const relinked = relinkGallery(current, list, next, subject);
  return { links: relinked.links, added: addedEntries(list, relinked.list) };
}

const withoutEmptyRule = (link: GalleryLink): GalleryLink => {
  if (link.requires?.length) return link;
  const { requires: _none, ...rest } = link;
  return rest as GalleryLink;
};

/** The entries `next` adds over `before`, for a write that merges into the latest list. */
export const addedEntries = (before: MediaList, next: MediaList): MediaList =>
  Object.fromEntries(Object.entries(next).filter(([id]) => !before[id]));

// ── Byte rewrites (Optimize, WebP fix, relabel) ──────────────────────────────

/** `entry` holding `data`, its type read from the new bytes and its stale hash dropped. */
const withEntryData = (entry: MediaFileEntry, data: string): MediaFileEntry => {
  const { hash: _stale, ...rest } = entry;
  const type = dataUrlMime(data);
  return { ...rest, data, ...(type ? { type } : {}) };
};

/** The list with `rewrite` run once on each image entry's data, in order. The same list when nothing changed. */
export async function rewriteMediaImages(list: MediaList | undefined, rewrite: (data: string, entry: MediaFileEntry) => Promise<string>): Promise<MediaList | undefined> {
  if (!list) return list;
  let out = list;
  for (const entry of Object.values(list)) {
    if (entry.kind !== 'image') continue;
    const data = await rewrite(entry.data, entry);
    if (data !== entry.data) out = { ...out, [entry.id]: withEntryData(entry, data) };
  }
  return out;
}

/** The synchronous {@link rewriteMediaImages}. */
export function mapMediaImages(list: MediaList | undefined, rewrite: (data: string) => string): MediaList | undefined {
  if (!list) return list;
  let out = list;
  for (const entry of Object.values(list)) {
    if (entry.kind !== 'image') continue;
    const data = rewrite(entry.data);
    if (data !== entry.data) out = { ...out, [entry.id]: withEntryData(entry, data) };
  }
  return out;
}

/** A gallery with `rewrite` run on each embedded picture's data; links pass through. The same array when nothing changed. */
export function mapEmbeddedGallery(links: GalleryLink[], rewrite: (data: string) => string): GalleryLink[] {
  let changed = false;
  const out = links.map((link) => {
    if (!isEmbeddedImage(link)) return link;
    const data = rewrite(link.data);
    if (data === link.data) return link;
    changed = true;
    return { ...link, data };
  });
  return changed ? out : links;
}

/** A location's gallery as links, its pre-gallery background included. */
export const locationLinks = (location?: LocationImageBearing | null): GalleryLink[] =>
  galleryLinks(location && Array.isArray(location.images) ? { images: location.images } : { image: location?.backgroundImage ?? undefined });
