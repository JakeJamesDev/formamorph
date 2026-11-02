import { describe, expect, it } from 'vitest';
import { medianOpaqueRGB, tintSeedRGB } from './textureMedian';

describe('tintSeedRGB', () => {
  it('returns the median under a factor of 1', () => {
    expect(tintSeedRGB([0.55, 0.52, 0.55], [1, 1, 1])).toEqual([0.55, 0.52, 0.55]);
  });

  it('applies a color factor below 1, per channel', () => {
    expect(tintSeedRGB([0.55, 0.5, 0.25], [0, 0.5, 1])).toEqual([0, 0.25, 0.25]);
  });
});

const px = (r: number, g: number, b: number, a = 255, count = 1) =>
  Array.from({ length: count }, () => [r, g, b, a]).flat();

describe('medianOpaqueRGB', () => {
  it('ignores large dark areas that would drag a mean down', () => {
    // 70 skin pixels + 30 near-black pixels: mean ≈ 0.64 of skin, median is skin.
    const data = [...px(200, 150, 120, 255, 70), ...px(10, 10, 10, 255, 30)];
    const [r, g, b] = medianOpaqueRGB(data)!;
    expect(r).toBeCloseTo(200 / 255, 5);
    expect(g).toBeCloseTo(150 / 255, 5);
    expect(b).toBeCloseTo(120 / 255, 5);
  });

  it('does not count fully transparent pixels', () => {
    const data = [...px(0, 0, 0, 0, 90), ...px(200, 150, 120, 255, 10)];
    expect(medianOpaqueRGB(data)![0]).toBeCloseTo(200 / 255, 5);
  });

  it('returns null with no opaque pixel', () => {
    expect(medianOpaqueRGB(px(5, 5, 5, 0, 4))).toBeNull();
  });
});
