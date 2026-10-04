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

/** A Mask handle: a corner or side by compass point, or `move` for the box's middle. */
export type MaskGrip = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

/** The edges each handle holds: -1 the left or top edge, 1 the right or bottom, 0 neither. */
const GRIP_EDGES: { readonly [G in Exclude<MaskGrip, 'move'>]: { readonly x: -1 | 0 | 1; readonly y: -1 | 0 | 1 } } = {
  nw: { x: -1, y: -1 }, n: { x: 0, y: -1 }, ne: { x: 1, y: -1 }, e: { x: 1, y: 0 },
  se: { x: 1, y: 1 }, s: { x: 0, y: 1 }, sw: { x: -1, y: 1 }, w: { x: -1, y: 0 },
};

export const MASK_GRIPS: readonly Exclude<MaskGrip, 'move'>[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export const isMaskGrip = (name: string): name is MaskGrip => name === 'move' || (MASK_GRIPS as readonly string[]).includes(name);

/** `value` held to `[low, high]`; an empty range keeps `current`. */
const clampOrKeep = (value: number, low: number, high: number, current: number): number =>
  high < low ? current : Math.min(Math.max(value, low), high);

/** One axis of a handle drag: the edge pair after moving the held edge, inside `[0, size]` and at least the minimum apart. */
function moveEdges(start: number, end: number, edge: -1 | 0 | 1, delta: number, size: number): [number, number] {
  if (edge < 0) return [clampOrKeep(start + delta, 0, end - MIN_SIDE, start), end];
  if (edge > 0) return [start, clampOrKeep(end + delta, start + MIN_SIDE, size, end)];
  return [start, end];
}

/** The Mask after a handle moves by `delta` base pixels, inside the base, at least the minimum size, in whole pixels. */
export function moveMaskGrip(mask: MascotMask, grip: MaskGrip, delta: MascotPoint, base: MascotSize): MascotMask {
  const dx = Math.round(delta.x);
  const dy = Math.round(delta.y);
  if (grip === 'move') {
    return {
      ...mask,
      x: clampOrKeep(mask.x + dx, 0, base.width - mask.width, mask.x),
      y: clampOrKeep(mask.y + dy, 0, base.height - mask.height, mask.y),
    };
  }
  const edges = GRIP_EDGES[grip];
  const [left, right] = moveEdges(mask.x, mask.x + mask.width, edges.x, dx, base.width);
  const [top, bottom] = moveEdges(mask.y, mask.y + mask.height, edges.y, dy, base.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

const ARROWS: ReadonlyMap<string, MascotPoint> = new Map([
  ['ArrowLeft', { x: -1, y: 0 }], ['ArrowRight', { x: 1, y: 0 }], ['ArrowUp', { x: 0, y: -1 }], ['ArrowDown', { x: 0, y: 1 }],
]);

/** The step an arrow key gives a focused handle: one base pixel, ten with Shift. Null off the handle's axis. */
export function gripKeyDelta(grip: MaskGrip, key: string, shift: boolean): MascotPoint | null {
  const arrow = ARROWS.get(key);
  if (!arrow) return null;
  if (grip !== 'move' && ((arrow.x !== 0 && GRIP_EDGES[grip].x === 0) || (arrow.y !== 0 && GRIP_EDGES[grip].y === 0))) return null;
  const step = shift ? 10 : 1;
  return { x: arrow.x * step, y: arrow.y * step };
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

/** The base's box at a height, shrunk at the base's aspect when it runs past `maxWidth`. */
export function sizeWithin(base: MascotSize, height: number, maxWidth: number): { w: number; h: number } {
  const w = (height * base.width) / base.height;
  return w <= maxWidth ? { w, h: height } : { w: maxWidth, h: (maxWidth * base.height) / base.width };
}

/** The head view's box at a height: the Mask's aspect. */
export function headSize(mask: MascotMask, height: number): { w: number; h: number } {
  return { w: (height * mask.width) / mask.height, h: height };
}

/** The head view's box at a height, shrunk at the Mask's aspect when it runs past `maxWidth`. */
export function headSizeWithin(mask: MascotMask, height: number, maxWidth: number): { w: number; h: number } {
  const size = headSize(mask, height);
  return size.w <= maxWidth ? size : { w: maxWidth, h: (maxWidth * mask.height) / mask.width };
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
