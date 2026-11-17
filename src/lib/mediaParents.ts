/**
 * One entry per media parent kind: its image cap, how its slots are written, which rule host its rows use, where
 * Go to lands and how a step is labeled. DOM-free, so the editor and the Optimize walk read the same table.
 */
import type { Body, Dictionary, Entity, GalleryImage, GalleryLink, GameLocation, Item, MediaAsset, MediaList, MediaRef, WorldOverview } from '@/types';
import { withBackdropImage, withOutline } from './bodyLayout';
import { galleryLinks } from './entityImages';
import { addedEntries, editGallery, galleryView, locationLinks } from './mediaGallery';
import { isMediaRef, mediaNameFromFile } from './mediaList';
import { BODY_SUBJECT, COVER_SUBJECT, MAP_SUBJECT, linkSingle, storedCover } from './mediaImages';
import { MUSIC_SUBJECT, placeSound, storedMusic } from './mediaSounds';
import { mapGalleryStepLabel, mapImages, withMapImages } from './mapBackground';
import { IMAGE_CAPS, type ImageCap } from './imageSlots';
import type { MediaItem, MediaParent, MediaParentKind } from './mediaIndex';

/** A field's new value, or null to clear it. A sound or model slot always gets a whole file; an image slot reads only its data. */
export type MediaWrite = (Pick<MediaAsset, 'data'> & Partial<MediaAsset>) | null;

/** The writes a parent entry makes, each on one record. The editor binds them to the world's setters; Optimize, to a plain world. */
export interface MediaEditor {
  overview: (patch: (o: WorldOverview) => Partial<WorldOverview>) => void;
  entity: (id: string, edit: (e: Entity) => Entity) => void;
  location: (id: string, edit: (l: GameLocation) => GameLocation) => void;
  dictionary: (id: string, edit: (d: Dictionary) => Dictionary) => void;
  body: (id: string, edit: (b: Body) => Body) => void;
  item: (id: string, edit: (i: Item) => Item) => void;
  /** The records and Media List as the next write sees them. */
  read: {
    entity: (id: string) => Entity | undefined;
    location: (id: string) => GameLocation | undefined;
    body: (id: string) => Body | undefined;
    item: (id: string) => Item | undefined;
    overview: () => WorldOverview | undefined;
    mediaList: () => MediaList | undefined;
    /** A record's name as a new entry's subject, placeholders labeled. */
    subject: (name: string) => string;
  };
  /** Adds entries to the world's Media List. */
  addMedia: (entries: MediaList) => void;
}

/** Where Go to lands: a tab, the Locations canvas, Equipment Settings, or a parent's own item on its bench tab. */
export type MediaGoTo =
  | { to: 'overview' }
  | { to: 'canvas' }
  | { to: 'equipment' }
  | { to: 'bench'; tab: 'entities' | 'locations' | 'dictionary' | 'items' };

export interface MediaParentSpec {
  /** The size budget of this parent's images. */
  cap: ImageCap;
  /** Whether its images stack into one card per parent. */
  stacks: boolean;
  /** The rule host its gallery rows use; none for a parent whose images carry no rules. */
  ruleHost?: 'entity' | 'location';
  goTo: MediaGoTo;
  /** Go to copy when it is not the parent's name. */
  goToLabel?: string;
  /** Edits a gallery's images as one write; absent on a parent with no gallery. */
  gallery?: {
    write: (editor: MediaEditor, parent: MediaParent, edit: (images: GalleryImage[]) => GalleryImage[]) => void;
  };
  /** Writes one slot's new value (a file, a gallery position, a field). */
  write: (editor: MediaEditor, item: Pick<MediaItem, 'parent' | 'key' | 'galleryIndex'>, next: MediaWrite) => void;
  /** The History Step label for a write; defaults to the verb and slot. */
  stepLabel?: (item: MediaItem, overview: WorldOverview, next: MediaWrite) => string;
}

/**
 * A replaced gallery image keeps its place and its rule, and takes a new file's name; a removed one leaves with
 * its rule. A write with no file name (Optimize) keeps the picture's name.
 */
export const writeGalleryImage = (images: readonly GalleryImage[], at: number, next: MediaWrite): GalleryImage[] =>
  images.flatMap((img, i) => {
    if (i !== at) return [img];
    if (!next) return [];
    const name = mediaNameFromFile(next.name);
    return [{ ...img, data: next.data, ...(name ? { name } : {}) }];
  });

