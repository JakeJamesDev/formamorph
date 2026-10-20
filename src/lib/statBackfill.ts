import type { Stat, PlayerStat } from '@/types';
import { statStartValue } from './statDescriptorGeometry';

/**
 * Reconcile a save's `globalStats` against the world's current stat definitions by appending any stat the
 * world defines but the save lacks (matched by `id`), seeded at its start value (Q8). A save made before a
 * stat was added therefore shows that stat on load instead of silently omitting it forever.
 *
 * Deliberately additive and id-keyed: existing saved stats — which each carry their own full schema
 * (`PlayerStat` is a `Stat` minus the widened value) — are never modified or reordered, so progression and
 * per-save balance are untouched. Stats the world *removed* are left in place rather than pruned (pruning
 * would delete player data). Returns the same array reference when nothing was added.
 */
export function backfillPlayerStats(stats: PlayerStat[], worldStats: Stat[]): PlayerStat[] {
  if (!Array.isArray(stats) || !Array.isArray(worldStats)) return stats;
  const have = new Set(stats.map((s) => s.id));
  const missing = worldStats.filter((s) => s && s.id != null && !have.has(s.id));
  if (missing.length === 0) return stats;
  const seeded = missing.map((s) => ({ ...s, value: statStartValue(s) })) as PlayerStat[];
  return [...stats, ...seeded];
}

/** Apply {@link backfillPlayerStats} to a GameState (a save's current state or a rollback snapshot),
 *  returning the same state reference when nothing changed. */
export function backfillGameStateStats<S extends { globalStats?: PlayerStat[] }>(
  state: S,
  worldStats: Stat[],
): S {
  if (!state || !Array.isArray(state.globalStats)) return state;
  const next = backfillPlayerStats(state.globalStats, worldStats);
  return next === state.globalStats ? state : { ...state, globalStats: next };
}
