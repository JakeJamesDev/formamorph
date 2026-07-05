// Small color helpers for the accent-color setting. shadcn CSS variables (e.g. `--primary`) store colors as
// an unwrapped `H S% L%` triple (Tailwind wraps them in `hsl(...)`), so a picked hex must be converted to
// that form, and a contrasting foreground chosen so text stays readable on the accent.

/** Parse a `#rgb` or `#rrggbb` string to `[r, g, b]` (0–255), or null if malformed. */
export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance (0–1) via the sRGB/WCAG formula — used to pick a contrasting text color. */
export function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Convert a hex color to the `H S% L%` triple shadcn CSS variables use. Null if the hex is invalid. */
export function hexToHslTriple(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const round = (n: number) => Math.round(n * 10) / 10;
  return `${round(h)} ${round(s * 100)}% ${round(l * 100)}%`;
}

/** A readable foreground triple (near-black or off-white) for text placed on `hex`, chosen by luminance. */
export function contrastForeground(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '210 40% 98%';
  return luminance(rgb) > 0.45 ? '222.2 84% 4.9%' : '210 40% 98%';
}
