import { MORPH_FRAME, MORPH_LETTER, type LetterMask } from './placeholderArt';

/** The drawing surface a mask needs; injectable so tests run without a real canvas. */
export type MaskCanvasFactory = (width: number, height: number) => {
  getContext(kind: '2d', options: { willReadFrequently: boolean }): MaskContext | null;
};

type MaskContext = Pick<
  CanvasRenderingContext2D,
  'translate' | 'rotate' | 'fillText' | 'strokeText' | 'getImageData' | 'font' | 'textAlign' | 'lineJoin' | 'lineWidth'
>;

const offscreen: MaskCanvasFactory = (width, height) => {
  // Both canvases give the narrow context this module uses; their full getContext overloads don't narrow to it.
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height) as unknown as ReturnType<MaskCanvasFactory>;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as ReturnType<MaskCanvasFactory>;
};

const fontSpec = (font: string) => `${MORPH_LETTER.fontWeight} ${MORPH_LETTER.fontSize}px ${font}`;

// About 60 KB each; a grid of cards reuses a few dozen letters and tilts.
export const MASK_CACHE_LIMIT = 64;
const cache = new Map<string, LetterMask>();

/**
 * Draws a letter the way Morph art shows it, in `font` at `tilt` degrees, and returns its pixel reader.
 * Masks are cached by letter, font and tilt once the font has loaded. With no 2D context, the mask is empty.
 */
export function letterMask(letter: string, font: string, tilt: number, createCanvas: MaskCanvasFactory = offscreen): LetterMask {
  const key = `${letter}\u0000${font}\u0000${tilt}`;
  const known = cache.get(key);
  if (known) {
    cache.delete(key);
    cache.set(key, known);
    return known;
  }
  const mask = drawMask(letter, font, tilt, createCanvas);
  // A mask drawn in the fallback font is right for now but wrong once the real font arrives.
  if (!fontReady(letter, font)) return mask;
  cache.set(key, mask);
  if (cache.size > MASK_CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  return mask;
}

/** True when `font` can draw `letter` now, so a mask drawn now is the real one. */
export function fontReady(letter: string, font: string): boolean {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  return !fonts || fonts.check(fontSpec(font), letter);
}

/** Resolves once `font` has loaded the face for `letter` and `document.fonts.ready` has settled. */
export async function whenFontReady(letter: string, font: string): Promise<void> {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (!fonts) return;
  // A failed load still settles: the mask then draws in whatever face the browser falls back to.
  await fonts.load(fontSpec(font), letter).catch(() => undefined);
  await fonts.ready;
}

function drawMask(letter: string, font: string, tilt: number, createCanvas: MaskCanvasFactory): LetterMask {
  const { width, height } = MORPH_FRAME;
  const bits = new Uint8Array(width * height);
  const ctx = createCanvas(width, height).getContext('2d', { willReadFrequently: true });
  if (ctx) {
    const { x, y, pivotX, pivotY, strokeWidth } = MORPH_LETTER;
    ctx.translate(pivotX, pivotY);
    ctx.rotate((tilt * Math.PI) / 180);
    ctx.translate(-pivotX, -pivotY);
    ctx.font = fontSpec(font);
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = strokeWidth;
    ctx.fillText(letter, x, y);
    ctx.strokeText(letter, x, y);
    const alpha = ctx.getImageData(0, 0, width, height).data;
    for (let i = 0; i < bits.length; i++) bits[i] = alpha[i * 4 + 3] > 128 ? 1 : 0;
  }
  return {
    width,
    height,
    ink: (px, py) => px >= 0 && py >= 0 && px < width && py < height && bits[py * width + px] === 1,
  };
}
