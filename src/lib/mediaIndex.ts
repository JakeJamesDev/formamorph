/**
 * Every media item a world holds, with its stored size, and the sections the Media tab lays them out in.
 * DOM-free: sizes come from string lengths, so nothing decodes to list.
 */
import type { Body, Entity, GalleryImage, GalleryLink, GameLocation, MediaList, TraitRequirementRow, World } from '@/types';
import { bodyLabel } from './bodies';
import { entityImages, galleryLinks } from './entityImages';
import { galleryView, locationLinks } from './mediaGallery';
import { coverData } from './mediaImages';
import { locationImages } from './locationImages';
import { mapImages } from './mapBackground';
import { buildEntityTree, type EntityTreeNode } from './entityGroupTree';
import { buildLocationTree, type LocationTreeNode } from './locationTree';
import type { ImageCap } from './imageSlots';
import type { ThumbAspect } from './thumbAspect';
import { mediaParentSpec } from './mediaParents';
import { dataUrlBytes, isRemoteImage } from './imageBytes';
import { galleryLinkData, isFileEntry, isMediaRef } from './mediaList';
import { resolveSound, type SoundValue } from './mediaSounds';
import type { MediaUse } from './mediaUsage';
import { IMAGE_CAPS } from './imageSlots';

export type MediaKind = 'image' | 'sound' | 'model' | 'avatar' | 'layered';
export type MediaParentKind = 'world' | 'map' | 'entity' | 'location' | 'dictionary' | 'body' | 'item';

/** What holds a media item. Its name is what copy calls it; world media has the world as its parent. */
export interface MediaParent {
  kind: MediaParentKind;
  id: string;
  name: string;
}

/** A slot inside its parent: a field, a gallery position, or an Avatar's store id. */
export type MediaSlotKey =
  | 'thumbnail' | 'bgm' | 'sound' | 'model' | 'ambientSound' | 'backdrop' | `image:${number}` | `avatar:${string}` | `entry:${string}`;

export interface MediaItem {
  /** Stable for the item's slot: parent and slot key. */
  id: string;
  key: MediaSlotKey;
  kind: MediaKind;
  parent: MediaParent;
  /** What the slot is called in copy: "Image 2", "Ambient Sound", or an Avatar's name. */
  slot: string;
  /** The stored value: a data URL, or a link for a linked image. */
  value: string;
  /** UTF-8 bytes of the stored value, the measure the publish limit uses. */
  bytes: number;
  linked: boolean;
  /** Images only. */
  budget?: ImageCap;
  overBudget: boolean;
  /** A gallery image's Visibility rule rows. */
  rules?: TraitRequirementRow[];
  galleryIndex?: number;
  /** Avatars only: the entities that pick it. */
  users?: MediaParent[];
  /** The uploaded file's name, on a field that keeps one. */
  fileName?: string;
  /** The Media List entry a gallery picture or a sound field links. */
  mediaId?: string;
  /** An empty image slot, reported only by `blankSections`. It holds no bytes and the id the filled slot will have. */
  blank?: true;
  /** A Media List entry's card (`mediaEntryItems`): every place that links it, in world order. */
  uses?: MediaUse[];
  /** An entry nothing links (Q7). */
  unused?: true;
}

export type MediaWorld = Pick<World, 'worldOverview' | 'entities' | 'locations' | 'dictionaries'> & Pick<Partial<World>, 'entityGroups' | 'bodies' | 'items'>;

const WORLD_PARENT: MediaParent = { kind: 'world', id: 'world', name: 'World' };
/** The Map Background's gallery, which cards name like an entity's. */
export const MAP_PARENT: MediaParent = { kind: 'map', id: 'map', name: 'Map Background' };

/** UTF-8 length without an encode: a data URL is ASCII, so only a link can hold wider characters. */
export function storedBytes(value: string): number {
  let bytes = value.length;
  if (value.startsWith('data:')) return bytes;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) continue;
    if (code < 0x800) bytes += 1;
    else if (code >= 0xd800 && code <= 0xdbff) { bytes += 2; i++; }
    else bytes += 2;
  }
  return bytes;
}

