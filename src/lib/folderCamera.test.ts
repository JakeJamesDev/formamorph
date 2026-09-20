import { describe, expect, it } from 'vitest';
import { cameraAt, folderCamera, type CameraRect, type CameraTransform } from './folderCamera';

/** A scrolled library board: the grid's corner sits above the viewport, so `top` is negative. */
const OUTER: CameraRect = { left: 16, top: -240, width: 960, height: 1400 };
/** The folder board, pushed down by the folder header and starting at its own scroll top. */
const INNER: CameraRect = { left: 16, top: 92, width: 960, height: 1100 };
/** A medium folder tile, three rows down the scrolled library. */
const TILE: CameraRect = { left: 340, top: 180, width: 224, height: 150 };
/** The part of the folder board the tile's face shows: its top-left corner, well short of the board. */
const REGION_WIDTH = 472;

/** Where a rect inside `layer` lands on screen once `layer` carries `t` about its own corner. */
const imageOf = (layer: CameraRect, rect: CameraRect, t: CameraTransform): CameraRect => ({
  left: layer.left + t.x + (rect.left - layer.left) * t.scale,
  top: layer.top + t.y + (rect.top - layer.top) * t.scale,
  width: rect.width * t.scale,
  height: rect.height * t.scale,
});

/** The region rectangle: the inner board's top-left corner, as wide as the face shows. */
const regionOf = (inner: CameraRect, width: number): CameraRect => ({ ...inner, width });

/**
 * The lock the whole motion rests on: the tile's image in the outer layer and the region's rectangle
 * in the inner layer stand at the same corner and the same width at every moment.
 *
 * Height is left out on purpose. The inner board is taller than the tile's shape, and the clip — not
 * the transform — is what hides the overhang.
 */
const expectLocked = (
  camera: ReturnType<typeof folderCamera>,
  progress: number,
  {
    outer = OUTER, inner = INNER, regionWidth = inner.width,
  }: { outer?: CameraRect; inner?: CameraRect; regionWidth?: number } = {},
) => {
  const at = cameraAt(camera, progress);
  const tileImage = imageOf(outer, TILE, at.outer);
  const regionImage = imageOf(inner, regionOf(inner, regionWidth), at.inner);
  expect(tileImage.left).toBeCloseTo(regionImage.left, 6);
  expect(tileImage.top).toBeCloseTo(regionImage.top, 6);
  expect(tileImage.width).toBeCloseTo(regionImage.width, 6);
};

describe('folderCamera', () => {
  const camera = folderCamera({ tile: TILE, outer: OUTER, inner: INNER, regionWidth: REGION_WIDTH });
  /** The face that shows the whole board, which is what a folder narrower than its cap gives. */
  const full = folderCamera({ tile: TILE, outer: OUTER, inner: INNER });

  it.each([0, 0.5, 1])('locks the tile to the region at progress %s', (progress) => {
    expectLocked(camera, progress, { regionWidth: REGION_WIDTH });
  });

  it.each([0, 0.5, 1])('locks the tile to a full-width region at progress %s', (progress) => {
    expectLocked(full, progress);
  });

  it('starts on the tile and ends on the folder board', () => {
    const start = cameraAt(camera, 0);
    expect(imageOf(OUTER, TILE, start.outer)).toMatchObject({ left: TILE.left, top: TILE.top });
    expect(imageOf(OUTER, TILE, start.outer).width).toBeCloseTo(TILE.width, 6);

    const end = cameraAt(camera, 1);
    expect(imageOf(INNER, INNER, end.inner)).toMatchObject({ left: INNER.left, top: INNER.top });
    expect(imageOf(INNER, INNER, end.inner).width).toBeCloseTo(INNER.width, 6);
  });

  it('zooms the tile up to the region it stands for, not to the whole board', () => {
    expect(camera.scale).toBeCloseTo(REGION_WIDTH / TILE.width, 6);
    expect(full.scale).toBeCloseTo(INNER.width / TILE.width, 6);
    expect(camera.scale).toBeLessThan(full.scale);
  });

  it('reads a region wider than the board as the whole board', () => {
    const overwide = folderCamera({ tile: TILE, outer: OUTER, inner: INNER, regionWidth: INNER.width * 2 });
    expect(overwide.scale).toBeCloseTo(full.scale, 6);
    expect(overwide.clipRight).toBe(0);
  });

  it('clips the inner board to the tile shape at the start', () => {
    expect(camera.clipBottom).toBeCloseTo(INNER.height - TILE.height * camera.scale, 6);
    expect(camera.clipRight).toBeCloseTo(INNER.width - REGION_WIDTH, 6);
  });

  it('cuts nothing from a folder board that already fits the tile shape', () => {
    // Two members make a board shorter than the tile's own shape once it is zoomed down, so there is
    // no overhang to hide and a clip would only pull the board's own bottom edge in.
    const short = { ...INNER, height: 480 };
    const fits = folderCamera({ tile: TILE, outer: OUTER, inner: short });
    expect(short.height / fits.scale).toBeLessThan(TILE.height);
    expect(fits.clipBottom).toBe(0);
    expect(fits.clipRight).toBe(0);
    expectLocked(fits, 0.5, { inner: short });
  });

  it('breaks when the layer-offset term is dropped', () => {
    // The `d` term is the inner layer's corner less the outer layer's. Drop it, as a camera written
    // against an unscrolled board with no header would, and the two layers pull apart. Dropping it
    // from `folderCamera` itself turns the three lock cases above red; this one says why.
    const withoutD = {
      ...camera,
      outer: { ...camera.outer, to: { ...camera.outer.to, x: camera.outer.to.x - (INNER.left - OUTER.left), y: camera.outer.to.y - (INNER.top - OUTER.top) } },
    };
    expect(() => expectLocked(withoutD, 1, { regionWidth: REGION_WIDTH })).toThrow();
    expect(() => expectLocked(withoutD, 0.5, { regionWidth: REGION_WIDTH })).toThrow();
  });
});
