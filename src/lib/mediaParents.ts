/**
 * One entry per media parent kind: its image cap, how its slots are written, which rule host its rows use, where
 * Go to lands and how a step is labeled. DOM-free, so the editor and the Optimize walk read the same table.
 */
import type { Dictionary, Entity, GalleryImage, GameLocation, MediaAsset, WorldOverview } from '@/types';
import { entityImages } from './entityImages';
import { locationImages } from './locationImages';
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
}

/** Where Go to lands: a tab, the Locations canvas, or a parent's own item on its bench tab. */
export type MediaGoTo =
  | { to: 'overview' }
  | { to: 'canvas' }
  | { to: 'bench'; tab: 'entities' | 'locations' | 'dictionary' };

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

/** A replaced gallery image keeps its place and its rule; a removed one leaves with its rule. */
export const writeGalleryImage = (images: readonly GalleryImage[], at: number, next: MediaWrite): GalleryImage[] =>
  images.flatMap((img, i) => (i !== at ? [img] : next ? [{ ...img, data: next.data }] : []));

type GalleryWriter = NonNullable<MediaParentSpec['gallery']>;

/** Replaces or removes the gallery image at the item's position, keeping its rule. */
const writeGallerySlot = (gallery: GalleryWriter, editor: MediaEditor, item: Pick<MediaItem, 'parent' | 'galleryIndex'>, next: MediaWrite): void => {
  const at = item.galleryIndex;
  if (at !== undefined) gallery.write(editor, item.parent, (images) => writeGalleryImage(images, at, next));
};

const MAP_GALLERY: GalleryWriter = {
  write: (editor, _parent, edit) => editor.overview((o) => ({ mapBackground: withMapImages(o.mapBackground, edit(mapImages(o))) })),
};
const ENTITY_GALLERY: GalleryWriter = {
  write: (editor, parent, edit) => editor.entity(parent.id, (e) => ({ ...e, images: edit(entityImages(e)) })),
};
const LOCATION_GALLERY: GalleryWriter = {
  write: (editor, parent, edit) => editor.location(parent.id, (l) => ({ ...l, images: edit(locationImages(l)) })),
};

const MEDIA_PARENTS: Record<MediaParentKind, MediaParentSpec> = {
  world: {
    cap: IMAGE_CAPS.thumbnail,
    stacks: false,
    goTo: { to: 'overview' },
    goToLabel: 'Go to Overview',
    write: (editor, { key }, next) => {
      if (key === 'thumbnail') editor.overview(() => ({ thumbnail: next?.data ?? '' }));
      else if (key === 'bgm') editor.overview(() => ({ bgm: next?.data ?? null }));
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
      if (key === 'sound' || key === 'model') editor.entity(parent.id, (e) => ({ ...e, [key]: (next as MediaAsset | null) ?? undefined }));
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
      else if (item.key === 'ambientSound') editor.location(item.parent.id, (l) => ({ ...l, ambientSound: (next as MediaAsset | null) ?? undefined }));
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
};

export const mediaParentSpec = (kind: MediaParentKind): MediaParentSpec => MEDIA_PARENTS[kind];

/** Writes one slot through its parent's entry. */
export const writeMediaSlot = (editor: MediaEditor, item: Pick<MediaItem, 'parent' | 'key' | 'galleryIndex'>, next: MediaWrite): void =>
  MEDIA_PARENTS[item.parent.kind].write(editor, item, next);
