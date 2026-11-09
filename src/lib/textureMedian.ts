import { oklabLightness } from "./oklab";

const MIN_ALPHA = 10;
const MAX_FACTOR = 4;
const MIN_MEDIAN = 0.01;

/** A 0..1 channel as a clamped 0..255 byte. */
export const toByte = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255);

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
  return medianWhere(data, (i) => data[i + 3] >= MIN_ALPHA);
}

const L_BINS = 32;
const MIN_RUN_SHARE = 0.01;

/**
 * A material's own color from its dominant cluster: opaque pixels split into runs of adjacent, populated OKLab
 * lightness bins, and the run carrying the most light wins, so dark garments baked into a skin atlas don't pull
 * it. A gradient forms one run and returns the plain median. Per-channel median of that run, each in 0..1; null
 * when no pixel is opaque.
 */
export function dominantClusterRGB(data: ArrayLike<number>): [number, number, number] | null {
  const bins = new Uint8Array(data.length >> 2).fill(255);
  const hist = new Uint32Array(L_BINS);
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < MIN_ALPHA) continue;
    const bin = Math.min(L_BINS - 1, Math.max(0, Math.floor(oklabLightness(data[i], data[i + 1], data[i + 2]) * L_BINS)));
    bins[i >> 2] = bin; hist[bin]++; n++;
  }
  if (!n) return null;
  const floor = MIN_RUN_SHARE * n;
  // Some bin holds at least 1/L_BINS of the pixels, above the floor, so a run always replaces this.
  let best: [number, number] = [0, L_BINS - 1];
  let bestLight = -1;
  for (let lo = 0; lo < L_BINS; lo++) {
    if (hist[lo] < floor) continue;
    let hi = lo, light = 0;
    while (hi < L_BINS && hist[hi] >= floor) { light += hist[hi] * (hi + 0.5); hi++; }
    if (light > bestLight) { bestLight = light; best = [lo, hi - 1]; }
    lo = hi;
  }
  const [lo, hi] = best;
  return medianWhere(data, (i) => bins[i >> 2] >= lo && bins[i >> 2] <= hi);
}

/** Per-channel median of the pixels `keep` accepts, by RGBA offset. */
function medianWhere(data: ArrayLike<number>, keep: (i: number) => boolean): [number, number, number] | null {
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (!keep(i)) continue;
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
