import { describe, expect, it } from 'vitest';
import { medianOpaqueRGB } from './textureMedian';

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
