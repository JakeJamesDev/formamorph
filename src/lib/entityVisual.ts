import { entityImages, galleryLinks } from '@/lib/entityImages';
import { drawableLayered } from '@/lib/layeredImages';
import type { Entity, MediaList } from '@/types';

/** The visual an entity can be shown by, if it has one at all. */
export type EntityVisualSource = Pick<Entity, 'id' | 'name' | 'images' | 'model'>;

/** Whether this entity has an image, a Layered Image or a 3D model to show. An Avatar is the host's to know. */
export const hasEntityVisual = (entity: EntityVisualSource | null | undefined, media: MediaList | undefined): boolean =>
  !!(entityImages(entity, media).length || galleryLinks(entity).some((link) => drawableLayered(link, media)) || entity?.model?.data);
