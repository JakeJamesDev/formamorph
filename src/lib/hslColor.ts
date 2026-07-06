/** Conversions between the `H S% L%` triples stored in our CSS theme tokens and the `#rrggbb` hex a
 *  native `<input type="color">` speaks. Rounded to integers — fine for a viewer, not a color-science tool. */

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** Parse a token value like `"217 84% 56%"`; returns null if it isn't an HSL triple (e.g. a length). */
export function parseHslTriple(value: string): Hsl | null {
  const m = value.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!m) return null;
  return { h: parseFloat(m[1]), s: parseFloat(m[2]), l: parseFloat(m[3]) };
}

export function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number): string => {
    const k = (n + h / 30) % 12;
    const c = ln - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function hexToHsl(hex: string): Hsl {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** `"#3b82f6"` → `"217 76% 60%"` (rounded), ready to assign to a CSS token. */
export function hexToHslTriple(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  return `${h} ${s}% ${l}%`;
}

/** `"217 84% 56%"` → `"#rrggbb"` for a color input; falls back to black if the value isn't a triple. */
export function hslTripleToHex(value: string): string {
  const parsed = parseHslTriple(value);
  return parsed ? hslToHex(parsed.h, parsed.s, parsed.l) : '#000000';
}
