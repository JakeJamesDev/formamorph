import { useCallback, useEffect, useMemo, useState } from 'react';
import { groupFindings, type Finding, type FindingGroup } from './rules';
import {
  EMPTY_BENCH_STATE,
  partitionFindings,
  readBenchState,
  withDismissed,
  withRestored,
  withSeen,
  withSource,
  writeBenchState,
  type BenchWorldState,
} from './seenState';

export interface BenchFindings {
  /** The rows the Issues list shows: dismissals removed, anything new first within its severity. */
  groups: FindingGroup[];
  /** The muted rows, so the author has a way back to them. */
  dismissedGroups: FindingGroup[];
  /** Rows carrying something the author has not been shown — what the badge reports prominently. */
  newCount: number;
  markAllSeen: () => void;
  dismissRule: (ruleId: string) => void;
  restoreRule: (ruleId: string) => void;
}

/**
 * `findings` placed against what this world's Bench already knows: which rows are new, which are muted, and
 * the actions that change either. State lives in localStorage under the world id and reloads with it; a
 * downloaded world whose source moved on starts over, so an update's own defects can't arrive pre-seen.
 */
export function useBenchFindings(
  worldId: string | null | undefined,
  sourceVersion: string | undefined,
  findings: Finding[],
): BenchFindings {
  // Read on the first render rather than in the effect: the badge is on screen before an effect runs, and an
  // empty record would paint every known finding as new for that frame — the one thing the badge must not do.
  const [state, setState] = useState<BenchWorldState>(
    () => (worldId ? withSource(readBenchState(worldId), sourceVersion) : EMPTY_BENCH_STATE),
  );
  useEffect(() => {
    if (!worldId) { setState(EMPTY_BENCH_STATE); return; }
    const stored = readBenchState(worldId);
    const synced = withSource(stored, sourceVersion);
    if (synced !== stored) writeBenchState(worldId, synced);
    setState(synced);
  }, [worldId, sourceVersion]);

  // The record is written where it changes rather than on a state effect, so a no-op action — closing the
  // Bench twice, dismissing what is already muted — touches neither storage nor the render.
  const apply = useCallback((next: BenchWorldState) => {
    if (next === state) return;
    if (worldId) writeBenchState(worldId, next);
    setState(next);
  }, [worldId, state]);

  const { live, dismissed } = useMemo(() => partitionFindings(findings, state), [findings, state]);
  const groups = useMemo(() => groupFindings(live, (f) => f.isNew), [live]);
  const dismissedGroups = useMemo(() => groupFindings(dismissed), [dismissed]);

  const ofRule = (pool: Finding[], ruleId: string) => pool.filter((f) => f.ruleId === ruleId);

  return {
    groups,
    dismissedGroups,
    newCount: groups.filter((group) => group.newCount > 0).length,
    // Everything the Bench listed counts as shown — muted rows included, since the author chose to stop
    // reading those.
    markAllSeen: useCallback(() => apply(withSeen(state, findings)), [apply, state, findings]),
    dismissRule: useCallback(
      (ruleId: string) => apply(withDismissed(state, ofRule(live, ruleId))),
      [apply, state, live],
    ),
    restoreRule: useCallback(
      (ruleId: string) => apply(withRestored(state, ofRule(dismissed, ruleId))),
      [apply, state, dismissed],
    ),
  };
}
