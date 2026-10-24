/**
 * Every media item a world holds, with its stored size, and the sections the Media tab lays them out in.
 * DOM-free: sizes come from string lengths, so nothing decodes to list.
 */
import type { Entity, GameLocation, TraitRequirementRow, World } from '@/types';
import { entityImages } from './entityImages';
import { buildEntityTree, type EntityTreeNode } from './entityGroupTree';
import { buildLocationTree, type LocationTreeNode } from './locationTree';
import { IMAGE_CAPS, type ImageCap } from './imageSlots';
import { dataUrlBytes, isRemoteImage } from './imageBytes';

export type MediaKind = 'image' | 'sound' | 'model' | 'avatar';
export type MediaParentKind = 'world' | 'entity' | 'location' | 'dictionary';

/** What holds a media item. Its name is what copy calls it; world media has the world as its parent. */
export interface MediaParent {
  kind: MediaParentKind;
  id: string;
  name: string;
}

export interface MediaItem {
  /** Stable for the item's slot: parent and slot key. */
  id: string;
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
  /** An entity gallery image's Visibility rule rows. */
  rules?: TraitRequirementRow[];
  galleryIndex?: number;
  /** Avatars only: the entities that pick it. */
  users?: MediaParent[];
  /** The uploaded file's name, on a field that keeps one. */
  fileName?: string;
}

export type MediaWorld = Pick<World, 'worldOverview' | 'entities' | 'locations' | 'dictionaries'> & Pick<Partial<World>, 'entityGroups'>;

const WORLD_PARENT: MediaParent = { kind: 'world', id: 'world', name: 'World' };

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

const itemId = (parent: MediaParent, key: string) => `${parent.kind}:${parent.id}:${key}`;

function image(parent: MediaParent, key: string, slot: string, value: string, budget: ImageCap, extra: Partial<MediaItem> = {}): MediaItem {
  const linked = isRemoteImage(value);
  return {
    id: itemId(parent, key), kind: 'image', parent, slot, value,
    bytes: storedBytes(value), linked, budget,
    // The budget measures decoded image bytes, which a link has none of.
    overBudget: !linked && dataUrlBytes(value) > budget.maxBytes,
    ...extra,
  };
}

const file = (parent: MediaParent, kind: MediaKind, key: string, slot: string, value: string, fileName?: string): MediaItem => ({
  id: itemId(parent, key), kind, parent, slot, value, bytes: storedBytes(value), linked: false, overBudget: false,
  ...(fileName ? { fileName } : {}),
});

const entityParent = (e: Entity): MediaParent => ({ kind: 'entity', id: e.id, name: e.name });
const locationParent = (l: GameLocation): MediaParent => ({ kind: 'location', id: l.id, name: l.name });

/** One entity's media: its gallery, then its sound, then its 3D Model. */
function entityMedia(e: Entity): MediaItem[] {
  const parent = entityParent(e);
  const items = entityImages(e).map((img, i) => image(parent, `image:${i}`, `Image ${i + 1}`, img.data, IMAGE_CAPS.entity, {
    galleryIndex: i, ...(img.requires?.length ? { rules: img.requires } : {}),
  }));
  if (e.sound?.data) items.push(file(parent, 'sound', 'sound', 'Sound', e.sound.data, e.sound.name));
  if (e.model?.data) items.push(file(parent, 'model', 'model', '3D Model', e.model.data, e.model.name));
  return items;
}

function locationMedia(l: GameLocation): MediaItem[] {
  const parent = locationParent(l);
  const items: MediaItem[] = [];
  if (l.backgroundImage) items.push(image(parent, 'background', 'Background Image', l.backgroundImage, IMAGE_CAPS.background));
  if (l.ambientSound?.data) items.push(file(parent, 'sound', 'ambientSound', 'Ambient Sound', l.ambientSound.data, l.ambientSound.name));
  return items;
}

function worldMedia(w: MediaWorld): MediaItem[] {
  const o = w.worldOverview;
  const items: MediaItem[] = [];
  if (o.thumbnail) items.push(image(WORLD_PARENT, 'thumbnail', 'Thumbnail', o.thumbnail, IMAGE_CAPS.thumbnail));
  if (o.bgm) items.push(file(WORLD_PARENT, 'sound', 'bgm', 'Background Music', o.bgm));
  return items;
}

function avatarMedia(w: MediaWorld): MediaItem[] {
  return Object.entries(w.worldOverview.vrmStore ?? {}).filter(([, vrm]) => vrm.file?.data).map(([id, vrm]) => ({
    ...file(WORLD_PARENT, 'avatar', `avatar:${id}`, vrm.name, vrm.file.data, vrm.file.name),
    users: w.entities.filter((e) => e.vrmPick?.kind === 'world' && e.vrmPick.id === id).map(entityParent),
  }));
}

