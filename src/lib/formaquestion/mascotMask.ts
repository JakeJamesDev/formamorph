/** The Mask's geometry: the box a drag on the rig preview gives, and where the base draws in the head view. */
import type { MascotMask } from './mascot';

export interface MascotPoint {
  readonly x: number;
  readonly y: number;
}

export interface MascotSize {
  readonly width: number;
  readonly height: number;
}

/** Where the whole base draws inside a piece, in percent of the piece's box. */
export interface MascotFrame {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A drag smaller than this on either side, in base pixels, is a press: it leaves the Mask alone. */
const MIN_SIDE = 16;

const clamp = (value: number, max: number): number => Math.min(Math.max(value, 0), max);

/** The box between two points in base pixels, cut to the base and rounded to whole pixels. Null for a press or a sliver. */
export function maskFromDrag(from: MascotPoint, to: MascotPoint, base: MascotSize): MascotMask | null {
  const left = Math.round(clamp(Math.min(from.x, to.x), base.width));
  const right = Math.round(clamp(Math.max(from.x, to.x), base.width));
  const top = Math.round(clamp(Math.min(from.y, to.y), base.height));
  const bottom = Math.round(clamp(Math.max(from.y, to.y), base.height));
  if (right - left < MIN_SIDE || bottom - top < MIN_SIDE) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** The Mask cut to the base. No Mask, or one wholly off the base, is the whole base. */
export function fitMask(mask: MascotMask | null, base: MascotSize): MascotMask {
  const whole = { x: 0, y: 0, width: base.width, height: base.height };
  if (!mask) return whole;
  const x = Math.min(mask.x, base.width);
  const y = Math.min(mask.y, base.height);
  const width = Math.min(mask.x + mask.width, base.width) - x;
  const height = Math.min(mask.y + mask.height, base.height) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : whole;
}

/** The head view's box at a height: the Mask's aspect. */
export function headSize(mask: MascotMask, height: number): { w: number; h: number } {
  return { w: (height * mask.width) / mask.height, h: height };
}

/** Where the whole base draws so that the Mask fills the piece. */
export function cropFrame(mask: MascotMask, base: MascotSize): MascotFrame {
  return {
    left: (-mask.x / mask.width) * 100,
    top: (-mask.y / mask.height) * 100,
    width: (base.width / mask.width) * 100,
    height: (base.height / mask.height) * 100,
  };
}
