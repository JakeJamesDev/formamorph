import type { Base64Data, GalleryImage, TraitRequirement, TraitRequirementRow } from '@/types';
import { mapConditions } from './requirementRows';

/** An entity's picture list in the shape the app stores it, or in any shape a record written before it holds. */
type ImageBearing = {
  /** Images, or data strings on records written before Visibility rules. */
  images?: readonly (GalleryImage | Base64Data)[];
  /** The pre-gallery single-portrait field, still present on files and library records written before the
   *  gallery. Read here so a legacy entity renders before it reaches a migration boundary. */
  image?: Base64Data;
};

/** One stored gallery element as an image, or null when it holds no picture. */
function galleryImage(raw: unknown): GalleryImage | null {
  if (typeof raw === 'string') return raw ? { data: raw } : null;
  if (!raw || typeof raw !== 'object') return null;
  const { data, requires } = raw as Partial<GalleryImage>;
  if (typeof data !== 'string' || !data) return null;
  return Array.isArray(requires) && requires.length ? { data, requires } : { data };
}

/**
 * One entity's gallery, oldest shapes included. Always an array of images, always free of blanks — every
 * reader can treat this as the entity's gallery without checking which shape the record was written in.
 */
export function entityImages(entity?: ImageBearing | null): GalleryImage[] {
  if (!entity) return [];
  const list: readonly unknown[] = Array.isArray(entity.images) ? entity.images : entity.image ? [entity.image] : [];
  return list.flatMap((raw) => galleryImage(raw) ?? []);
}

/** The gallery's pictures alone, for a caller that only paints them. */
export const entityImageData = (entity?: ImageBearing | null): Base64Data[] => entityImages(entity).map((img) => img.data);

/**
 * The picture that stands in for the entity wherever only one is wanted — library grids, listing art, the
 * character card's own pixels. The first slot, so reordering the gallery is how an author changes it.
 */
export const primaryImage = (entity?: ImageBearing | null): Base64Data | undefined => entityImages(entity)[0]?.data;

/** `images` with image `index` under rule `rows`; empty rows drop the field. */
export const withImageRule = (images: readonly GalleryImage[], index: number, rows: TraitRequirementRow[]): GalleryImage[] =>
  images.map((img, i) => {
    if (i !== index) return img;
    const next = { ...img };
    if (rows.length) next.requires = rows;
    else delete next.requires;
    return next;
  });

/** Whether any image in the entity's gallery carries a Visibility rule. */
export const hasImageRules = (entity?: ImageBearing | null): boolean => entityImages(entity).some((img) => !!img.requires?.length);

/** The entity's gallery with `map` applied to every Condition of every image's rule. */
export const mapImageRules = (
  entity: ImageBearing, map: (req: TraitRequirement) => TraitRequirement,
): GalleryImage[] => entityImages(entity).map((img) => (img.requires ? { ...img, requires: mapConditions(img.requires, map) } : img));

/** The entity with `map` applied to its images' Visibility rules; the same entity when no image carries one. */
export const withImageRules = <T extends ImageBearing>(entity: T, map: (req: TraitRequirement) => TraitRequirement): T =>
  (hasImageRules(entity) ? { ...entity, images: mapImageRules(entity, map) } : entity);

const isCanonical = (raw: unknown): boolean => {
  const img = galleryImage(raw);
  return !!img && typeof raw === 'object' && Object.keys(raw as object).length === Object.keys(img).length;
};

/**
 * Fold a legacy single `image` into `images`, wrap each data string as an image, and drop blanks. Idempotent,
 * and returns the same reference when there is nothing to change, so it is safe to run over every entity on
 * every load.
 */
export function migrateEntityImages<T extends ImageBearing>(entity: T): T {
  if (!('image' in entity) && Array.isArray(entity.images) && entity.images.every(isCanonical)) return entity;
  const images = entityImages(entity);
  const { image: _legacy, images: _old, ...rest } = entity;
  return (images.length ? { ...rest, images } : rest) as T;
}