function dictionaryMedia(w: MediaWorld): MediaItem[] {
  return w.dictionaries.flatMap((d) => {
    const parent: MediaParent = { kind: 'dictionary', id: d.id, name: d.name };
    return d.thumbnail ? [image(parent, 'thumbnail', 'Thumbnail', d.thumbnail, IMAGE_CAPS.thumbnail)] : [];
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
 * The world's media in sections, in author order. A section is a folder: World, its Avatars, Entities and each
 * entity group, Locations and each location with children, and Dictionaries. An entity's or location's items
 * fold into the nearest section, and a section with no items is left out.
 */
export function mediaSections(w: MediaWorld): MediaSection[] {
  const { sections, add } = sectionBuilder();
  add('world', ['World'], worldMedia(w));
  add('avatars', ['World', 'Avatars'], avatarMedia(w));

  const entityFolder = (id: string, path: string[], nodes: EntityTreeNode[]) => {
    const leaves = nodes.flatMap((n) => (n.kind === 'leaf' ? [n.leaf] : []));
    add(id, path, leaves.flatMap(entityMedia));
    for (const n of nodes) if (n.kind === 'group') entityFolder(`group:${n.id}`, [...path, n.group.name], n.children);
  };
  entityFolder('entities', ['Entities'], buildEntityTree(w.entityGroups ?? [], w.entities));

  // A location with children is a folder of its own, holding its own media and its leaf children's.
  const locationFolder = (id: string, path: string[], own: MediaItem[], nodes: LocationTreeNode[]) => {
    add(id, path, [...own, ...nodes.filter((n) => !n.children.length).flatMap((n) => locationMedia(n.location))]);
    for (const n of nodes) {
      if (n.children.length) locationFolder(`location:${n.id}`, [...path, n.location.name], locationMedia(n.location), n.children);
    }
  };
  locationFolder('locations', ['Locations'], [], buildLocationTree(w.locations));

  add('dictionaries', ['Dictionaries'], dictionaryMedia(w));
  return sections;
}

/** The selection id of a section's header, apart from any item's. */
export const sectionSelection = (id: string): string => `section:${id}`;

/** A section's folder path as copy shows it: "Entities › Crew". */
export const sectionTitle = (section: MediaSection): string => section.path.join(' › ');

/** World media goes by its slot ("Thumbnail", an Avatar's name); everything else by its parent's name. */
export const namedBySlot = (item: MediaItem): boolean => item.parent.kind === 'world';

/** Every media item in the world, in section order. Each Avatar appears once. */
export const buildMediaIndex = (w: MediaWorld): MediaItem[] => mediaSections(w).flatMap((s) => s.items);

export const totalBytes = (items: readonly MediaItem[]): number => items.reduce((n, i) => n + i.bytes, 0);

const MEDIA_KINDS: readonly MediaKind[] = ['image', 'sound', 'model', 'avatar'];

export const MEDIA_KIND_LABELS: Record<MediaKind, { one: string; many: string }> = {
  image: { one: 'Image', many: 'Images' },
  sound: { one: 'Sound', many: 'Sounds' },
  model: { one: '3D Model', many: '3D Models' },
  avatar: { one: 'Avatar', many: 'Avatars' },
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

/** Only an entity's or location's images stack; every other item is its own card. */
export const canStack = (item: MediaItem): boolean =>
  item.kind === 'image' && (item.parent.kind === 'entity' || item.parent.kind === 'location');

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
    const key = `${item.parent.kind}:${item.parent.id}`;
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

export const groupSections = (sections: MediaSection[], grouping: MediaGrouping): MediaSection[] =>
  grouping === 'type' ? typeSections(sections) : sections;

export type MediaFilter = 'all' | 'linked' | 'embedded' | 'rules' | 'overBudget';

export const MEDIA_FILTERS: readonly { value: MediaFilter; label: string }[] = [
  { value: 'all', label: 'All Media' },
  { value: 'linked', label: 'Linked' },
  { value: 'embedded', label: 'Embedded' },
  { value: 'rules', label: 'Has Visibility Rules' },
  { value: 'overBudget', label: 'Over Size Budget' },
];

/** Linked, rules and budget match images only; Embedded matches every item that is not a linked image. */
export function matchesMediaFilter(item: MediaItem, filter: MediaFilter): boolean {
  switch (filter) {
    case 'all': return true;
    case 'linked': return item.kind === 'image' && item.linked;
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