type GalleryWriter = NonNullable<MediaParentSpec['gallery']>;

/** Replaces or removes the gallery image at the item's position, keeping its rule. */
const writeGallerySlot = (gallery: GalleryWriter, editor: MediaEditor, item: Pick<MediaItem, 'parent' | 'galleryIndex'>, next: MediaWrite): void => {
  const at = item.galleryIndex;
  if (at !== undefined) gallery.write(editor, item.parent, (images) => writeGalleryImage(images, at, next));
};

/** A gallery's pictures edited and relinked: the record's write first, so the History Step is the record's. */
function editLinked(
  editor: MediaEditor, links: GalleryLink[], name: string, edit: (images: GalleryImage[]) => GalleryImage[], write: (links: GalleryLink[]) => void,
): void {
  const list = editor.read.mediaList();
  const next = editGallery(links, list, edit(galleryView(links, list).images), editor.read.subject(name));
  write(next.links);
  if (Object.keys(next.added).length) editor.addMedia(next.added);
}

const ENTITY_GALLERY: GalleryWriter = {
  write: (editor, parent, edit) => {
    const entity = editor.read.entity(parent.id);
    if (entity) editLinked(editor, galleryLinks(entity), entity.name, edit, (images) => editor.entity(parent.id, (e) => ({ ...e, images })));
  },
};
const LOCATION_GALLERY: GalleryWriter = {
  write: (editor, parent, edit) => {
    const location = editor.read.location(parent.id);
    if (location) editLinked(editor, locationLinks(location), location.name, edit, (images) => editor.location(parent.id, (l) => ({ ...l, images })));
  },
};
const ITEM_GALLERY: GalleryWriter = {
  write: (editor, parent, edit) => {
    const item = editor.read.item(parent.id);
    if (item) editLinked(editor, galleryLinks(item), item.name, edit, (images) => editor.item(parent.id, (i) => ({ ...i, images })));
  },
};
const MAP_GALLERY: GalleryWriter = {
  write: (editor, _parent, edit) => {
    const links = galleryLinks({ images: editor.read.overview()?.mapBackground?.images });
    editLinked(editor, links, MAP_SUBJECT, edit, (next) => editor.overview((o) => ({ mapBackground: withMapImages(o.mapBackground, next) })));
  },
};

/** Sets or clears a Body's Custom Image, placing a file into the list. `aspect` is the file's, read by a replace. */
export function writeBackdrop(editor: MediaEditor, parent: Pick<MediaParent, 'id' | 'name'>, next: MediaWrite, aspect?: number): void {
  const name = editor.read.body(parent.id)?.name;
  const placed = next ? placeSingle(editor, next, name ? editor.read.subject(name) : BODY_SUBJECT) : undefined;
  editor.body(parent.id, (b) => (placed ? withBackdropImage(b, placed.link, aspect) : withOutline(b, 'humanoid')));
  if (placed && Object.keys(placed.added).length) editor.addMedia(placed.added);
}

/** A single field's new picture placed into the list: the stored value, and the entries to add after the record's write. */
function placeSingle(editor: MediaEditor, next: NonNullable<MediaWrite>, subject: string) {
  const name = mediaNameFromFile(next.name);
  return linkSingle(editor.read.mediaList(), { data: next.data, ...(name ? { name } : {}) }, subject);
}

/** A sound slot's new value: a link, a file, or null to clear it. */
export type SoundSlotWrite = MediaRef | MediaWrite;

/** The value a sound field stores: a link as is, a file placed into the list when the world has one (Q17). */
function storedSound(editor: MediaEditor, next: SoundSlotWrite, subject: string): MediaRef | MediaAsset | undefined {
  if (!next) return undefined;
  if (isMediaRef(next)) return next;
  const list = editor.read.mediaList();
  if (!list) return next as MediaAsset;
  const placed = placeSound(list, next, subject);
  const added = addedEntries(list, placed.list);
  if (Object.keys(added).length) editor.addMedia(added);
  return placed.link;
}

