// A resolved Layered Image drawn to one bitmap at its canvas size (Q23, Q29), for cards, listings and any surface
// that needs one file. Compositing runs over plain RGBA so it matches play's CSS and tests can read it.

import type { Base64Data, LayerBlend } from '@/types';
import { isLayeredPicture, type LayeredPicture, type Picture } from './layeredImages';
import { fetchAsDataUrl, isRemoteImage } from './imageSource';
import { IMAGE_CAPS } from './imageSlots';

/** Unpremultiplied RGBA pixels, row by row. */
export interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** One Layer ready to compose: its pixels already stretched to the canvas. */
export interface RasterLayer {
  pixels: Raster;
  /** 0 to 1. */
  opacity: number;
  /** `#rrggbb`; absent = no tint. */
  tint?: string;
  blend: LayerBlend;
}

/** A `#rrggbb` tint as 0 to 1 channels. */
const tintChannels = (tint: string | undefined): [number, number, number] =>
  (tint ? [1, 3, 5].map((i) => parseInt(tint.slice(i, i + 2), 16) / 255) as [number, number, number] : [1, 1, 1]);

/** The W3C separable blend of a source channel over a backdrop channel. */
const BLEND: Record<Exclude<LayerBlend, 'add'>, (cb: number, cs: number) => number> = {
  normal: (_cb, cs) => cs,
  multiply: (cb, cs) => cb * cs,
  screen: (cb, cs) => cb + cs - cb * cs,
};

/**
 * The Layers composed bottom first over a transparent canvas, as play's isolated stack draws them (Q34). Tint
 * scales each channel in sRGB and keeps alpha; opacity scales alpha; Normal, Multiply and Screen blend and then
 * composite source-over; Add is `plus-lighter`.
 */
export function composeLayers(width: number, height: number, layers: readonly RasterLayer[]): Raster {
  const size = width * height;
  // Premultiplied color and alpha, kept in floats until the end.
  const color = new Float32Array(size * 3);
  const alpha = new Float32Array(size);
  for (const layer of layers) {
    const src = layer.pixels.data;
    const tint = tintChannels(layer.tint);
    for (let p = 0; p < size; p++) {
      const as = (src[p * 4 + 3] / 255) * layer.opacity;
      if (as === 0) continue;
      const ab = alpha[p];
      for (let c = 0; c < 3; c++) {
        const cs = (src[p * 4 + c] / 255) * tint[c];
        const i = p * 3 + c;
        if (layer.blend === 'add') {
          color[i] = Math.min(1, color[i] + as * cs);
          continue;
        }
        const cb = ab > 0 ? color[i] / ab : 0;
        const mixed = (1 - ab) * cs + ab * BLEND[layer.blend](cb, cs);
        color[i] = as * mixed + color[i] * (1 - as);
      }
      alpha[p] = layer.blend === 'add' ? Math.min(1, ab + as) : as + ab * (1 - as);
    }
  }
  const data = new Uint8ClampedArray(size * 4);
  for (let p = 0; p < size; p++) {
    const a = alpha[p];
    for (let c = 0; c < 3; c++) data[p * 4 + c] = a > 0 ? Math.round((color[p * 3 + c] / a) * 255) : 0;
    data[p * 4 + 3] = Math.round(a * 255);
  }
  return { width, height, data };
}

/** How flattening reads and writes pixels: the browser's canvas by default. */
export interface RasterIO {
  /** An image's natural size. */
  size: (data: Base64Data) => Promise<{ width: number; height: number }>;
  /** An image's pixels stretched to `width` × `height`. */
  read: (data: Base64Data, width: number, height: number) => Promise<Raster>;
  /** Pixels as a data URL. */
  write: (raster: Raster) => Promise<Base64Data>;
}

// A linked image is downloaded first, so its pixels can be read.
const loadImage = async (stored: Base64Data): Promise<HTMLImageElement> => {
  const data = isRemoteImage(stored) ? await fetchAsDataUrl(stored, IMAGE_CAPS.entity) : stored;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read a Layer image.'));
    img.src = data;
  });
};

const context = (width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable.');
  return { canvas, ctx };
};

/** The WebP quality a flattened picture is written at. */
const FLAT_QUALITY = 0.92;

/** The browser's canvas as a raster reader and writer. */
export const CANVAS_IO: RasterIO = {
  size: async (data) => {
    const img = await loadImage(data);
    return { width: img.naturalWidth, height: img.naturalHeight };
  },
  read: async (data, width, height) => {
    const img = await loadImage(data);
    const { ctx } = context(width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const { data: pixels } = ctx.getImageData(0, 0, width, height);
    return { width, height, data: pixels };
  },
  write: async ({ width, height, data }) => {
    const { canvas, ctx } = context(width, height);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
    return canvas.toDataURL('image/webp', FLAT_QUALITY);
  },
};

/** The stack drawn to one image at its canvas image's size, each non-empty Layer stretched to it (Q3). */
export async function flattenLayered(picture: LayeredPicture, io: RasterIO = CANVAS_IO): Promise<Base64Data> {
  const { width, height } = await io.size(picture.canvas);
  const layers: RasterLayer[] = [];
  for (const layer of picture.layers) {
    if (!layer.data) continue;
    layers.push({ pixels: await io.read(layer.data, width, height), opacity: layer.opacity, blend: layer.blend, ...(layer.tint ? { tint: layer.tint } : {}) });
  }
  return io.write(composeLayers(width, height, layers));
}

/** A picture as one file: an image's own data, or a stack flattened. */
export const pictureFile = (picture: Picture, io?: RasterIO): Promise<Base64Data> =>
  (isLayeredPicture(picture) ? flattenLayered(picture, io) : Promise.resolve(picture));
