import { describe, expect, it } from 'vitest';
import { MaskStrokePainter } from '@/lib/maskDocument';
import {
  FIT_VIEW, MAX_SIZE, MAX_ZOOM, MIN_SIZE, boxToMask, clampView, panBy, screenSize, stepSize, wheelDelta, wheelZoom, zoomAt, type MaskView,
} from './maskView';

const W = 200;
const H = 100;

/** Paints a stroke through box points at `view` and returns the raster. */
function paint(view: MaskView, points: readonly [number, number][], size = 12) {
  const raster = new Uint8ClampedArray(W * H);
  const painter = new MaskStrokePainter(raster, W, H, 'brush', size, 0.25);
  for (const [u, v] of points) painter.extend(boxToMask(view, u, v, W, H));
  return raster;
}

describe('brush editor view', () => {
  it('a stroke at 200% marks the same mask pixels as the same stroke at fit, scaled by the zoom', () => {
    const atFit: [number, number][] = [[0.3, 0.4], [0.35, 0.45], [0.4, 0.42]];
    const zoomed = zoomAt(FIT_VIEW, 2, 0.5, 0.5);
    expect(zoomed).toEqual({ zoom: 2, x: -0.5, y: -0.5 });
    const scaled = atFit.map(([u, v]): [number, number] => [u * 2 + zoomed.x, v * 2 + zoomed.y]);
    const fit = paint(FIT_VIEW, atFit);
    expect(fit.some((p) => p > 0)).toBe(true);
    expect(paint(zoomed, scaled)).toEqual(fit);
  });

  it('keeps the brush size in mask pixels while its ring grows with the zoom', () => {
    const one = paint(FIT_VIEW, [[0.5, 0.5]]).filter((p) => p > 0).length;
    const two = paint(zoomAt(FIT_VIEW, 2, 0.5, 0.5), [[0.5, 0.5]]).filter((p) => p > 0).length;
    expect(two).toBe(one);
    expect(screenSize(FIT_VIEW, 40, 800, 1600)).toBe(20);
    expect(screenSize({ zoom: 4, x: 0, y: 0 }, 40, 800, 1600)).toBe(80);
  });

  it('keeps the picture point under the pointer fixed as the wheel zooms', () => {
    let view = FIT_VIEW;
    const before = boxToMask(view, 0.2, 0.7, W, H);
    for (let i = 0; i < 5; i++) {
      view = zoomAt(view, wheelZoom(view.zoom, -100), 0.2, 0.7);
      const after = boxToMask(view, 0.2, 0.7, W, H);
      expect(after.x).toBeCloseTo(before.x, 9);
      expect(after.y).toBeCloseTo(before.y, 9);
    }
    expect(view.zoom).toBeGreaterThan(2);
  });

  it('stops at the fit view and at 800%', () => {
    expect(zoomAt(FIT_VIEW, 0.5, 0.3, 0.3)).toEqual(FIT_VIEW);
    expect(zoomAt({ zoom: 6, x: -2, y: -2 }, 50, 0.5, 0.5).zoom).toBe(MAX_ZOOM);
    // Zooming back out to fit recenters, whatever the pointer.
    expect(zoomAt({ zoom: 3, x: -1, y: -0.5 }, 1, 0.9, 0.1)).toEqual(FIT_VIEW);
  });

  it('pans only inside the picture bounds', () => {
    const view: MaskView = { zoom: 2, x: -0.5, y: -0.5 };
    expect(panBy(view, 0.2, -0.1)).toEqual({ zoom: 2, x: -0.3, y: -0.6 });
    expect(panBy(view, 3, -3)).toEqual({ zoom: 2, x: 0, y: -1 });
    expect(panBy(FIT_VIEW, 0.3, 0.3)).toEqual(FIT_VIEW);
    expect(clampView({ zoom: 1.5, x: 0.2, y: -2 })).toEqual({ zoom: 1.5, x: 0, y: -0.5 });
  });

  it('steps the brush size by at least one pixel per wheel turn, inside its range', () => {
    expect(stepSize(100, -100)).toBeGreaterThan(100);
    expect(stepSize(100, 100)).toBeLessThan(100);
    expect(stepSize(10, -4)).toBe(11);
    expect(stepSize(10, 4)).toBe(9);
    expect(stepSize(MAX_SIZE, -1000)).toBe(MAX_SIZE);
    expect(stepSize(MIN_SIZE, 1000)).toBe(MIN_SIZE);
  });

  it('reads line and page wheel deltas as pixels', () => {
    expect(wheelDelta(3, 1)).toBe(120);
    expect(wheelDelta(1, 2)).toBe(800);
    expect(wheelDelta(53, 0)).toBe(53);
  });
});
