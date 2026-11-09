import { describe, expect, it } from 'vitest';
import { dominantClusterRGB, medianOpaqueRGB, tintFactors, tintSeedRGB } from './textureMedian';

describe('tintSeedRGB', () => {
  it('returns the median under a factor of 1', () => {
    expect(tintSeedRGB([0.55, 0.52, 0.55], [1, 1, 1])).toEqual([0.55, 0.52, 0.55]);
  });

  it('applies a color factor below 1, per channel', () => {
    expect(tintSeedRGB([0.55, 0.5, 0.25], [0, 0.5, 1])).toEqual([0, 0.25, 0.25]);
  });
});

describe('tintFactors', () => {
  const median = [0.8, 0.6, 0.4] as const;
  const white = [1, 1, 1] as const;
  // A warm skin shade under a white base, in the shape VRoid exports.
  const warmShade = [0.93, 0.62, 0.71] as const;
  const seedOf = (m: readonly [number, number, number], f: readonly [number, number, number]) =>
    tintSeedRGB(m, f).map((x) => Math.round(x * 255) / 255) as [number, number, number];

  it('restores both original factors when the target is the seed', () => {
    const { color, shade } = tintFactors(seedOf(median, white), median, white, warmShade);
    expect(color).toEqual([1, 1, 1]);
    expect(shade).toEqual([0.93, 0.62, 0.71]);
  });

  it('restores mid factors exactly, despite the seed rounding to 8 bits', () => {
    const base = [0.7, 0.33, 0.51] as const;
    const origShade = [0.2, 0.3, 0.4] as const;
    const { color, shade } = tintFactors(seedOf(median, base), median, base, origShade);
    expect(color).toEqual([0.7, 0.33, 0.51]);
    expect(shade).toEqual([0.2, 0.3, 0.4]);
  });

  it('keeps the original shade-to-base ratio away from the seed, per channel', () => {
    const { color, shade } = tintFactors([0.4, 0.3, 0.1], median, white, warmShade);
    expect(color[0]).toBeCloseTo(0.5, 5);
    expect(color[1]).toBeCloseTo(0.5, 5);
    expect(color[2]).toBeCloseTo(0.25, 5);
    expect(shade[0]).toBeCloseTo(0.5 * 0.93, 5);
    expect(shade[1]).toBeCloseTo(0.5 * 0.62, 5);
    expect(shade[2]).toBeCloseTo(0.25 * 0.71, 5);
  });

  it('measures the ratio against the original base, not a base of 1', () => {
    const base = [0.5, 0.5, 0.5] as const;
    const { shade } = tintFactors([0.8, 0.6, 0.2], median, base, [0.25, 0.5, 0.1]);
    expect(shade[0]).toBeCloseTo(1 * 0.5, 5);
    expect(shade[1]).toBeCloseTo(1 * 1, 5);
    expect(shade[2]).toBeCloseTo(0.5 * 0.2, 5);
  });

  it('sets a shade equal to its base on a channel whose original base is 0', () => {
    // A hair material with a zero factor: the ratio is 0/0, and the shade must not stay black.
    const { color, shade } = tintFactors([0.4, 0, 0], median, [0, 0, 0], [0, 0, 0]);
    expect(color).toEqual([0.5, 0, 0]);
    expect(shade).toEqual([0.5, 0, 0]);
  });

  it('keeps a nonzero shade on a zero-base channel at its seed', () => {
    const { color, shade } = tintFactors([0, 0, 0], median, [0, 0, 0], [0.3, 0.2, 0.1]);
    expect(color).toEqual([0, 0, 0]);
    expect(shade).toEqual([0.3, 0.2, 0.1]);
  });

  it('caps the color and shade factors at 4', () => {
    const { color, shade } = tintFactors([1, 1, 1], [0.1, 0.1, 0.1], [0.1, 0.1, 0.1], [0.9, 0.9, 0.9]);
    expect(color).toEqual([4, 4, 4]);
    expect(shade).toEqual([4, 4, 4]);
  });

  it('uses the target itself as the factor on a material with no texture', () => {
    const { color, shade } = tintFactors([0.4, 0.2, 0.1], null, white, [0.5, 0.5, 0.5]);
    expect(color).toEqual([0.4, 0.2, 0.1]);
    expect(shade[0]).toBeCloseTo(0.2, 5);
    expect(shade[1]).toBeCloseTo(0.1, 5);
    expect(shade[2]).toBeCloseTo(0.05, 5);
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

describe('dominantClusterRGB', () => {
  const bytes = (rgb: [number, number, number]) => rgb.map((x) => Math.round(x * 255));
  // A skin atlas where black tights outnumber the skin, as on Aki's body.
  const atlas = [...px(60, 44, 43, 255, 45), ...px(40, 30, 30, 255, 15), ...px(249, 212, 185, 255, 40)];

  it('returns the skin on an atlas where dark garments outnumber it', () => {
    expect(bytes(dominantClusterRGB(atlas)!)).toEqual([249, 212, 185]);
  });

  it('differs from the plain median there, which lands on the garment', () => {
    expect(bytes(medianOpaqueRGB(atlas)!)).toEqual([60, 44, 43]);
  });

  it('returns the plain median, within a level, of a gradient, which forms one cluster', () => {
    // Bins at the ramp's ends hold under 1% of the pixels and drop out, so the median may move by one level.
    const ramp = Array.from({ length: 101 }, (_, i) => px(60 + i, 40 + i, 40 + i)).flat();
    const plain = bytes(medianOpaqueRGB(ramp)!);
    bytes(dominantClusterRGB(ramp)!).forEach((v, i) => expect(Math.abs(v - plain[i])).toBeLessThanOrEqual(1));
  });

  it('ignores a bright speck under 1% of the pixels', () => {
    const hair = [...px(70, 40, 40, 255, 300), ...px(255, 255, 255, 255, 2)];
    expect(bytes(dominantClusterRGB(hair)!)).toEqual([70, 40, 40]);
  });

  it('does not count fully transparent pixels', () => {
    const data = [...px(250, 250, 250, 0, 90), ...px(40, 30, 30, 255, 10)];
    expect(bytes(dominantClusterRGB(data)!)).toEqual([40, 30, 30]);
  });

  it('returns null with no opaque pixel', () => {
    expect(dominantClusterRGB(px(5, 5, 5, 0, 4))).toBeNull();
  });
});
