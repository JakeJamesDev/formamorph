/** Weather Masks on location image slots: the Mask entries a slot links, and what an upload stores. */
import type { CSSProperties } from 'react';
import type { GalleryImage, GameLocation, MediaFileEntry, MediaList } from '@/types';
import { galleryLink } from './entityImages';
import { fitWithin } from './imageBytes';
import { IMAGE_CAPS } from './imageSlots';
import { mediaEntry, newMediaName, uniqueMediaName } from './mediaList';
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

/**
 * Slot `index` split off Mask `original`: a new Mask entry with the same data, named "<name> (Copy)", unique in
 * `list`, and `images` with only that slot linking it.
 */
export function copySlotMask(list: MediaList | undefined, original: MediaFileEntry, images: readonly GalleryImage[], index: number): {
  entry: MediaFileEntry;
  images: GalleryImage[];
} {
  const entry: MediaFileEntry = { ...original, id: randomUUID(), name: uniqueMediaName(`${original.name} (Copy)`, list) };
  return { entry, images: withSlotMask(images, index, entry.id) };
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

/**
 * A luminance mask stretched over the box the art takes at `ratio`, centered: `cover` as `bg-cover bg-center` places
 * it, `contain` as `object-contain` does.
 */
export const fitMaskStyle = (mask: string, ratio: number, fit: 'cover' | 'contain'): CSSProperties => {
  const pick = fit === 'cover' ? 'max' : 'min';
  return {
    maskImage: `url("${mask}")`,
    maskMode: 'luminance',
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
    maskSize: `${pick}(100cqw, calc(100cqh * ${ratio})) ${pick}(100cqh, calc(100cqw / ${ratio}))`,
  };
};

/** How the brush editor shows a mask: a tint color over the picture, or the mask itself in opaque gray. */
export type MaskShade = 'magenta' | 'cyan' | 'blackWhite';
export const MASK_SHADES: readonly MaskShade[] = ['magenta', 'cyan', 'blackWhite'];
export const MASK_SHADE_LABELS: Record<MaskShade, string> = { magenta: 'Magenta', cyan: 'Cyan', blackWhite: 'Black and White' };
export const DEFAULT_MASK_SHADE = 'magenta' satisfies MaskShade;

/** Each tint's color; white in the mask shows it at `MASK_TINT_ALPHA`. Show Mask uses the default. */
export const MASK_TINTS: Record<Exclude<MaskShade, 'blackWhite'>, readonly [number, number, number]> = {
  magenta: [255, 0, 255],
  cyan: [56, 189, 248],
};
export const MASK_TINT_ALPHA = 0.45;

/** A luminance mask stretched over the whole box, for a preview that sits exactly over the picture. */
export const boxMaskStyle = (mask: string): CSSProperties => ({
  maskImage: `url("${mask}")`,
  maskMode: 'luminance',
  maskRepeat: 'no-repeat',
  maskSize: '100% 100%',
});

/**
 * A luminance mask covering only `place` of the box, in fractions of its size; the rest shows no weather. Lengths
 * are `cq` units, so the preview's layer must be a size container.
 */
export const placedMaskStyle = (mask: string, place: { left: number; top: number; width: number; height: number }): CSSProperties => ({
  maskImage: `url("${mask}")`,
  maskMode: 'luminance',
  maskRepeat: 'no-repeat',
  maskPosition: `${place.left * 100}cqw ${place.top * 100}cqh`,
  maskSize: `${place.width * 100}cqw ${place.height * 100}cqh`,
});
