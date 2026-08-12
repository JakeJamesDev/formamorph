import type { PlayerStat } from '@/types';
import { clamp } from './utils';

/**
 * Merge an array of AI stat-change objects (each a name→delta map) into one map
 * keyed by lowercased stat name, summing deltas when a name repeats.
 */
export function normalizeStatChanges(
  changes: Record<string, number>[],
): Record<string, number> {
  return changes.reduce<Record<string, number>>((acc, changeObj) => {
    Object.entries(changeObj).forEach(([key, value]) => {
      const k = key.toLowerCase();
      acc[k] = (acc[k] || 0) + value;
    });
    return acc;
  }, {});
}

/**
 * Apply normalized AI deltas to a stats array. Honors the noIncrease/noDecrease
 * editor flags and clamps each result to [min, max]. `affectedStats` (by name)
 * restricts which stats may change; null means all. Returns a new stat object for
 * each one that changed and the original reference otherwise (pure).
 */
export function applyAiStatChanges(
  stats: PlayerStat[],
  normalizedChanges: Record<string, number>,
  affectedStats: string[] | null = null,
): PlayerStat[] {
  return stats.map((stat) => {
    if (affectedStats === null || affectedStats.includes(stat.name)) {
      const change =
        typeof normalizedChanges[stat.name.toLowerCase()] === 'number'
          ? normalizedChanges[stat.name.toLowerCase()]
          : 0;
      const shouldUpdate =
        (change > 0 && !stat.noIncrease) || (change < 0 && !stat.noDecrease);
      if (shouldUpdate) {
        const newValue = clamp(stat.value + change, stat.min, stat.max);
        return { ...stat, value: newValue };
      }
    }
    return stat;
  });
}

/**
 * Parse a raw AI stat-updates response into normalized deltas: `values` are changes to
 * current value, `maxes` are changes to the stat's maximum (lines containing a whole-word
 * "MAX"). Keys are lowercased and repeats are summed; numbers are rounded to integers.
 */
export function parseStatUpdates(text: string): {
  values: Record<string, number>;
  maxes: Record<string, number>;
} {
  const values: Record<string, number> = {};
  const maxes: Record<string, number> = {};
  (text || '').split('\n').forEach((line) => {
    const sep = line.indexOf(':');
    if (sep === -1) return;
    // Strip leading bullet/emphasis and trailing emphasis a model may copy from the bulleted stat list
    // ("- **Vigor:**", "**Resolve:**") so the name still matches; markdown decoration never changes the stat.
    const key = line.slice(0, sep).replace(/^[\s*_-]+/, '').replace(/[\s*_]+$/, '').toLowerCase();
    if (!key) return;
    const rest = line.slice(sep + 1);
    const match = rest.match(/[+-]?\d+(?:\.\d+)?/);
    if (!match) return;
    // A number immediately followed by '/' is a display echo (e.g. "25/100"), never a delta — skip the line so
    // a weak model's format drift can't be mis-applied as a change.
    if (/^\s*\//.test(rest.slice((match.index ?? 0) + match[0].length))) return;
    const value = Math.round(parseFloat(match[0]));
    if (Number.isNaN(value)) return;
    const bucket = /\bmax\b/i.test(rest) ? maxes : values;
    bucket[key] = (bucket[key] || 0) + value;
  });
  return { values, maxes };
}

/**
 * Apply normalized max-cap deltas to stats. Percentage stats are skipped (their cap is pinned at 100).
 * Honors the noIncreaseMax/noDecreaseMax flags, floors the new max at the stat's min, and re-clamps the
 * current value into the new [min, max] range so lowering a cap can't leave the value stranded above it. Pure.
 *
 * The movement is also accumulated into `aiMaxDelta`, which is what keeps the maximum derivable: a later
 * trait toggle recomputes the cap from base + traits + this, so the AI's work survives the recompute.
 */
export function applyAiMaxChanges(
  stats: PlayerStat[],
  maxChanges: Record<string, number>,
): PlayerStat[] {
  return stats.map((stat) => {
    // Percentage stats are pinned to a 0–100 cap; the AI can never move their max.
    if (stat.type === 'percentage') return stat;
    const delta = maxChanges[stat.name.toLowerCase()];
    if (typeof delta !== 'number' || delta === 0) return stat;
    const allowed = (delta > 0 && !stat.noIncreaseMax) || (delta < 0 && !stat.noDecreaseMax);
    if (!allowed) return stat;
    const newMax = Math.max(stat.min, stat.max + delta);
    const newValue = clamp(stat.value, stat.min, newMax);
    // Record what the cap actually moved, not what was asked for, so a delta the floor refused isn't
    // resurrected the next time bounds are re-derived.
    const aiMaxDelta = (stat.aiMaxDelta ?? 0) + (newMax - stat.max);
    return { ...stat, max: newMax, value: newValue, aiMaxDelta };
  });
}

/**
 * Per-turn stat change map for the immersive history view: each stat's value minus what it was on the
 * previous turn (`prevStats`), keyed by lowercased name. When there is no previous turn — the opening turn,
 * where `prevStats` is undefined — it falls back to the stat's own `starting` value (else `min`), so the
 * first turn still shows the change it produced from the pre-game baseline. Pure.
 */
export function pageStatDeltas(
  stats: readonly PlayerStat[],
  prevStats: readonly PlayerStat[] | undefined,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of stats) {
    const before = prevStats?.find((p) => p.name === s.name)?.value ?? s.starting ?? s.min;
    map[s.name.toLowerCase()] = typeof before === 'number' ? s.value - before : 0;
  }
  return map;
}

/**
 * The *actual* per-stat change between two same-ordered stat arrays (`after[i]` vs `before[i]`), keyed by
 * lowercased name, omitting stats that didn't move. Use this — not the AI's requested deltas — to drive the
 * live bar/text feedback, so a change clamped at a cap (or blocked by noIncrease/noDecrease) shows the real
 * movement and stays consistent with the history view's value-diff deltas.
 */
export function appliedStatDeltas(
  before: readonly PlayerStat[],
  after: readonly PlayerStat[],
): Record<string, number> {
  const map: Record<string, number> = {};
  after.forEach((s, i) => {
    const delta = s.value - (before[i]?.value ?? s.value);
    if (delta !== 0) map[s.name.toLowerCase()] = delta;
  });
  return map;
}
