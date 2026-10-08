import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorldHistoryControls } from '@/contexts/worldRecorder';
import { revealTargetForMove } from '@/lib/historyReveal';
import type { FindingSection } from '@/lib/testBench/rules';
import type { ConnectionReveal } from '@/managers/LocationCanvas';
import type { LocationView } from '@/views/locationViews';

export interface HistoryRevealOptions {
  onMove: WorldHistoryControls['onMove'];
  /** The Authoring Tour owns the tab and the selection while it runs. */
  touring: boolean;
  /** The tabs this editor mode shows. A Step on a hidden tab reveals nothing. */
  visibleTabs: readonly { value: string }[];
  setActiveTab: (tab: string) => void;
  clearSearch: () => void;
  setLocationView: (view: LocationView) => void;
  /** The find bar's route to a record: its tab, a clear list filter, the record selected and scrolled to. */
  navigateToItem: (section: FindingSection, id: string) => void;
}

/**
 * After an undo, redo or jump, shows what came back: the tab that owns the record the move touched, with the
 * record selected. A removed record only opens its tab, where the list drops the stale selection itself. A
 * connection opens the canvas, which takes the returned request.
 */
export function useHistoryReveal(options: HistoryRevealOptions) {
  const [connectionReveal, setConnectionReveal] = useState<ConnectionReveal | null>(null);
  const clearConnectionReveal = useCallback(() => setConnectionReveal(null), []);
  const latest = useRef(options);
  latest.current = options;
  const { onMove } = options;

  useEffect(() => onMove((move) => {
    const { touring, visibleTabs, setActiveTab, clearSearch, setLocationView, navigateToItem } = latest.current;
    if (touring) return;
    const target = revealTargetForMove(move.steps, move.world);
    if (!target || !visibleTabs.some((tab) => tab.value === target.tab)) return;
    if (target.connection && target.id !== undefined) {
      setActiveTab(target.tab);
      clearSearch();
      setLocationView('canvas');
      setConnectionReveal({ id: target.id, gone: target.gone });
    } else if (target.id !== undefined && !target.gone) {
      navigateToItem(target.tab, target.id);
    } else {
      setActiveTab(target.tab);
    }
  }), [onMove]);

  return { connectionReveal, clearConnectionReveal };
}
