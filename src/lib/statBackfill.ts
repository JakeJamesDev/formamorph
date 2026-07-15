import type { Stat, PlayerStat } from '@/types';

/**
 * Reconcile a save's `playerStats` against the world's current stat definitions by appending any stat the
 * world defines but the save lacks (matched by `id`), seeded at its starting value. A save made before a
 * stat was added therefore shows that stat on load instead of silently omitting it forever.
 *
 * Deliberately additive and id-keyed: existing saved stats — which each carry their own full schema
 * (`PlayerStat` is a `Stat` minus the widened value) — are never modified or reordered, so progression and
 * per-save balance are untouched. Stats the world *removed* are left in place rather than pruned (pruning
 * would delete player data). Returns the same array reference when nothing was added.
 */
export function backfillPlayerStats(playerStats: PlayerStat[], worldStats: Stat[]): PlayerStat[] {
  if (!Array.isArray(playerStats) || !Array.isArray(worldStats)) return playerStats;
  const have = new Set(playerStats.map((s) => s.id));
  const missing = worldStats.filter((s) => s && s.id != null && !have.has(s.id));
  if (missing.length === 0) return playerStats;
  const seeded = missing.map((s) => ({
    ...s,
    // PlayerStat.value is a number; prefer the definition's starting value, then any numeric live value,
    // then the floor. (List-type stats aren't represented in runtime playerStats, so a number is correct.)
    value: typeof s.starting === 'number' ? s.starting
      : typeof s.value === 'number' ? s.value
      : s.min ?? 0,
  })) as PlayerStat[];
  return [...playerStats, ...seeded];
}

/** Apply {@link backfillPlayerStats} to a GameState (a save's current state or a rollback snapshot),
 *  returning the same state reference when nothing changed. */
export function backfillGameStateStats<S extends { playerStats?: PlayerStat[] }>(
  state: S,
  worldStats: Stat[],
): S {
  if (!state || !Array.isArray(state.playerStats)) return state;
  const next = backfillPlayerStats(state.playerStats, worldStats);
  return next === state.playerStats ? state : { ...state, playerStats: next };
}