/** One key per parent, the prefix of every item id it holds. */
export const mediaParentKey = (parent: MediaParent): string => `${parent.kind}:${parent.id}`;

const itemId = (parent: MediaParent, key: MediaSlotKey) => `${mediaParentKey(parent)}:${key}`;

/** The parent key of a gallery image's item id, or undefined for any other id. */
export const galleryParentKeyOf = (id: string): string | undefined => /^(.+):image:\d+$/.exec(id)?.[1];

/** Of two budgets, the one with the longer edge; `held` wins a tie. */
export const largerCap = (held: ImageCap | undefined, cap: ImageCap): ImageCap => (!held || cap.maxDim > held.maxDim ? cap : held);

function image(parent: MediaParent, key: MediaSlotKey, slot: string, value: string, budget: ImageCap, extra: Partial<MediaItem> = {}): MediaItem {
  const linked = isRemoteImage(value);
  return {
    id: itemId(parent, key), key, kind: 'image', parent, slot, value,
    bytes: storedBytes(value), linked, budget,
    // The budget measures decoded image bytes, which a link has none of.
    overBudget: !linked && dataUrlBytes(value) > budget.maxBytes,
    ...extra,
  };
}

const file = (parent: MediaParent, kind: MediaKind, key: MediaSlotKey, slot: string, value: string, fileName?: string): MediaItem => ({
  id: itemId(parent, key), key, kind, parent, slot, value, bytes: storedBytes(value), linked: false, overBudget: false,
  ...(fileName ? { fileName } : {}),
});

/** A sound field's item, resolved through the list; a link the list lacks gives none. */
function soundItem(parent: MediaParent, key: MediaSlotKey, slot: string, value: SoundValue, media: MediaList | undefined): MediaItem | undefined {
  const sound = resolveSound(value, media);
  if (!sound?.data) return undefined;
  return {
    ...file(parent, 'sound', key, slot, sound.data, sound.name),
    linked: isRemoteImage(sound.data),
    ...(isMediaRef(value) ? { mediaId: value.mediaId } : {}),
  };
}

/** The size budget of a parent's images. */
const capOf = (parent: MediaParent): ImageCap => mediaParentSpec(parent.kind).cap;

const entityParent = (e: Entity): MediaParent => ({ kind: 'entity', id: e.id, name: e.name });
const locationParent = (l: GameLocation): MediaParent => ({ kind: 'location', id: l.id, name: l.name });

/** One gallery's images, each with its position, rule and the entry it links. */
const galleryMedia = (parent: MediaParent, images: readonly GalleryImage[], links?: readonly GalleryLink[]): MediaItem[] =>
  images.map((img, i) => {
    const link = links?.[i];
    return image(parent, `image:${i}`, `Image ${i + 1}`, img.data, capOf(parent), {
      galleryIndex: i, ...(img.requires?.length ? { rules: img.requires } : {}), ...(link && isMediaRef(link) ? { mediaId: link.mediaId } : {}),
    });
  });

/** A stored gallery's items, links resolved through `media`. A Layered Image link is a file-less `layered` item. */
const linkedGalleryMedia = (parent: MediaParent, links: GalleryLink[], media: MediaList | undefined): MediaItem[] => {
  const view = galleryView(links, media);
  return galleryMedia(parent, view.images, view.links).map((item) => {
    if (!item.mediaId || media?.[item.mediaId]?.kind !== 'layered') return item;
    const { budget: _none, ...rest } = item;
    return { ...rest, kind: 'layered', value: '', bytes: 0, overBudget: false };
  });
};

/** One entity's media: its gallery, then its sound, then its 3D Model. */
function entityMedia(e: Entity, media: MediaList | undefined): MediaItem[] {
  const parent = entityParent(e);
  const items = linkedGalleryMedia(parent, galleryLinks(e), media);
  const sound = soundItem(parent, 'sound', 'Sound', e.sound, media);
  if (sound) items.push(sound);
  if (e.model?.data) items.push(file(parent, 'model', 'model', '3D Model', e.model.data, e.model.name));
  return items;
}

