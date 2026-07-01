import type { PlayerStat, StatChange } from '@/types';
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
    const key = line.slice(0, sep).trim().toLowerCase();
    if (!key) return;
    const rest = line.slice(sep + 1);
    const match = rest.match(/[+-]?\d+(?:\.\d+)?/);
    if (!match) return;
    const value = Math.round(parseFloat(match[0]));
    if (Number.isNaN(value)) return;
    const bucket = /\bmax\b/i.test(rest) ? maxes : values;
    bucket[key] = (bucket[key] || 0) + value;
  });
  return { values, maxes };
}

/**
 * Apply normalized max-cap deltas to stats. Honors the noIncreaseMax/noDecreaseMax flags,
 * floors the new max at the stat's min, and re-clamps the current value into the new
 * [min, max] range so lowering a cap can't leave the value stranded above it. Pure.
 */
export function applyAiMaxChanges(
  stats: PlayerStat[],
  maxChanges: Record<string, number>,
): PlayerStat[] {
  return stats.map((stat) => {
    const delta = maxChanges[stat.name.toLowerCase()];
    if (typeof delta !== 'number' || delta === 0) return stat;
    const allowed = (delta > 0 && !stat.noIncreaseMax) || (delta < 0 && !stat.noDecreaseMax);
    if (!allowed) return stat;
    const newMax = Math.max(stat.min, stat.max + delta);
    const newValue = clamp(stat.value, stat.min, newMax);
    return { ...stat, max: newMax, value: newValue };
  });
}

/**
 * Apply trait-driven changes (min/max/regen/starting) to stats. Two passes: the
 * first adjusts bounds/regen and collects value adjustments (e.g. raising a floor
 * pulls the value up to it); the second applies 'starting' deltas plus those
 * adjustments, clamping to [min, max]. Returns new stat objects (input is not
 * mutated) and the set of ids that were touched, so the caller can persist them.
 */
export function applyTraitStatChanges(
  stats: PlayerStat[],
  changes: StatChange[],
): { stats: PlayerStat[]; changedIds: Set<string> } {
  const updated = stats.map((s) => ({ ...s }));
  const changedIds = new Set<string>();
  const valueAdjustments = new Map<string, number>();

  // First pass: bounds + regen, collecting value adjustments.
  changes.forEach((change) => {
    const stat = updated.find((s) => s.id === change.statId);
    if (!stat) return;

    if (change.type === 'min') {
      const newMin = Math.max(stat.min, stat.min + change.value);
      stat.min = newMin;
      if (newMin > stat.value) {
        valueAdjustments.set(stat.id, (valueAdjustments.get(stat.id) || 0) + (newMin - stat.value));
      }
    } else if (change.type === 'max') {
      const oldMax = stat.max;
      const newMax = stat.max + change.value;
      stat.max = newMax;
      if (newMax > oldMax && stat.value === oldMax) {
        valueAdjustments.set(stat.id, (valueAdjustments.get(stat.id) || 0) + (newMax - oldMax));
      } else if (newMax < stat.value) {
        valueAdjustments.set(stat.id, (valueAdjustments.get(stat.id) || 0) + (newMax - stat.value));
      }
    } else if (change.type === 'regen') {
      stat.regen = (stat.regen || 0) + change.value;
    }
  });

  // Second pass: 'starting' deltas + collected adjustments, clamped to [min, max].
  changes.forEach((change) => {
    const stat = updated.find((s) => s.id === change.statId);
    if (!stat) return;

    if (change.type === 'starting') {
      stat.value = clamp(stat.value + change.value, stat.min, stat.max);
    }
    const adjustment = valueAdjustments.get(stat.id) || 0;
    if (adjustment !== 0) {
      stat.value = clamp(stat.value + adjustment, stat.min, stat.max);
    }
    changedIds.add(stat.id);
  });

  return { stats: updated, changedIds };
}
