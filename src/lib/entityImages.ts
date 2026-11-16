import type { Base64Data, GalleryImage, GalleryLink, LinkedGalleryImage, MediaList, TraitRequirement, TraitRequirementRow } from '@/types';
import { mapConditions } from './requirementRows';
import { embedGallery } from './mediaList';

/** An entity's picture list in the shape the app stores it, or in any shape a record written before it holds. */
export type ImageBearing = {
  /** Images, or data strings on records written before Visibility rules. */
  images?: readonly (GalleryLink | Base64Data)[];
  /** The pre-gallery single-portrait field, still present on files and library records written before the
   *  gallery. Read here so a legacy entity renders before it reaches a migration boundary. */
  image?: Base64Data;
};

/** One stored gallery element in its canonical stored form, or null when it holds nothing. */
export function galleryLink(raw: unknown): GalleryLink | null {
  if (typeof raw === 'string') return raw ? { data: raw } : null;
  if (!raw || typeof raw !== 'object') return null;
  const { data, name, mediaId, requires } = raw as Partial<GalleryImage & LinkedGalleryImage>;
  const rules = Array.isArray(requires) && requires.length ? { requires } : {};
  if (typeof mediaId === 'string' && mediaId) return { mediaId, ...rules };
  if (typeof data !== 'string' || !data) return null;
  return { data, ...(typeof name === 'string' && name ? { name } : {}), ...rules };
}

/** One entity's stored gallery, oldest shapes included and blanks dropped, with Media List links kept as links. */
export function galleryLinks(entity?: ImageBearing | null): GalleryLink[] {
  if (!entity) return [];
  const list: readonly unknown[] = Array.isArray(entity.images) ? entity.images : entity.image ? [entity.image] : [];
  return list.flatMap((raw) => galleryLink(raw) ?? []);
}

/**
 * One entity's gallery as pictures, oldest shapes included. Links resolve through `media`; one it lacks drops,
 * as a blank does. Every reader can treat this as the entity's gallery without checking the stored shape.
 */
export function entityImages(entity?: ImageBearing | null, media?: MediaList): GalleryImage[] {
  return embedGallery(galleryLinks(entity), media);
}

/** The gallery's pictures alone, for a caller that only paints them. */
export const entityImageData = (entity?: ImageBearing | null, media?: MediaList): Base64Data[] =>
  entityImages(entity, media).map((img) => img.data);

/**
 * The picture that stands in for the entity wherever only one is wanted — library grids, listing art, the
 * character card's own pixels. The first slot, so reordering the gallery is how an author changes it.
 */
export const primaryImage = (entity?: ImageBearing | null, media?: MediaList): Base64Data | undefined =>
  entityImages(entity, media)[0]?.data;

/** `images` with image `index` under rule `rows`; empty rows drop the field. */
export const withImageRule = <T extends GalleryLink>(images: readonly T[], index: number, rows: TraitRequirementRow[]): T[] =>
  images.map((img, i) => {
    if (i !== index) return img;
    const next = { ...img };
    if (rows.length) next.requires = rows;
    else delete next.requires;
    return next;
  });

/** Whether any image in the entity's gallery carries a Visibility rule. */
export const hasImageRules = (entity?: ImageBearing | null): boolean => galleryLinks(entity).some((img) => !!img.requires?.length);

/** The entity's stored gallery with `map` applied to every Condition of every image's rule. */
export const mapImageRules = (
  entity: ImageBearing, map: (req: TraitRequirement) => TraitRequirement,
): GalleryLink[] => galleryLinks(entity).map((img) => (img.requires ? { ...img, requires: mapConditions(img.requires, map) } : img));

/** The entity with `map` applied to its images' Visibility rules; the same entity when no image carries one. */
export const withImageRules = <T extends ImageBearing>(entity: T, map: (req: TraitRequirement) => TraitRequirement): T =>
  (hasImageRules(entity) ? { ...entity, images: mapImageRules(entity, map) } : entity);

const isCanonical = (raw: unknown): boolean => {
  const img = galleryLink(raw);
  return !!img && typeof raw === 'object' && Object.keys(raw as object).length === Object.keys(img).length;
};

/**
 * Fold a legacy single `image` into `images`, wrap each data string as an image, and drop blanks. Idempotent,
 * and returns the same reference when there is nothing to change, so it is safe to run over every entity on
 * every load.
 */
export function migrateEntityImages<T extends ImageBearing>(entity: T): T {
  if (!('image' in entity) && Array.isArray(entity.images) && entity.images.every(isCanonical)) return entity;
  const images = galleryLinks(entity);
  const { image: _legacy, images: _old, ...rest } = entity;
  return (images.length ? { ...rest, images } : rest) as T;
}
