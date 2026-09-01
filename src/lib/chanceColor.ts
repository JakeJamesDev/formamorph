import type { CSSProperties } from 'react';
import { hexToHsl } from '@/lib/hslColor';
import { clamp } from '@/lib/utils';

/**
 * How a value chip wears its draw chance. Two mappings, one per kind of chip:
 *
 * - A **plain-text** value runs a three-stop ramp over the theme's own tokens — muted at 0%, the secondary
 *   tone every chip already wears at 50%, primary at 100% — so a benched value reads as off, a certain one
 *   reads as fixed, and an even split looks like an ordinary chip. The stops are mixed in OKLab, and
 *   the foreground rides the matching foreground tokens, so the text keeps its contrast at every point.
 * - A **reference** value keeps the identity hue every chip of that placeholder wears, with its saturation
 *   scaled by the chance: full color when certain, a neutral gray of the same lightness when it can never
 *   be drawn.
 *
 * Both are inline styles, which is how reference chips already carry their accent.
 */

const STOPS = [
  { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' },
  { backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))' },
  { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' },
] as const;

export type ChanceStyle = Required<Pick<CSSProperties, 'backgroundColor' | 'color'>>;

const mix = (from: string, to: string, fromShare: number) =>
  `color-mix(in oklab, ${from} ${fromShare}%, ${to})`;

/** The plain-text chip's colors for a draw chance in percent. Clamped to the ramp's ends. */
export function chanceChipStyle(chance: number): ChanceStyle {
  const t = clamp(chance, 0, 100) / 50;
  const segment = Math.min(Math.floor(t), 1);
  const along = t - segment;
  const from = STOPS[segment];
  const to = STOPS[segment + 1];
  if (along === 0) return { ...from };
  if (along === 1) return { ...to };
  const share = Math.round((1 - along) * 100);
  return {
    backgroundColor: mix(from.backgroundColor, to.backgroundColor, share),
    color: mix(from.color, to.color, share),
  };
}

/** A placeholder's identity accent (`#rrggbb`) with its saturation scaled to a draw chance in percent —
 *  the full accent at 100, a neutral gray of the same lightness at 0. */
export function accentAtChance(hex: string, chance: number): string {
  const { h, s, l } = hexToHsl(hex);
  const scaled = Math.round((s * clamp(chance, 0, 100)) / 100);
  return `hsl(${h}, ${scaled}%, ${l}%)`;
}
