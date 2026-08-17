import { useCallback, useEffect, useMemo, useState } from 'react';
import { groupFindings, isAdvancedRule, type Finding, type FindingGroup } from './rules';
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
  /** Rows Simple mode folded away because acting on them needs a field it hides. Zero in Advanced mode. */
  advancedOnlyCount: number;
  markAllSeen: () => void;
  dismissRule: (ruleId: string) => void;
  restoreRule: (ruleId: string) => void;
}

/**
 * `findings` placed against what this world's Bench already knows: which rows are new, which are muted, and
 * the actions that change either. State lives in localStorage under the world id and reloads with it; a
 * downloaded world whose source moved on starts over, so an update's own defects can't arrive pre-seen.
 *
 * `advanced` is the editor's own mode. Simple folds away the rows about fields it hides — off the badge, off
 * the list, and out of what closing the Bench marks seen, so one of them first read in Advanced is still new.
 * It defaults to Advanced, matching every surface outside the World Editor's mode switch.
 */
export function useBenchFindings(
  worldId: string | null | undefined,
  sourceVersion: string | undefined,
  findings: Finding[],
  advanced = true,
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
  const shown = useMemo(
    () => (advanced ? live : live.filter((f) => !isAdvancedRule(f.ruleId))),
    [live, advanced],
  );
  const groups = useMemo(() => groupFindings(shown, (f) => f.isNew), [shown]);
  const dismissedGroups = useMemo(() => groupFindings(dismissed), [dismissed]);
  // The fold's number is rows, like every other number the Bench reports — counted off the rule ids rather
  // than by grouping findings nothing is going to render.
  const advancedOnlyCount = useMemo(
    () => (advanced ? 0 : new Set(live.filter((f) => isAdvancedRule(f.ruleId)).map((f) => f.ruleId)).size),
    [live, advanced],
  );
  // What the author was actually shown: the listed rows plus the muted ones they chose to stop reading. In
  // Advanced that is every finding there is; in Simple the folded ones are deliberately left out.
  const displayed = useMemo(() => [...shown, ...dismissed], [shown, dismissed]);

  const ofRule = (pool: Finding[], ruleId: string) => pool.filter((f) => f.ruleId === ruleId);

  return {
    groups,
    dismissedGroups,
    newCount: groups.filter((group) => group.newCount > 0).length,
    advancedOnlyCount,
    markAllSeen: useCallback(() => apply(withSeen(state, displayed)), [apply, state, displayed]),
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
