import type { Base64Data, GalleryImage } from '@/types';
import { entityImages, migrateEntityImages } from './entityImages';

/** A location's picture list as the app stores it, or as a record written before the gallery holds it. */
export type LocationImageBearing = {
  images?: readonly (GalleryImage | Base64Data)[];
  /** The pre-gallery single background, still present on files written before the gallery. */
  backgroundImage?: Base64Data | null;
};

/** One location's gallery, the pre-gallery background included, with blanks dropped. */
export function locationImages(location?: LocationImageBearing | null): GalleryImage[] {
  if (!location) return [];
  return entityImages(Array.isArray(location.images) ? { images: location.images } : { image: location.backgroundImage ?? undefined });
}

/**
 * Move a pre-gallery `backgroundImage` into slot 0 of `images`, wrap data strings and drop blanks. Idempotent,
 * and returns the same reference when there is nothing to change.
 */
export function migrateLocationImages<T extends LocationImageBearing>(location: T): T {
  if (!('backgroundImage' in location)) return 'images' in location ? migrateEntityImages(location) : location;
  const { backgroundImage, ...rest } = location;
  // A record that already holds a gallery keeps it; the stray background goes.
  const legacy = !Array.isArray(rest.images) && backgroundImage ? { image: backgroundImage } : {};
  return migrateEntityImages({ ...rest, ...legacy }) as T;
}