/** One location's media: its gallery, then its ambient sound. */
function locationMedia(l: GameLocation, media: MediaList | undefined): MediaItem[] {
  const parent = locationParent(l);
  const items = linkedGalleryMedia(parent, locationLinks(l), media);
  const sound = soundItem(parent, 'ambientSound', 'Ambient Sound', l.ambientSound, media);
  if (sound) items.push(sound);
  return items;
}

const blankImage = (parent: MediaParent, key: MediaSlotKey, slot: string): MediaItem => ({
  id: itemId(parent, key), key, kind: 'image', parent, slot, value: '', bytes: 0, linked: false, budget: capOf(parent), overBudget: false, blank: true,
});

/** What each parent kind contributes to the sections: its media, or its empty image slots. */
interface MediaSource {
  world: (w: MediaWorld) => MediaItem[];
  avatars: (w: MediaWorld) => MediaItem[];
  map: (w: MediaWorld) => MediaItem[];
  entity: (e: Entity, media: MediaList | undefined) => MediaItem[];
  location: (l: GameLocation, media: MediaList | undefined) => MediaItem[];
  dictionaries: (w: MediaWorld) => MediaItem[];
  bodies: (w: MediaWorld) => MediaItem[];
}

const BLANK_SOURCE: MediaSource = {
  world: (w) => (coverData(w.worldOverview) ? [] : [blankImage(WORLD_PARENT, 'thumbnail', 'Thumbnail')]),
  avatars: () => [],
  map: (w) => (mapImages(w.worldOverview).length ? [] : [blankImage(MAP_PARENT, 'image:0', 'Image 1')]),
  entity: (e, media) => (entityImages(e, media).length ? [] : [blankImage(entityParent(e), 'image:0', 'Image 1')]),
  location: (l, media) => (locationImages(l, media).length ? [] : [blankImage(locationParent(l), 'image:0', 'Image 1')]),
  // A dictionary's Cover Image is optional, so an empty one is not a gap.
  dictionaries: () => [],
  // A Body's Custom Image is optional too.
  bodies: () => [],
};

function worldMedia(w: MediaWorld): MediaItem[] {
  const o = w.worldOverview;
  const items: MediaItem[] = [];
  const cover = coverData(o);
  if (cover) items.push(image(WORLD_PARENT, 'thumbnail', 'Thumbnail', cover, capOf(WORLD_PARENT), isMediaRef(o.thumbnail) ? { mediaId: o.thumbnail.mediaId } : {}));
  const music = soundItem(WORLD_PARENT, 'bgm', 'Background Music', o.bgm, o.mediaList);
  if (music) items.push(music);
  return items;
}

/** A world Avatar's card id. */
export const avatarItemId = (id: string): string => itemId(WORLD_PARENT, `avatar:${id}`);

function avatarMedia(w: MediaWorld): MediaItem[] {
  return Object.entries(w.worldOverview.vrmStore ?? {}).filter(([, vrm]) => vrm.file?.data).map(([id, vrm]) => ({
    ...file(WORLD_PARENT, 'avatar', `avatar:${id}`, vrm.name, vrm.file.data, vrm.file.name),
    users: w.entities.filter((e) => e.vrmPick?.kind === 'world' && e.vrmPick.id === id).map(entityParent),
  }));
}

function dictionaryMedia(w: MediaWorld): MediaItem[] {
  return w.dictionaries.flatMap((d) => {
    const parent: MediaParent = { kind: 'dictionary', id: d.id, name: d.name };
    return d.thumbnail ? [image(parent, 'thumbnail', 'Cover Image', d.thumbnail, capOf(parent))] : [];
  });
}

/** The Bodies whose Backdrop is a Custom Image, each as one Backdrop image. */
function bodyMedia(w: MediaWorld): MediaItem[] {
  return (w.bodies ?? []).flatMap((b: Body) => {
    const backdrop = b.backdrop;
    const link = backdrop.kind === 'image' ? backdrop.image : undefined;
    const data = link ? galleryLinkData(link, w.worldOverview.mediaList) : undefined;
    if (!link || !data) return [];
    const parent: MediaParent = { kind: 'body', id: b.id, name: bodyLabel(b) };
    return [image(parent, 'backdrop', 'Backdrop', data, capOf(parent), isMediaRef(link) ? { mediaId: link.mediaId } : {})];
  });
}

