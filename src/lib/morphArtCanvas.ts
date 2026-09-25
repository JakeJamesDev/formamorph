import type { Placeholder } from '@/types';
import { describePlaceholders } from './placeholders';
import { letterMask } from './letterMask';
import {
  MORPH_FRAME, MORPH_GOO, MORPH_LETTER, generateMorphArt, morphLetter,
  type MorphArt, type MorphGradient, type MorphPalette,
} from './placeholderArt';

// Morph art drawn to a canvas, for a character card's baked-in picture.

/** The card's pixel size: the art frame at 2.4×. */
export const MORPH_CARD = { width: 480, height: 720 } as const;

type Ctx = CanvasRenderingContext2D;

/** Canvas factory; injectable so tests run without a real canvas. */
export type CardCanvasFactory = (width: number, height: number) => HTMLCanvasElement;

const pageCanvas: CardCanvasFactory = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

/**
 * The SVG goo filter on an RGBA buffer, in place: blurs the alpha with a Gaussian of `sigma` px, then
 * thresholds it to `alpha × scale + offset`. Only the alpha changes; a `source-in` fill reads nothing else.
 */
export function gooMask(data: Uint8ClampedArray, width: number, height: number, sigma: number): void {
  const alpha = new Float32Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3] / 255;
  const spare = new Float32Array(alpha.length);
  // Three box blurs approximate the Gaussian, as browsers render feGaussianBlur.
  for (const size of boxSizes(sigma, 3)) {
    boxBlur(alpha, spare, width, height, (size - 1) / 2, 1, width);
    boxBlur(spare, alpha, height, width, (size - 1) / 2, width, 1);
  }
  const { alphaScale, alphaOffset } = MORPH_GOO;
  for (let i = 0; i < alpha.length; i++) {
    data[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, alpha[i] * alphaScale + alphaOffset)) * 255);
  }
}

/** Box widths whose repeated pass approximates a Gaussian of `sigma`. */
function boxSizes(sigma: number, passes: number): number[] {
  let lower = Math.floor(Math.sqrt((12 * sigma * sigma) / passes + 1));
  if (lower % 2 === 0) lower--;
  const upper = lower + 2;
  const atLower = Math.round((12 * sigma * sigma - passes * lower * lower - 4 * passes * lower - 3 * passes) / (-4 * lower - 4));
  return Array.from({ length: passes }, (_, k) => (k < atLower ? lower : upper));
}

/** One box pass along lines of `length` samples, with transparent pixels past each end. */
function boxBlur(from: Float32Array, to: Float32Array, length: number, lines: number, radius: number, step: number, lineStep: number): void {
  const span = radius * 2 + 1;
  for (let line = 0; line < lines; line++) {
    const base = line * lineStep;
    let sum = 0;
    for (let k = 0; k < Math.min(radius, length); k++) sum += from[base + k * step];
    for (let k = 0; k < length; k++) {
      if (k + radius < length) sum += from[base + (k + radius) * step];
      if (k - radius - 1 >= 0) sum -= from[base + (k - radius - 1) * step];
      to[base + k * step] = sum / span;
    }
  }
}

function gradientFill(ctx: Ctx, { x1, y1, x2, y2 }: MorphGradient, from: string, to: string): CanvasGradient {
  const fill = ctx.createLinearGradient(x1, y1, x2, y2);
  fill.addColorStop(0, from);
  fill.addColorStop(1, to);
  return fill;
}

/** Draws Morph art at card size with the given palette and returns the canvas. */
export function drawMorphCard(art: MorphArt, font: string, palette: MorphPalette, createCanvas: CardCanvasFactory = pageCanvas): HTMLCanvasElement {
  const { width, height } = MORPH_CARD;
  const scale = width / MORPH_FRAME.width;
  const canvas = createCanvas(width, height);
  const layer = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const lctx = layer.getContext('2d', { willReadFrequently: true });
  if (!ctx || !lctx) throw new Error('Canvas unavailable for the card art.');

  // A unit square stretched to the card, so the diagonal runs corner to corner as the SVG's bounding-box gradient does.
  ctx.setTransform(width, 0, 0, height, 0, 0);
  ctx.fillStyle = gradientFill(ctx, { x1: 0, y1: 0, x2: 1, y2: 1 }, ...palette.background);
  ctx.fillRect(0, 0, 1, 1);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const { x, y, pivotX, pivotY, fontSize, fontWeight, strokeWidth } = MORPH_LETTER;
  const bodies: Array<{ gradient: MorphGradient; draw: () => void }> = [
    {
      gradient: art.letter.gradient,
      draw: () => {
        lctx.save();
        lctx.translate(pivotX, pivotY);
        lctx.rotate((art.letter.tilt * Math.PI) / 180);
        lctx.translate(-pivotX, -pivotY);
        lctx.font = `${fontWeight} ${fontSize}px ${font}`;
        lctx.textAlign = 'center';
        lctx.lineJoin = 'round';
        lctx.lineWidth = strokeWidth;
        lctx.fillText(art.letter.char, x, y);
        lctx.strokeText(art.letter.char, x, y);
        lctx.restore();
        for (const drop of art.letter.drops) {
          lctx.beginPath();
          lctx.arc(drop.x, drop.y, drop.r, 0, Math.PI * 2);
          lctx.fill();
        }
      },
    },
    ...art.clusters.map((cluster) => ({
      gradient: cluster.gradient,
      draw: () => {
        for (const lump of cluster.lumps) {
          lctx.beginPath();
          lump.points.forEach(([px, py], k) => (k ? lctx.lineTo(px, py) : lctx.moveTo(px, py)));
          lctx.closePath();
          lctx.fill();
        }
      },
    })),
  ];

  // Each body is drawn white, gooed, then filled with its one gradient, so it shades as a single shape.
  for (const body of bodies) {
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, width, height);
    lctx.setTransform(scale, 0, 0, scale, 0, 0);
    lctx.fillStyle = lctx.strokeStyle = '#fff';
    body.draw();
    const pixels = lctx.getImageData(0, 0, width, height);
    gooMask(pixels.data, width, height, MORPH_GOO.blur * scale);
    lctx.putImageData(pixels, 0, 0);
    lctx.globalCompositeOperation = 'source-in';
    lctx.fillStyle = gradientFill(lctx, body.gradient, palette.body, palette.edge);
    lctx.fillRect(0, 0, MORPH_FRAME.width, MORPH_FRAME.height);
    ctx.drawImage(layer, 0, 0);
  }
  return canvas;
}

/** The app font stack, as the Font setting last set it. */
function appFont(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--app-font').trim() || 'sans-serif';
}

/**
 * A character card's Morph art as a data URL, in the dark-theme colors. Waits for the app font, so the
 * letter is never measured or drawn in a fallback face.
 */
export async function morphCardImage(idSeed: string, name: string, placeholders: readonly Placeholder[]): Promise<string> {
  const letter = morphLetter(name, placeholders);
  const font = appFont();
  const spec = `${MORPH_LETTER.fontWeight} ${MORPH_LETTER.fontSize}px ${font}`;
  await document.fonts.load(spec, letter);
  if (!document.fonts.check(spec, letter)) throw new Error('Could not load the app font for the card picture.');
  const art = generateMorphArt({
    idSeed,
    nameSeed: describePlaceholders(name, placeholders),
    letter,
    readMask: (char, tilt) => letterMask(char, font, tilt),
  });
  return drawMorphCard(art, font, art.palette.dark).toDataURL('image/webp', 0.9);
}
