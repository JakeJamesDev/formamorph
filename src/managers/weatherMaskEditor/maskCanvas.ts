/** The brush editor's canvas side: reads a stored mask into a raster, draws a raster as a tint, and saves one as a PNG. */
import { grayFromRgba, rgbaFromGray, type MaskRect } from '@/lib/maskDocument';

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true });
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
    const context = context2d(canvas);
    context.drawImage(bitmap, 0, 0, width, height);
    return grayFromRgba(context.getImageData(0, 0, width, height).data);
  } finally {
    bitmap.close();
  }
}

/** The tint's color: white in the mask shows it at `TINT_ALPHA`. */
const TINT = [56, 189, 248] as const;
const TINT_ALPHA = 0.45;

/** Draws `raster`'s `rect` onto the tint canvas, which is the raster's size. */
export function drawTint(canvas: HTMLCanvasElement, raster: Uint8ClampedArray, rect?: MaskRect | null): void {
  const { width } = canvas;
  const r = rect ?? { x0: 0, y0: 0, x1: width, y1: canvas.height };
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  if (w <= 0 || h <= 0) return;
  const context = context2d(canvas);
  const image = context.createImageData(w, h);
  const out = image.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const j = (y * w + x) * 4;
      out[j] = TINT[0];
      out[j + 1] = TINT[1];
      out[j + 2] = TINT[2];
      out[j + 3] = raster[(r.y0 + y) * width + r.x0 + x] * TINT_ALPHA;
    }
  }
  context.putImageData(image, r.x0, r.y0);
}

/** The longest edge of the live preview's mask, so a stroke's re-encode stays cheap. */
const PREVIEW_EDGE = 256;

/** `raster` as a small grayscale PNG for the weather preview, sampled down to `PREVIEW_EDGE`. */
export function previewMaskPng(raster: Uint8ClampedArray, width: number, height: number): string {
  const step = Math.max(1, Math.ceil(Math.max(width, height) / PREVIEW_EDGE));
  const w = Math.max(1, Math.floor(width / step));
  const h = Math.max(1, Math.floor(height / step));
  const small = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) small[y * w + x] = raster[y * step * width + x * step];
  }
  return encodeMaskRaster(small, w, h);
}

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