/** One section of the gallery: a group-like folder and the items that fold into it. */
export interface MediaSection {
  id: string;
  /** The folder names from the top, joined with " › " in copy. */
  path: string[];
  items: MediaItem[];
}

const sectionBuilder = () => {
  const sections: MediaSection[] = [];
  return {
    sections,
    add: (id: string, path: string[], items: MediaItem[]) => { if (items.length) sections.push({ id, path, items }); },
  };
};

/**
 * The world's media in sections, in author order. A section is a folder: World, its Avatars and Map Background, Entities and each
 * entity group, Locations and each location with children, and Dictionaries. An entity's or location's items
 * fold into the nearest section, and a section with no items is left out.
 */
export const mediaSections = (w: MediaWorld): MediaSection[] => sectionsFrom(w, MEDIA_SOURCE);

/** The same sections holding only blank cards: each entity and location with no image, an empty world thumbnail and an empty Map Background. */
export const blankSections = (w: MediaWorld): MediaSection[] => sectionsFrom(w, BLANK_SOURCE);

function sectionsFrom(w: MediaWorld, source: MediaSource): MediaSection[] {
  const { sections, add } = sectionBuilder();
  const media = w.worldOverview.mediaList;
  add('world', ['World'], source.world(w));
  add('avatars', ['World', 'Avatars'], source.avatars(w));
  add('mapBackground', ['World', 'Map Background'], source.map(w));

  const entityFolder = (id: string, path: string[], nodes: EntityTreeNode[]) => {
    const leaves = nodes.flatMap((n) => (n.kind === 'leaf' ? [n.leaf] : []));
    add(id, path, leaves.flatMap((e) => source.entity(e, media)));
    for (const n of nodes) if (n.kind === 'group') entityFolder(`group:${n.id}`, [...path, n.group.name], n.children);
  };
  entityFolder('entities', ['Entities'], buildEntityTree(w.entityGroups ?? [], w.entities));

  // A location with children is a folder of its own, holding its own media and its leaf children's.
  const locationFolder = (id: string, path: string[], own: MediaItem[], nodes: LocationTreeNode[]) => {
    add(id, path, [...own, ...nodes.filter((n) => !n.children.length).flatMap((n) => source.location(n.location, media))]);
    for (const n of nodes) {
      if (n.children.length) locationFolder(`location:${n.id}`, [...path, n.location.name], source.location(n.location, media), n.children);
    }
  };
  locationFolder('locations', ['Locations'], [], buildLocationTree(w.locations));

  add('dictionaries', ['Dictionaries'], source.dictionaries(w));
  add('bodies', ['Bodies'], source.bodies(w));
  return sections;
}

const MEDIA_SOURCE: MediaSource = {
  world: worldMedia, avatars: avatarMedia, map: (w) => linkedGalleryMedia(MAP_PARENT, galleryLinks({ images: w.worldOverview.mapBackground?.images }), w.worldOverview.mediaList), entity: entityMedia, location: locationMedia, dictionaries: dictionaryMedia, bodies: bodyMedia,
};

/** The selection id of a section's header, apart from any item's. */
export const sectionSelection = (id: string): string => `section:${id}`;

/** A section's folder path as copy shows it: "Entities › Crew". */
export const sectionTitle = (section: MediaSection): string => section.path.join(' › ');

/** World media goes by its slot ("Thumbnail", an Avatar's name); everything else by its parent's name. */
export const namedBySlot = (item: MediaItem): boolean => item.parent.kind === 'world';

/** A card's frame: character art for Avatars, entity media and entries an entity or nothing uses; scene art for the rest. */
export const mediaAspect = (item: MediaItem): ThumbAspect =>
  item.kind === 'avatar' || item.parent.kind === 'entity' || (item.uses && (!item.uses.length || item.uses.some((u) => u.owner.kind === 'entity')))
    ? 'portrait' : 'landscape';

