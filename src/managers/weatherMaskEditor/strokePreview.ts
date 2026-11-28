/**
 * The weather preview's mask while a stroke paints: only the part of the mask under the view, averaged into a grid
 * whose long edge stays within `STROKE_PREVIEW_EDGE`. Zoomed in far enough, a cell is one mask pixel and the preview
 * is exact; at fit, a cell is about one screen pixel. Pure: it holds no canvas.
 */
import type { MaskRect } from '@/lib/maskDocument';
import { boxToMask, type MaskView } from './maskView';

/** The longest edge of the stroke preview's grid, in cells, so each frame's encode stays cheap. */
export const STROKE_PREVIEW_EDGE = 256;

/** Where a grid sits over the mask, in fractions of the mask's width and height. */
export interface MaskPlacement { left: number; top: number; width: number; height: number }

export class StrokePreview {
  /** The grid's top-left mask pixel. */
  readonly x0: number;
  readonly y0: number;
  /** Mask pixels per cell side. */
  readonly step: number;
  readonly cols: number;
  readonly rows: number;
  /** Each cell's average over the mask pixels it covers, row by row. */
  readonly cells: Uint8ClampedArray;

  constructor(
    private readonly raster: Uint8ClampedArray,
    private readonly width: number,
    private readonly height: number,
    view: MaskView,
    edge = STROKE_PREVIEW_EDGE,
  ) {
    const a = boxToMask(view, 0, 0, width, height);
    const b = boxToMask(view, 1, 1, width, height);
    const left = Math.max(0, Math.floor(a.x));
    const top = Math.max(0, Math.floor(a.y));
    const right = Math.min(width, Math.ceil(b.x));
    const bottom = Math.min(height, Math.ceil(b.y));
    this.step = Math.max(1, Math.ceil(Math.max(right - left, bottom - top) / edge));
    // One cell of margin, so the view's edge never falls on the grid's clamped border.
    this.x0 = Math.max(0, left - this.step);
    this.y0 = Math.max(0, top - this.step);
    this.cols = Math.max(1, Math.ceil((Math.min(width, right + this.step) - this.x0) / this.step));
    this.rows = Math.max(1, Math.ceil((Math.min(height, bottom + this.step) - this.y0) / this.step));
    this.cells = new Uint8ClampedArray(this.cols * this.rows);
    this.update({ x0: 0, y0: 0, x1: width, y1: height });
  }

  /** Re-averages the cells over `rect` after the raster changed there. */
  update(rect: MaskRect): void {
    const { step, x0, y0, width, height, raster } = this;
    const c0 = Math.max(0, Math.floor((rect.x0 - x0) / step));
    const r0 = Math.max(0, Math.floor((rect.y0 - y0) / step));
    const c1 = Math.min(this.cols, Math.ceil((rect.x1 - x0) / step));
    const r1 = Math.min(this.rows, Math.ceil((rect.y1 - y0) / step));
    for (let r = r0; r < r1; r++) {
      const py0 = y0 + r * step;
      const py1 = Math.min(height, py0 + step);
      for (let c = c0; c < c1; c++) {
        const px0 = x0 + c * step;
        const px1 = Math.min(width, px0 + step);
        let sum = 0;
        for (let y = py0; y < py1; y++) {
          for (let x = px0; x < px1; x++) sum += raster[y * width + x];
        }
        // A cell cut short by the mask's edge averages only the pixels it holds.
        this.cells[r * this.cols + c] = Math.round(sum / Math.max(1, (px1 - px0) * (py1 - py0)));
      }
    }
  }

  /** Where the grid sits: a cell cut short by the mask's edge still spans a full step, so the grid can reach past it. */
  placement(): MaskPlacement {
    return {
      left: this.x0 / this.width,
      top: this.y0 / this.height,
      width: (this.cols * this.step) / this.width,
      height: (this.rows * this.step) / this.height,
    };
  }
}
