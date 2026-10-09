import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { HistoryMoveEvent, WorldHistoryControls } from '@/contexts/worldRecorder';
import { revealForMove, type RevealTab } from '@/lib/historyReveal';
import type { FindingSection } from '@/lib/testBench/rules';
import type { ConnectionReveal, SelectionReveal } from '@/managers/LocationCanvas';
import type { LocationView } from '@/views/locationViews';

export interface HistoryRevealOptions {
  onMove: WorldHistoryControls['onMove'];
  /** The Authoring Tour owns the tab and the selection while it runs. */
  touring: boolean;
  /** The tabs this editor mode shows. A Step on a hidden tab reveals nothing. */
  visibleTabs: readonly { value: string }[];
  /** Whether a tab's list holds a record, read after the move's commit. */
  holds: (tab: RevealTab, id: string) => boolean;
  setActiveTab: (tab: string) => void;
  clearSearch: () => void;
  setLocationView: (view: LocationView) => void;
  /** The find bar's route to a record: its tab, a clear list filter, the record selected and scrolled to. */
  navigateToItem: (section: FindingSection, id: string) => void;
}

/**
 * After an undo, redo or jump, shows what came back: the Origin tab and record of an edit made through a
 * mirror, else the tab that owns the touched record, with the record selected. A removed record only opens
 * its tab, where the list drops the stale selection itself. A connection opens the canvas, which takes the
 * returned request.
 */
export function useHistoryReveal(options: HistoryRevealOptions) {
  const [connectionReveal, setConnectionReveal] = useState<ConnectionReveal | null>(null);
  const clearConnectionReveal = useCallback(() => setConnectionReveal(null), []);
  const [selectionReveal, setSelectionReveal] = useState<SelectionReveal | null>(null);
  const clearSelectionReveal = useCallback(() => setSelectionReveal(null), []);
  const latest = useRef(options);
  latest.current = options;
  const { onMove } = options;
  // The move waits for its commit, so each list reads the world the move restored.
  const [move, setMove] = useState<HistoryMoveEvent | null>(null);
  useEffect(() => onMove(setMove), [onMove]);

  useLayoutEffect(() => {
    if (!move) return;
    setMove(null);
    const { touring, visibleTabs, holds, setActiveTab, clearSearch, setLocationView, navigateToItem } = latest.current;
    if (touring) return;
    const target = revealForMove(move.steps, move.world, {
      shows: (tab) => visibleTabs.some((shown) => shown.value === tab),
      holds,
    });
    // A request the canvas never took must not outlive the move that made it.
    setSelectionReveal(null);
    if (!target) return;
    if (target.connection && target.id !== undefined) {
      setActiveTab(target.tab);
      clearSearch();
      setLocationView('canvas');
      setConnectionReveal({ id: target.id, gone: target.gone });
    } else if (target.id !== undefined && !target.gone) {
      navigateToItem(target.tab, target.id);
      // Only the canvas holds more than one selected location, so it must be showing to take them.
      if (target.tab === 'locations' && target.ids) {
        setLocationView('canvas');
        setSelectionReveal({ ids: target.ids });
      }
    } else {
      setActiveTab(target.tab);
    }
  }, [move]);

  return { connectionReveal, clearConnectionReveal, selectionReveal, clearSelectionReveal };
}
