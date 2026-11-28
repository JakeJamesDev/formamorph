/** The brush editor's canvas side: reads a stored mask into a raster, draws a raster as a tint, and saves one as a PNG. */
import { grayFromRgba, rgbaFromGray, type MaskRect } from '@/lib/maskDocument';
import { MASK_TINTS, MASK_TINT_ALPHA, type MaskShade } from '@/lib/weatherMask';

/** `read` marks a canvas whose pixels the editor reads back; drawn-only canvases stay on the GPU. */
function context2d(canvas: HTMLCanvasElement, read = false): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', read ? { willReadFrequently: true } : undefined);
  if (!context) throw new Error("This browser can't draw the Weather Mask");
  return context;
}

/** A stored mask as a raster of `width` × `height`, stretched to that box. */
export async function readMaskRaster(data: string, width: number, height: number): Promise<Uint8ClampedArray> {
  const bitmap = await createImageBitmap(await (await fetch(data)).blob());
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = context2d(canvas, true);
    context.drawImage(bitmap, 0, 0, width, height);
    return grayFromRgba(context.getImageData(0, 0, width, height).data);
  } finally {
    bitmap.close();
  }
}

/** Writes `raster`'s `rect` onto `canvas`, the raster's size, one RGBA pixel per mask value. */
function drawPixels(
  canvas: HTMLCanvasElement, raster: Uint8ClampedArray, rect: MaskRect | null | undefined,
  pixel: (value: number, out: Uint8ClampedArray, j: number) => void,
): void {
  const { width } = canvas;
  const r = rect ?? { x0: 0, y0: 0, x1: width, y1: canvas.height };
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  if (w <= 0 || h <= 0) return;
  const context = context2d(canvas);
  const image = context.createImageData(w, h);
  const out = image.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) pixel(raster[(r.y0 + y) * width + r.x0 + x], out, (y * w + x) * 4);
  }
  context.putImageData(image, r.x0, r.y0);
}

/** Draws `raster`'s `rect` onto the tint canvas in `shade`: a see-through tint, or opaque black and white. */
export function drawTint(canvas: HTMLCanvasElement, raster: Uint8ClampedArray, shade: MaskShade, rect?: MaskRect | null): void {
  if (shade === 'blackWhite') {
    drawPixels(canvas, raster, rect, (v, out, j) => { out[j] = out[j + 1] = out[j + 2] = v; out[j + 3] = 255; });
    return;
  }
  const [red, green, blue] = MASK_TINTS[shade];
  drawPixels(canvas, raster, rect, (v, out, j) => {
    out[j] = red;
    out[j + 1] = green;
    out[j + 2] = blue;
    out[j + 3] = v * MASK_TINT_ALPHA;
  });
}

/** `raster` as the weather preview's mask: the same PNG a save makes, kept apart so a preview never reads as one. */
export const previewMaskPng = (raster: Uint8ClampedArray, width: number, height: number): string => encodeMaskRaster(raster, width, height);

/** `raster` as an opaque grayscale PNG data URL. */
export function encodeMaskRaster(raster: Uint8ClampedArray, width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = context2d(canvas);
  const image = context.createImageData(width, height);
  image.data.set(rgbaFromGray(raster));
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
