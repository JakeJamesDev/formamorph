/**
 * Which Instrument the Bench stands on, surviving the panel unmounting: one sessionStorage record keyed by
 * world id, on the same lifetime rationale as the lens — a test setup is worth surviving a tab switch or the
 * mobile sheet closing, and not worth greeting the author with next week.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { asBenchTab, type BenchTab } from './benchTabs';
import { createKeyedRecordStore } from '@/lib/keyedStorage';

const store = createKeyedRecordStore('session', 'FORMAMORPH_benchTab');

export const DEFAULT_BENCH_TAB: BenchTab = 'issues';

/** The stored tab for one world — only where it still names a built, routable Instrument. */
function readBenchTab(worldId: string): BenchTab | null {
  const stored = store.read(worldId);
  return typeof stored === 'string' ? asBenchTab(stored) : null;
}

export interface BenchTabHandle {
  tab: BenchTab;
  setTab: (tab: BenchTab) => void;
  /** Show a route-driven tab across the next open without recording it — the remembered tab stays the author's. */
  routeTab: (tab: BenchTab) => void;
}

/**
 * The Bench's open Instrument: seeded when the Bench opens — the session's stored tab where one is remembered,
 * the default otherwise — then the author's own until they switch. A route-driven tab (the dev-router's
 * `bench=` slot) wins exactly one seed and is never written, so it overrides the view, not the memory.
 */
export function useBenchTab(worldId: string | null | undefined, { open }: { open: boolean }): BenchTabHandle {
  const [tab, setTabState] = useState<BenchTab>(DEFAULT_BENCH_TAB);
  const routed = useRef<BenchTab | null>(null);

  // Opening the Bench is the only thing that seeds, so switching worlds mid-session lands each on its own tab.
  useEffect(() => {
    if (!open) return;
    if (routed.current) {
      setTabState(routed.current);
      routed.current = null;
      return;
    }
    setTabState((worldId ? readBenchTab(worldId) : null) ?? DEFAULT_BENCH_TAB);
  }, [open, worldId]);

  const routeTab = useCallback((next: BenchTab) => {
    routed.current = next;
    setTabState(next);
  }, []);

  // Written where the switch happens rather than on a state effect, so the seed itself never writes a record.
  const setTab = useCallback((next: BenchTab) => {
    if (worldId) store.write(worldId, next);
    setTabState(next);
  }, [worldId]);

  return { tab, setTab, routeTab };
}
