import type { PlayerStat, StatChange } from '@/types';

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
        const newValue = Math.max(stat.min, Math.min(stat.max, stat.value + change));
        return { ...stat, value: newValue };
      }
    }
    return stat;
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
      stat.value = Math.max(stat.min, Math.min(stat.max, stat.value + change.value));
    }
    const adjustment = valueAdjustments.get(stat.id) || 0;
    if (adjustment !== 0) {
      stat.value = Math.max(stat.min, Math.min(stat.max, stat.value + adjustment));
    }
    changedIds.add(stat.id);
  });

  return { stats: updated, changedIds };
}
