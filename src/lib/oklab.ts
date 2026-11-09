// sRGB ↔ OKLab (Björn Ottosson's matrices), for color blends whose midpoints stay clean rather than muddy.

type Triple = [number, number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const byte = (c: number) => Math.round(Math.max(0, Math.min(1, c)) * 255);

/** `#rrggbb` as 0..1 sRGB channels, or null when it is not one. */
function parseHex(hex: string): Triple | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function srgbToOklab([r, g, b]: Triple): Triple {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

let linearByte: Float64Array | null = null;

/** OKLab lightness (0..1) of sRGB bytes, for per-pixel work: the L row of `srgbToOklab`, without allocations. */
export function oklabLightness(r: number, g: number, b: number): number {
  if (!linearByte) linearByte = Float64Array.from({ length: 256 }, (_, v) => toLinear(v / 255));
  const lr = linearByte[r], lg = linearByte[g], lb = linearByte[b];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

function oklabToSrgb([L, a, b]: Triple): Triple {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** `from` moved toward `to` by `t` (clamped to [0, 1]) in OKLab, as `#rrggbb`. An unreadable `to` leaves `from`. */
export function mixOklab(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  if (!a || !b) return from;
  const share = Math.max(0, Math.min(1, t));
  if (share === 0) return from;
  const la = srgbToOklab(a);
  const lb = srgbToOklab(b);
  const mixed = oklabToSrgb([0, 1, 2].map((i) => la[i] + (lb[i] - la[i]) * share) as Triple);
  return '#' + mixed.map((c) => byte(c).toString(16).padStart(2, '0')).join('');
}

/** One stat's pull on a color: toward `target` by `t`. */
export interface ColorStep {
  target: string;
  t: number;
}

/** `start` after each step in turn. */
export const blendColor = (start: string, steps: readonly ColorStep[]): string =>
  steps.reduce((color, step) => mixOklab(color, step.target, step.t), start);
