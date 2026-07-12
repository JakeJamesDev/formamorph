// Pure geometry for the stat bar's animated change band. One model drives every case (an AI-computed
// change, paging between turns, or a band draining away on submit): given the turn's previous and current
// value, it yields the accent-fill width plus the colored band's rectangle and direction. Keeping this
// pure and tested is deliberate — the bar's live/history paths kept diverging when the math lived inline.

/** Clamp a raw stat value to a 0–100 fill percentage within its [min, max] range. */
export function statPct(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

export interface StatBarFrame {
  /** Fill width for the current value — the accent slides from `prevPct` to this. */
  curPct: number;
  /** Fill width for the previous value — the accent's animation origin. */
  prevPct: number;
  /** Left edge of the change band (the lower of prev/cur). */
  bandLeftPct: number;
  /** Width of the change band (|cur − prev| in percent). */
  bandWidthPct: number;
  /** Whether a visible band exists (a non-trivial change). */
  hasBand: boolean;
  /** True when the value rose (green gain); false when it fell (red loss). Meaningless if `!hasBand`. */
  gain: boolean;
}

/**
 * Resolve the bar's geometry from a turn's `prevValue → curValue`. The band spans the region between the
 * two values; `gain` picks its color. `hasBand` guards against sub-pixel bands from rounding. The band's
 * animation origin is chosen by the caller: grow spreads from the `prev` edge, drain collapses toward `cur`.
 */
export function statBarFrame(prevValue: number, curValue: number, min: number, max: number): StatBarFrame {
  const curPct = statPct(curValue, min, max);
  const prevPct = statPct(prevValue, min, max);
  const bandLeftPct = Math.min(curPct, prevPct);
  const bandWidthPct = Math.abs(curPct - prevPct);
  return {
    curPct,
    prevPct,
    bandLeftPct,
    bandWidthPct,
    hasBand: curValue !== prevValue && bandWidthPct > 0.01,
    gain: curValue > prevValue,
  };
}

/**
 * The `transform-origin` edge for the band's scaleX animation. Grow spreads outward from the previous
 * value's edge; drain collapses inward toward the current value's edge (so the value never appears to move).
 * The band rect is `[min(prev,cur), max(prev,cur)]`, so for a gain `prev` is the left edge and `cur` the
 * right; for a loss it's reversed.
 */
export function bandOrigin(gain: boolean, draining: boolean): 'left' | 'right' {
  if (draining) return gain ? 'right' : 'left';
  return gain ? 'left' : 'right';
}
