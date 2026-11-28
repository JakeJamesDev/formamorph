import { describe, expect, it } from 'vitest';
import { FIT_VIEW, zoomAt } from './maskView';
import { StrokePreview } from './strokePreview';

/** A `width` × `height` raster lit at 255 where `lit(x, y)` holds. */
const raster = (width: number, height: number, lit: (x: number, y: number) => boolean) => {
  const out = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (lit(x, y)) out[y * width + x] = 255;
  return out;
};

describe('the stroke preview grid', () => {
  it('at fit covers the whole mask in cells of at most 256 per edge, and places the grid over it', () => {
    const preview = new StrokePreview(new Uint8ClampedArray(1600 * 900), 1600, 900, FIT_VIEW);
    expect({ step: preview.step, cols: preview.cols, rows: preview.rows, x0: preview.x0, y0: preview.y0 }).toEqual({ step: 7, cols: 229, rows: 129, x0: 0, y0: 0 });
    // 229 cells of 7 reach 3 px past the mask's right edge; the placement says so rather than stretching.
    expect(preview.placement()).toEqual({ left: 0, top: 0, width: (229 * 7) / 1600, height: (129 * 7) / 900 });
  });

  it('averages each cell, so a painted edge inside a cell neither spills past it nor shifts', () => {
    // Lit columns 0 to 9: cell 1 (columns 7 to 13) holds 3 lit of 7.
    const preview = new StrokePreview(raster(1600, 900, (x) => x < 10), 1600, 900, FIT_VIEW);
    expect([preview.cells[0], preview.cells[1], preview.cells[2]]).toEqual([255, Math.round((3 * 255) / 7), 0]);
    // Lit columns 4 to 6 only: the top-left pixel of cell 0 is dark, yet the cell reads the 3 lit of 7.
    const right = new StrokePreview(raster(1600, 900, (x) => x >= 4 && x < 7), 1600, 900, FIT_VIEW);
    expect(right.cells[0]).toBe(Math.round((3 * 255) / 7));
  });

  it('zoomed to 800% covers only the mask under the view, one cell per mask pixel', () => {
    const view = zoomAt(FIT_VIEW, 8, 0.5, 0.5);
    const lit = raster(1600, 900, (x, y) => x === 800 && y === 450);
    const preview = new StrokePreview(lit, 1600, 900, view);
    expect(preview.step).toBe(1);
    // The view spans mask columns 700 to 900 and rows 393.75 to 506.25, plus one cell of margin.
    expect({ x0: preview.x0, y0: preview.y0, cols: preview.cols, rows: preview.rows }).toEqual({ x0: 699, y0: 392, cols: 202, rows: 116 });
    expect(preview.cells[(450 - 392) * preview.cols + (800 - 699)]).toBe(255);
    expect(preview.cells.reduce((n, v) => n + (v ? 1 : 0), 0)).toBe(1);
  });

  it('re-averages the cells a stroke touched, and only those', () => {
    const pixels = new Uint8ClampedArray(1600 * 900);
    const preview = new StrokePreview(pixels, 1600, 900, FIT_VIEW);
    pixels.fill(255);
    preview.update({ x0: 7, y0: 0, x1: 14, y1: 7 });
    expect([preview.cells[0], preview.cells[1], preview.cells[2]]).toEqual([0, 255, 0]);
  });

  it('a cell cut short by the mask edge averages only the pixels inside the mask', () => {
    // 1600 = 228 × 7 + 4: the last column of cells holds 4 mask columns, all lit.
    const preview = new StrokePreview(raster(1600, 900, (x) => x >= 1596), 1600, 900, FIT_VIEW);
    expect(preview.cells[preview.cols - 1]).toBe(255);
  });
});
