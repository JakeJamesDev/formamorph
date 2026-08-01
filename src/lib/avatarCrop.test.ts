import { describe, it, expect } from 'vitest';
import { IDENTITY_CROP, MAX_ZOOM, MIN_ZOOM, clampCrop, coverScale, rescaleCrop } from './avatarCrop';

/**
 * The crop geometry.
 *
 * What matters is that the reader cannot end up with something they did not choose: no letterboxing
 * inside the circle, no dragging the picture out from under it, and no silent drift when the preview
 * changes size.
 */

const FRAME = 256;

describe('filling the circle', () => {
  it('scales a wide picture by its shorter side', () => {
    // Cover, not contain: a circle with bars in it reads as a mistake.
    expect(coverScale(1000, 500, FRAME)).toBe(FRAME / 500);
  });

  it('scales a tall picture by its shorter side too', () => {
    expect(coverScale(500, 1000, FRAME)).toBe(FRAME / 500);
  });

  it('leaves a square exactly filling it', () => {
    expect(coverScale(512, 512, FRAME)).toBe(0.5);
  });

  it('says nothing about a picture with no area', () => {
    expect(coverScale(0, 100, FRAME)).toBe(0);
  });
});

describe('holding the pan inside the picture', () => {
  it('allows no travel on a source that only just covers the frame', () => {
    // A square at cover scale has nothing spare in either direction, so every pan clamps to center.
    const clamped = clampCrop({ zoom: 1, offsetX: 80, offsetY: -80 }, 512, 512, FRAME);

    expect(clamped.offsetX).toBeCloseTo(0);
    expect(clamped.offsetY).toBeCloseTo(0);
  });

  it('allows travel along the long axis of a wide picture', () => {
    // 1000x500 at cover scale is 512 wide in a 256 frame, so 128 either way.
    const clamped = clampCrop({ zoom: 1, offsetX: 500, offsetY: 0 }, 1000, 500, FRAME);

    expect(clamped.offsetX).toBe(128);
  });

  it('clamps the other direction the same amount', () => {
    expect(clampCrop({ zoom: 1, offsetX: -500, offsetY: 0 }, 1000, 500, FRAME).offsetX).toBe(-128);
  });

  it('leaves a pan already inside the picture alone', () => {
    expect(clampCrop({ zoom: 1, offsetX: 40, offsetY: 0 }, 1000, 500, FRAME).offsetX).toBe(40);
  });

  it('gives more travel the further in the reader zooms', () => {
    const near = clampCrop({ zoom: 1, offsetX: 9999, offsetY: 0 }, 1000, 500, FRAME).offsetX;
    const far = clampCrop({ zoom: 2, offsetX: 9999, offsetY: 0 }, 1000, 500, FRAME).offsetX;

    expect(far).toBeGreaterThan(near);
  });

  it('holds the zoom inside its own range', () => {
    expect(clampCrop({ ...IDENTITY_CROP, zoom: 99 }, 512, 512, FRAME).zoom).toBe(MAX_ZOOM);
    expect(clampCrop({ ...IDENTITY_CROP, zoom: 0 }, 512, 512, FRAME).zoom).toBe(MIN_ZOOM);
  });
});

describe('a preview that changes size', () => {
  it('carries the pan across in proportion', () => {
    // The offsets are displayed pixels, so a frame that halves would otherwise move the crop.
    expect(rescaleCrop({ zoom: 2, offsetX: 40, offsetY: -20 }, 256, 128))
      .toMatchObject({ zoom: 2, offsetX: 20, offsetY: -10 });
  });

  it('leaves it alone when the frame did not change', () => {
    const transform = { zoom: 2, offsetX: 40, offsetY: -20 };

    expect(rescaleCrop(transform, 256, 256)).toBe(transform);
  });

  it('does not divide by a frame of nothing', () => {
    const transform = { zoom: 1, offsetX: 10, offsetY: 10 };

    expect(rescaleCrop(transform, 0, 256)).toBe(transform);
  });
});
