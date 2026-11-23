/** Weather Masks on location image slots: the Mask entries a slot links, and what an upload stores. */
import type { GalleryImage, GameLocation, MediaFileEntry, MediaList } from '@/types';
import { galleryLink } from './entityImages';
import { fitWithin } from './imageBytes';
import { IMAGE_CAPS } from './imageSlots';
import { mediaEntry, newMediaName } from './mediaList';
import { randomUUID } from './uuid';

/** A Mask is capped like the location image it covers. */
export const MASK_CAP = IMAGE_CAPS.background;

/** The Mask entry `id` names, or undefined for a missing id or an entry of another kind. */
export const maskEntry = (list: MediaList | undefined, id: string | undefined): MediaFileEntry | undefined =>
  (id ? mediaEntry(list, id, 'mask') : undefined);

/** How many location image slots link Mask `id`, across every location. */
export function maskUseCount(locations: readonly Pick<GameLocation, 'images'>[], id: string): number {
  let count = 0;
  for (const location of locations) {
    for (const raw of location.images ?? []) if (galleryLink(raw)?.weatherMask === id) count++;
  }
  return count;
}

/** `images` with slot `index` linking Mask `id`, or unlinked when `id` is undefined. Every other slot is unchanged. */
export function withSlotMask(images: readonly GalleryImage[], index: number, id: string | undefined): GalleryImage[] {
  return images.map((image, i) => {
    if (i !== index) return image;
    const { weatherMask: _old, ...rest } = image;
    return id ? { ...rest, weatherMask: id } : rest;
  });
}

/** A new Mask entry holding `data`, named for the file, else "<subject> Mask N", unique in `list`. */
export function newMaskEntry(list: MediaList | undefined, data: string, fileName: string | undefined, subject: string): MediaFileEntry {
  return { id: randomUUID(), name: newMediaName(fileName, `${subject} Mask`, 'mask', list), kind: 'mask', data, type: 'image/png' };
}

/** An uploaded file as a Mask's data: a PNG data URL, scaled down to fit `MASK_CAP`. */
export async function encodeMaskPng(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const { w, h } = fitWithin(bitmap.width, bitmap.height, MASK_CAP.maxDim);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext('2d');
    if (!context) throw new Error("This browser can't draw the Weather Mask");
    context.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}
