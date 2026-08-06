import type { Base64Data, Entity } from '@/types';

/** An entity's picture list in the shape the app stores it. */
type ImageBearing = Pick<Entity, 'images'> & {
  /** The pre-gallery single-portrait field, still present on files and library records written before the
   *  gallery. Read here so a legacy entity renders before it reaches a migration boundary. */
  image?: Base64Data;
};

/**
 * How many pictures one entity may carry. Two in a shipped build; four in development so the gallery's
 * wrap-around has enough slots to exercise. Authoring is capped by this — nothing enforces it on import,
 * where an over-long list is kept rather than silently truncated.
 */
export const ENTITY_IMAGE_SLOTS = import.meta.env.DEV ? 4 : 2;

/**
 * One entity's pictures, oldest shape included. Always an array, always free of blanks — every reader can
 * treat this as the entity's gallery without checking which shape the record was written in.
 */
export function entityImages(entity?: ImageBearing | null): Base64Data[] {
  if (!entity) return [];
  const list = Array.isArray(entity.images) ? entity.images : entity.image ? [entity.image] : [];
  return list.filter((url): url is Base64Data => typeof url === 'string' && !!url);
}

/**
 * The picture that stands in for the entity wherever only one is wanted — library grids, listing art, the
 * character card's own pixels. The first slot, so reordering the gallery is how an author changes it.
 */
export const primaryImage = (entity?: ImageBearing | null): Base64Data | undefined => entityImages(entity)[0];

/**
 * Fold a legacy single `image` into `images` and drop the old key. Idempotent, and returns the same
 * reference when there is nothing to change, so it is safe to run over every entity on every load.
 */
export function migrateEntityImages<T extends ImageBearing>(entity: T): T {
  if (!('image' in entity) && Array.isArray(entity.images)) return entity;
  const images = entityImages(entity);
  const { image: _legacy, ...rest } = entity;
  return (images.length ? { ...rest, images } : rest) as T;
}