/** Every media item in the world, in section order. Each Avatar appears once. */
export const buildMediaIndex = (w: MediaWorld): MediaItem[] => mediaSections(w).flatMap((s) => s.items);

export type ImageSlot = { url: string; cap: ImageCap; path: string };

/** Every image item in a world with its budget: the gallery's list, then item galleries, which have no card. */
export function worldImageItems(w: Partial<MediaWorld>): (MediaItem & { budget: ImageCap })[] {
  const index = buildMediaIndex({
    worldOverview: w.worldOverview ?? ({} as MediaWorld['worldOverview']),
    entities: w.entities ?? [],
    locations: w.locations ?? [],
    dictionaries: w.dictionaries ?? [],
    entityGroups: w.entityGroups,
    bodies: w.bodies,
  });
  const itemImages = (w.items ?? []).flatMap((item) => linkedGalleryMedia({ kind: 'item', id: item.id, name: item.name }, galleryLinks(item), w.worldOverview?.mediaList));
  return [...index, ...itemImages].filter((i): i is MediaItem & { budget: ImageCap } => i.kind === 'image' && !!i.budget);
}

/** Every image in a world as a scan slot: its data, budget and item id. */
export const worldImageSlots = (w: Partial<MediaWorld>): ImageSlot[] =>
  worldImageItems(w).map((i) => ({ url: i.value, cap: i.budget, path: i.id }));

/** The budget an image entry nothing links is measured and optimized against: the largest non-map cap (Q48). */
export const UNUSED_IMAGE_CAP: ImageCap = IMAGE_CAPS.background;

/** What Optimize Images walks: every embedded image slot, and each image entry once at its largest use's budget, Unused ones at `UNUSED_IMAGE_CAP`. */
export function worldOptimizeTargets(w: Partial<MediaWorld>): { slots: (MediaItem & { budget: ImageCap })[]; entries: { id: string; data: string; budget: ImageCap }[] } {
  const items = worldImageItems(w);
  const budgets = new Map<string, ImageCap>();
  for (const item of items) {
    if (!item.mediaId) continue;
    budgets.set(item.mediaId, largerCap(budgets.get(item.mediaId), item.budget));
  }
  const list = w.worldOverview?.mediaList ?? {};
  for (const entry of Object.values(list)) if (entry.kind === 'image' && !budgets.has(entry.id)) budgets.set(entry.id, UNUSED_IMAGE_CAP);
  return {
    slots: items.filter((item) => !item.mediaId),
    entries: [...budgets].flatMap(([id, budget]) => {
      const entry = list[id];
      return entry && isFileEntry(entry) ? [{ id, data: entry.data, budget }] : [];
    }),
  };
}

/** How many image-bearing slots a world has — the `total` of an optimize run's progress. */
export const countWorldImages = (w: Partial<MediaWorld>): number => {
  const { slots, entries } = worldOptimizeTargets(w);
  return slots.length + entries.length;
};

/** The section ids that hold Avatars: by parent, and by type. */
const AVATAR_SECTION_IDS: readonly string[] = ['avatars', 'type:avatar'];

/** Whether a section is the Avatars section, which carries the Avatar controls. */
export const isAvatarSection = (section: Pick<MediaSection, 'id'>): boolean => AVATAR_SECTION_IDS.includes(section.id);

/**
 * The sections with an Avatars section in them even when no Avatar exists, so the first one has a way in:
 * after World when grouping by parent, last when grouping by type.
 */
export function withAvatarsSection(sections: readonly MediaSection[], grouping: MediaGrouping): MediaSection[] {
  if (sections.some(isAvatarSection)) return [...sections];
  if (grouping === 'type') return [...sections, { id: 'type:avatar', path: [MEDIA_KIND_LABELS.avatar.many], items: [] }];
  const at = sections[0]?.id === 'world' ? 1 : 0;
  return [...sections.slice(0, at), { id: 'avatars', path: ['World', 'Avatars'], items: [] }, ...sections.slice(at)];
}