/** Writes a sound field (entity sound, ambience, world music), placing a file into the list. */
export function writeSoundSlot(editor: MediaEditor, { parent, key }: Pick<MediaItem, 'parent' | 'key'>, next: SoundSlotWrite): void {
  if (parent.kind === 'world' && key === 'bgm') {
    const value = storedSound(editor, next, MUSIC_SUBJECT);
    editor.overview(() => ({ bgm: storedMusic(value) }));
  } else if (parent.kind === 'entity' && key === 'sound') {
    const value = storedSound(editor, next, editor.read.subject(editor.read.entity(parent.id)?.name ?? parent.name));
    editor.entity(parent.id, (e) => ({ ...e, sound: value }));
  } else if (parent.kind === 'location' && key === 'ambientSound') {
    const value = storedSound(editor, next, editor.read.subject(editor.read.location(parent.id)?.name ?? parent.name));
    editor.location(parent.id, (l) => ({ ...l, ambientSound: value }));
  }
}

const MEDIA_PARENTS: Record<MediaParentKind, MediaParentSpec> = {
  world: {
    cap: IMAGE_CAPS.thumbnail,
    stacks: false,
    goTo: { to: 'overview' },
    goToLabel: 'Go to Overview',
    write: (editor, item, next) => {
      if (item.key === 'thumbnail') {
        const placed = next ? placeSingle(editor, next, COVER_SUBJECT) : undefined;
        editor.overview(() => ({ thumbnail: storedCover(placed?.link ?? null) }));
        if (placed && Object.keys(placed.added).length) editor.addMedia(placed.added);
      }
      else if (item.key === 'bgm') writeSoundSlot(editor, item, next);
    },
  },
  map: {
    cap: IMAGE_CAPS.map,
    stacks: true,
    ruleHost: 'location',
    goTo: { to: 'canvas' },
    goToLabel: 'Go to Locations',
    gallery: MAP_GALLERY,
    write: (editor, item, next) => writeGallerySlot(MAP_GALLERY, editor, item, next),
    // The canvas card labels its gallery writes the same way.
    stepLabel: (item, overview, next) => {
      const before = mapImages(overview);
      const at = item.galleryIndex;
      return mapGalleryStepLabel(before, at === undefined ? before : writeGalleryImage(before, at, next));
    },
  },
  entity: {
    cap: IMAGE_CAPS.entity,
    stacks: true,
    ruleHost: 'entity',
    goTo: { to: 'bench', tab: 'entities' },
    gallery: ENTITY_GALLERY,
    write: (editor, item, next) => {
      const { parent, key } = item;
      if (key === 'sound') writeSoundSlot(editor, item, next);
      if (key === 'model') editor.entity(parent.id, (e) => ({ ...e, model: (next as MediaAsset | null) ?? undefined }));
      writeGallerySlot(ENTITY_GALLERY, editor, item, next);
    },
  },
  location: {
    cap: IMAGE_CAPS.background,
    stacks: true,
    ruleHost: 'location',
    goTo: { to: 'bench', tab: 'locations' },
    gallery: LOCATION_GALLERY,
    write: (editor, item, next) => {
      if (item.galleryIndex !== undefined) writeGallerySlot(LOCATION_GALLERY, editor, item, next);
      else if (item.key === 'ambientSound') writeSoundSlot(editor, item, next);
    },
  },
  dictionary: {
    cap: IMAGE_CAPS.thumbnail,
    stacks: false,
    goTo: { to: 'bench', tab: 'dictionary' },
    write: (editor, { parent, key }, next) => {
      if (key === 'thumbnail') editor.dictionary(parent.id, (d) => ({ ...d, thumbnail: next?.data ?? '' }));
    },
  },
  body: {
    cap: IMAGE_CAPS.entity,
    stacks: false,
    goTo: { to: 'equipment' },
    goToLabel: 'Go to Equipment Settings',
    // A removed file leaves the Humanoid outline (Q72).
    write: (editor, { parent, key }, next) => {
      if (key !== 'backdrop') return;
      writeBackdrop(editor, parent, next);
    },
  },
  item: {
    cap: IMAGE_CAPS.entity,
    stacks: true,
    goTo: { to: 'bench', tab: 'items' },
    gallery: ITEM_GALLERY,
    write: (editor, item, next) => writeGallerySlot(ITEM_GALLERY, editor, item, next),
  },
};

export const mediaParentSpec = (kind: MediaParentKind): MediaParentSpec => MEDIA_PARENTS[kind];

/** Writes one slot through its parent's entry. */
export const writeMediaSlot = (editor: MediaEditor, item: Pick<MediaItem, 'parent' | 'key' | 'galleryIndex'>, next: MediaWrite): void =>
  MEDIA_PARENTS[item.parent.kind].write(editor, item, next);
