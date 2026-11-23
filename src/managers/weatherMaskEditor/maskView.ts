/**
 * The brush editor's zoom, pan and wheel-driven brush size. Positions are fractions of the fit box, so a resized window keeps the view. At
 * `zoom` the picture is `zoom` boxes wide, and `x`, `y` offset its top-left corner from the box's.
 */
import type { MaskPoint } from '@/lib/maskDocument';

export interface MaskView { zoom: number; x: number; y: number }

/** The contain fit: the whole picture fills the box. */
export const FIT_VIEW: MaskView = { zoom: 1, x: 0, y: 0 };
/** 800% of the fit view. */
export const MAX_ZOOM = 8;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** `view` with its zoom in range and its offset keeping the picture over the whole box. */
export function clampView({ zoom, x, y }: MaskView): MaskView {
  const z = clamp(zoom, 1, MAX_ZOOM);
  return { zoom: z, x: clamp(x, 1 - z, 0), y: clamp(y, 1 - z, 0) };
}

/** Zooms to `zoom` and keeps the picture point under box point (`u`, `v`) in place. */
export function zoomAt(view: MaskView, zoom: number, u: number, v: number): MaskView {
  const z = clamp(zoom, 1, MAX_ZOOM);
  const k = z / view.zoom;
  return clampView({ zoom: z, x: u - (u - view.x) * k, y: v - (v - view.y) * k });
}

/** Moves the picture by (`du`, `dv`) boxes. */
export const panBy = (view: MaskView, du: number, dv: number): MaskView =>
  clampView({ zoom: view.zoom, x: view.x + du, y: view.y + dv });

/** A wheel event's `deltaY` in pixels, whatever unit its `deltaMode` names. */
export const wheelDelta = (deltaY: number, deltaMode: number) => deltaY * (deltaMode === 1 ? 40 : deltaMode === 2 ? 800 : 1);

/** How fast a wheel turn scales the zoom and the brush size, per pixel of delta. */
const WHEEL_RATE = 0.002;

/** The zoom a wheel turn of `delta` pixels reaches: up zooms in. */
export const wheelZoom = (zoom: number, delta: number) => zoom * Math.exp(-delta * WHEEL_RATE);

/** Brush sizes in mask pixels: fine edges up to wide sweeps on a picture at the 1920 cap. */
export const MIN_SIZE = 2;
export const MAX_SIZE = 400;

/** The brush size a Ctrl + wheel turn of `delta` pixels reaches: up grows it, by at least one pixel. */
export function stepSize(size: number, delta: number): number {
  const scaled = Math.round(size * Math.exp(-delta * WHEEL_RATE));
  const next = scaled === size ? size - Math.sign(delta) : scaled;
  return clamp(next, MIN_SIZE, MAX_SIZE);
}

/** The mask pixel under box point (`u`, `v`), for a mask of `width` × `height`. */
export const boxToMask = (view: MaskView, u: number, v: number, width: number, height: number): MaskPoint =>
  ({ x: ((u - view.x) / view.zoom) * width, y: ((v - view.y) / view.zoom) * height });

/** The on-screen width of `size` mask pixels, in a box `boxWidth` wide over a mask `maskWidth` wide. */
export const screenSize = (view: MaskView, size: number, boxWidth: number, maskWidth: number) =>
  (size / maskWidth) * boxWidth * view.zoom;

/** The CSS transform that draws the picture at `view`, with its origin at the top left. */
export const viewTransform = ({ zoom, x, y }: MaskView) => `translate(${x * 100}%, ${y * 100}%) scale(${zoom})`;
