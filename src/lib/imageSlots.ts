/**
 * Where a world keeps its images, and the size budget for each. DOM-free, so workers can count images.
 */
import type { World } from '@/types';
import { entityImages } from './entityImages';

/** A per-use size budget for an image field. `maxDim` caps the longest edge (px); `maxBytes` the encoded size. */
export interface ImageCap {
  maxDim: number;
  maxBytes: number;
}

/** Display-driven budgets: a Large library tile renders thumbnails at ~800px, entity images in a
 *  modal, backgrounds full-viewport. */
export const IMAGE_CAPS = {
  thumbnail: { maxDim: 1024, maxBytes: 500_000 },
  entity: { maxDim: 1024, maxBytes: 600_000 },
  background: { maxDim: 1920, maxBytes: 1_500_000 },
} as const satisfies Record<string, ImageCap>;

export type ImageSlot = { url: string; cap: ImageCap; path: string };

/** Every image field in a world, paired with its budget. Absent fields are skipped. */
export function worldImageSlots(world: World): ImageSlot[] {
  const slots: ImageSlot[] = [];
  const thumb = world.worldOverview?.thumbnail;
  if (thumb) slots.push({ url: thumb, cap: IMAGE_CAPS.thumbnail, path: 'thumbnail' });
  for (const e of world.entities ?? []) {
    // Every picture in the gallery counts, so a world's second and third portraits are budgeted like the first.
    entityImages(e).forEach((url, i) => slots.push({ url, cap: IMAGE_CAPS.entity, path: `entity:${e.id}:${i}` }));
  }
  for (const l of world.locations ?? []) {
    if (l.backgroundImage) slots.push({ url: l.backgroundImage, cap: IMAGE_CAPS.background, path: `location:${l.id}` });
  }
  return slots;
}

/** How many image-bearing slots a world has — the `total` of an optimize run's progress. */
export const countWorldImages = (world: World): number => worldImageSlots(world).length;
