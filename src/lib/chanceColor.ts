import type { CSSProperties } from 'react';
import { hexToHsl } from '@/lib/hslColor';
import { clamp } from '@/lib/utils';

/**
 * How a value chip wears its draw chance. The chance is **relative**: a value's own chance against the
 * strongest sibling of its placeholder, so an even split reads as a row of ordinary chips and only a
 * value that is less likely than another fades. Two mappings, one per kind of chip:
 *
 * - A **plain-text** value at full is the secondary chip every chip already wears. Below full it mixes in
 *   OKLab toward a **benched** look — muted background, muted-foreground text, reduced opacity. Background
 *   mixes only surface tokens and text only foreground tokens, so the pair keeps its contrast the whole
 *   way; the opacity is the visible cue, since muted and secondary share one tone in the shipped themes.
 * - A **reference** value keeps the identity hue every chip of that placeholder wears, with its saturation
 *   scaled by the relative chance. At 0 it snaps to the same benched look: a chip that can never be drawn
 *   is a benched chip, whatever kind it is.
 *
 * Both are inline styles, which is how reference chips already carry their accent.
 */

export type ChanceStyle = Required<Pick<CSSProperties, 'backgroundColor' | 'color'>> & { opacity: number };

const FULL: ChanceStyle = {
  backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', opacity: 1,
};

/** The look of a value that cannot be drawn, shared by both kinds of chip. */
export const BENCHED: ChanceStyle = {
  backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', opacity: 0.6,
};

/** A value's chance against the strongest value of its placeholder, 0–100. `chances` is the whole value list,
 *  this value included. A benched value never sets the max, and a placeholder with nothing drawable reads 0
 *  throughout. */
export function relativeChance(chance: number, chances: readonly number[]): number {
  const max = Math.max(0, ...chances);
  if (max <= 0) return 0;
  return clamp((chance / max) * 100, 0, 100);
}

const mix = (from: string, to: string, fromShare: number) =>
  `color-mix(in oklab, ${from} ${fromShare}%, ${to})`;

/** The plain-text chip's look for a relative chance in percent. Clamped to the ramp's ends. */
export function chanceChipStyle(rel: number): ChanceStyle {
  const share = Math.round(clamp(rel, 0, 100));
  if (share === 100) return { ...FULL };
  if (share === 0) return { ...BENCHED };
  return {
    backgroundColor: mix(FULL.backgroundColor, BENCHED.backgroundColor, share),
    color: mix(FULL.color, BENCHED.color, share),
    opacity: BENCHED.opacity + ((FULL.opacity - BENCHED.opacity) * share) / 100,
  };
}

/** A reference chip's look: the placeholder's identity accent (`#rrggbb`) with its saturation scaled to a
 *  relative chance in percent — the full accent at 100, the benched look at 0. */
export function accentAtChance(hex: string, rel: number): ChanceStyle {
  const share = clamp(rel, 0, 100);
  if (share === 0) return { ...BENCHED };
  const { h, s, l } = hexToHsl(hex);
  return { backgroundColor: `hsl(${h}, ${Math.round((s * share) / 100)}%, ${l}%)`, color: '#000', opacity: 1 };
}