/** Whether the gallery holds a selection: a card's id or a section header's. The Avatars header always stands. */
export function mediaHolds(w: MediaWorld, id: string): boolean {
  return AVATAR_SECTION_IDS.some((s) => sectionSelection(s) === id)
    || sectionSelection(UNUSED_SECTION_ID) === id
    || (id.startsWith(ENTRY_ITEM_PREFIX) && !!w.worldOverview.mediaList?.[id.slice(ENTRY_ITEM_PREFIX.length)])
    || mediaSections(w).some((s) => sectionSelection(s.id) === id || s.items.some((i) => i.id === id));
}

export const totalBytes = (items: readonly MediaItem[]): number => items.reduce((n, i) => n + i.bytes, 0);

const MEDIA_KINDS: readonly MediaKind[] = ['image', 'layered', 'sound', 'model', 'avatar'];

export const MEDIA_KIND_LABELS: Record<MediaKind, { one: string; many: string }> = {
  image: { one: 'Image', many: 'Images' },
  sound: { one: 'Sound', many: 'Sounds' },
  model: { one: '3D Model', many: '3D Models' },
  avatar: { one: 'Avatar', many: 'Avatars' },
  layered: { one: 'Layered Image', many: 'Layered Images' },
};

/** Count and bytes per kind, in kind order, kinds with no items left out. */
export function kindBreakdown(items: readonly MediaItem[]): { kind: MediaKind; count: number; bytes: number }[] {
  return MEDIA_KINDS.map((kind) => {
    const list = items.filter((i) => i.kind === kind);
    return { kind, count: list.length, bytes: totalBytes(list) };
  }).filter((r) => r.count > 0);
}

/** The heaviest items first. */
export const largestItems = (items: readonly MediaItem[], count: number): MediaItem[] =>
  [...items].sort((a, b) => b.bytes - a.bytes).slice(0, count);

/** Only a gallery's images stack (an entity's, a location's, the Map Background's); every other item is its own card. */
export const canStack = (item: MediaItem): boolean => item.kind === 'image' && mediaParentSpec(item.parent.kind).stacks;

/** A section's cards: one parent's images stack when there are two or more, and every other item is its own card. */
export interface MediaCardGroup {
  item: MediaItem;
  /** The parent's images, on the card that leads them. */
  images?: MediaItem[];
}

export function sectionCards(items: readonly MediaItem[]): MediaCardGroup[] {
  const cards: MediaCardGroup[] = [];
  const stacks = new Map<string, MediaItem[]>();
  for (const item of items) {
    if (!canStack(item)) { cards.push({ item }); continue; }
    const key = mediaParentKey(item.parent);
    const images = stacks.get(key);
    if (images) { images.push(item); continue; }
    const fresh = [item];
    stacks.set(key, fresh);
    cards.push({ item, images: fresh });
  }
  return cards;
}

export type MediaGrouping = 'parent' | 'type';

/** The same items in one section per kind (Images, Sounds, 3D Models, Avatars), in author order; empty kinds are left out. */
export function typeSections(sections: readonly MediaSection[]): MediaSection[] {
  const items = sections.flatMap((s) => s.items);
  return MEDIA_KINDS.flatMap((kind) => {
    const list = items.filter((i) => i.kind === kind);
    return list.length ? [{ id: `type:${kind}`, path: [MEDIA_KIND_LABELS[kind].many], items: list }] : [];
  });
}

/** An entry card's item id prefix; the entry id follows. */
export const ENTRY_ITEM_PREFIX = 'entry:';
/** The default view's last section: the entries nothing links. */
export const UNUSED_SECTION_ID = 'unused';

/** Each use of a Media List entry folded into the entry's one card, at its first use; entries with no card in the sections follow. */
function entriesOnce(sections: readonly MediaSection[], entries: readonly MediaItem[]): MediaItem[] {
  const byId = new Map(entries.map((e) => [e.mediaId, e]));
  const seen = new Set<string>();
  const out: MediaItem[] = [];
  const once = (entry: MediaItem) => {
    if (seen.has(entry.id)) return;
    seen.add(entry.id);
    out.push(entry);
  };
  for (const item of sections.flatMap((s) => s.items)) {
    const entry = item.mediaId ? byId.get(item.mediaId) : undefined;
    if (entry) once(entry);
    else out.push(item);
  }
  entries.forEach(once);
  return out;
}

