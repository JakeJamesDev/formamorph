const MIN_ALPHA = 10;
const MAX_FACTOR = 4;
const MIN_MEDIAN = 0.01;

const toByte = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255);

/** The picker's start color: the texture median under the untinted color factor. Tinting to it restores that factor. */
export function tintSeedRGB(
  median: readonly [number, number, number],
  factor: readonly [number, number, number],
): [number, number, number] {
  return [median[0] * factor[0], median[1] * factor[1], median[2] * factor[2]];
}

/**
 * The color factors that shift a material's texture median to the target, with the shade following the base by the
 * material's original ratio. A channel at its seed keeps its original factors exactly, so picking the seed is the
 * identity. A channel whose original base is 0 has no ratio, so its shade equals its base.
 */
export function tintFactors(
  target: readonly [number, number, number],
  median: readonly [number, number, number] | null,
  origBase: readonly [number, number, number],
  origShade: readonly [number, number, number],
): { color: [number, number, number]; shade: [number, number, number] } {
  const seed = tintSeedRGB(median ?? [1, 1, 1], origBase);
  const color: [number, number, number] = [0, 0, 0];
  const shade: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    if (toByte(target[i]) === toByte(seed[i])) {
      color[i] = origBase[i];
      shade[i] = origShade[i];
      continue;
    }
    color[i] = median ? Math.min(MAX_FACTOR, target[i] / Math.max(median[i], MIN_MEDIAN)) : target[i];
    shade[i] = origBase[i] > 0 ? Math.min(MAX_FACTOR, color[i] * (origShade[i] / origBase[i])) : color[i];
  }
  return { color, shade };
}

/** Per-channel median of the opaque pixels in RGBA data, each channel in 0..1. Null when no pixel is opaque. */
export function medianOpaqueRGB(data: ArrayLike<number>): [number, number, number] | null {
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < MIN_ALPHA) continue;
    hist[0][data[i]]++; hist[1][data[i + 1]]++; hist[2][data[i + 2]]++;
    n++;
  }
  if (!n) return null;
  const half = Math.ceil(n / 2);
  const median = (h: Uint32Array) => {
    let seen = 0;
    for (let v = 0; v < 256; v++) {
      seen += h[v];
      if (seen >= half) return v / 255;
    }
    return 1;
  };
  return [median(hist[0]), median(hist[1]), median(hist[2])];
}