/**
 * By type (Q15), each Media List entry shows once in its kind's section, and media off the list keeps one card per use.
 * By parent, the sections stay as they are, with the Unused entries in a last section.
 */
export function groupSections(sections: MediaSection[], grouping: MediaGrouping, entries: readonly MediaItem[] = []): MediaSection[] {
  if (grouping === 'type') return typeSections([{ id: 'all', path: [], items: entriesOnce(sections, entries) }]);
  const unused = entries.filter((e) => e.unused);
  return unused.length ? [...sections, { id: UNUSED_SECTION_ID, path: ['Unused'], items: unused }] : sections;
}

export type MediaFilter = 'all' | 'linked' | 'embedded' | 'rules' | 'overBudget' | 'unused' | 'noImages';

export const MEDIA_FILTERS: readonly { value: MediaFilter; label: string }[] = [
  { value: 'all', label: 'All Media' },
  { value: 'linked', label: 'Linked' },
  { value: 'embedded', label: 'Embedded' },
  { value: 'rules', label: 'Has Visibility Rules' },
  { value: 'overBudget', label: 'Over Size Budget' },
  { value: 'unused', label: 'Unused' },
  { value: 'noImages', label: 'No Images' },
];

/**
 * Linked, rules and budget match images only; Embedded matches every item that is not a linked image. No Images
 * matches blank cards, which only `blankSections` holds.
 */
export function matchesMediaFilter(item: MediaItem, filter: MediaFilter): boolean {
  if (item.blank) return filter === 'noImages';
  switch (filter) {
    case 'all': return true;
    case 'noImages': return false;
    case 'unused': return !!item.unused;
    case 'linked': return item.linked;
    case 'embedded': return !item.linked;
    case 'rules': return item.kind === 'image' && !!item.rules?.length;
    case 'overBudget': return item.kind === 'image' && item.overBudget;
  }
}

/** The sections' items that pass the filter; a section with none is left out. */
export function filterSections(sections: MediaSection[], filter: MediaFilter): MediaSection[] {
  if (filter === 'all') return sections;
  return sections
    .map((s) => ({ ...s, items: s.items.filter((i) => matchesMediaFilter(i, filter)) }))
    .filter((s) => s.items.length);
}

/** Each section's cards by size, largest first, ties in author order. A stack sorts by its images' total and keeps their order. */
export function sortSectionsLargestFirst(sections: MediaSection[]): MediaSection[] {
  return sections.map((s) => ({
    ...s,
    items: sectionCards(s.items)
      .map((card, order) => {
        const members = card.images ?? [card.item];
        return { members, order, bytes: totalBytes(members) };
      })
      .sort((a, b) => b.bytes - a.bytes || a.order - b.order)
      .flatMap((card) => card.members),
  }));
}

/** "640 KB", "12.4 MB": 1024-based, so a section's figure agrees with the Publish Size readout. */
export function formatMediaBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/bmp': 'bmp', 'image/svg+xml': 'svg',
  'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/webm': 'webm', 'audio/mp4': 'm4a',
  'audio/flac': 'flac', 'model/gltf-binary': 'glb', 'model/gltf+json': 'gltf',
};

/**
 * The name Download saves an embedded item under: the parent's name and the slot ("Bram Image 2.webp"), or an
 * Avatar's own name.
 */
export function mediaFileName(item: MediaItem, parentName: string): string {
  const base = namedBySlot(item) ? item.slot : `${parentName} ${item.slot}`;
  const fromName = item.fileName && /\.([a-z0-9]{1,5})$/i.exec(item.fileName)?.[1];
  const mime = /^data:([^;,]+)/.exec(item.value)?.[1]?.toLowerCase() ?? '';
  // The data's type wins, since a downscale changes it; an Avatar's .vrm and .glb share one type, so its name wins.
  const ext = (item.kind === 'avatar' && fromName) || EXTENSIONS[mime] || fromName || (item.kind === 'avatar' ? 'vrm' : 'bin');
  const safe = base.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Media';
  return `${safe}.${ext.toLowerCase()}`;
}
