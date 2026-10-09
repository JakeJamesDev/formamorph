import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { HistoryMoveEvent, WorldHistoryControls } from '@/contexts/worldRecorder';
import { findHistoryField } from '@/lib/historyField';
import { revealForMove, type RevealTab } from '@/lib/historyReveal';
import { useLanding, type LandingOptions } from '@/lib/surface/useLanding';
import type { FindingSection } from '@/lib/testBench/rules';
import type { ConnectionReveal, SelectionReveal } from '@/managers/LocationCanvas';
import { LOCATION_VIEWS, type LocationView } from '@/views/locationViews';

/** A move's field, for a panel that keeps the field behind a tab of its own to open that tab. New per move. */
export interface FieldReveal {
  field: string;
}

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
  /** Shows a panel sub-tab, or the Overview's prompt panel. The editor falls back to its default for one the mode doesn't offer. */
  showSubTab: (tab: string, subTab: string) => void;
  /** The find bar's route to a record: its tab, a clear list filter, the record selected and scrolled to. */
  navigateToItem: (section: FindingSection, id: string) => void;
}

// Full screen moves a prompt field out of the editor's tree, so the field is looked up in the whole page.
const findField = (field: string) => findHistoryField(document, field);
// Focus stays where the author left it, so the next Ctrl+Z steps the world again (Q7).
const FIELD_LANDING: LandingOptions = { focus: () => null };

/**
 * After an undo, redo or jump, shows what came back: the Origin tab and record of an edit made through a
 * mirror, else the tab that owns the touched record, with the record selected. A removed record only opens
 * its tab, where the list drops the stale selection itself. A connection opens the canvas, which takes the
 * returned request. The Origin's field then scrolls into view and pulses, on every move.
 */
export function useHistoryReveal(options: HistoryRevealOptions) {
  const [connectionReveal, setConnectionReveal] = useState<ConnectionReveal | null>(null);
  const clearConnectionReveal = useCallback(() => setConnectionReveal(null), []);
  const [selectionReveal, setSelectionReveal] = useState<SelectionReveal | null>(null);
  const clearSelectionReveal = useCallback(() => setSelectionReveal(null), []);
  const [fieldReveal, setFieldReveal] = useState<FieldReveal | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const { onMove } = options;
  // The move waits for its commit, so each list reads the world the move restored.
  const [move, setMove] = useState<HistoryMoveEvent | null>(null);
  const landField = useLanding(findField, FIELD_LANDING);
  useEffect(() => onMove(setMove), [onMove]);

  useLayoutEffect(() => {
    if (!move) return;
    setMove(null);
    const {
      touring, visibleTabs, holds, setActiveTab, clearSearch, setLocationView, showSubTab, navigateToItem,
    } = latest.current;
    if (touring) return;
    const target = revealForMove(move.steps, move.world, {
      shows: (tab) => visibleTabs.some((shown) => shown.value === tab),
      holds,
    });
    // A request the canvas never took, or a field landing still looking, must not outlive the move that made it.
    setSelectionReveal(null);
    setFieldReveal(null);
    landField(null);
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
    // A connection already opened the canvas, so only a view the Origin names applies, as the one it is.
    if (target.view !== undefined && !target.connection) {
      setLocationView(LOCATION_VIEWS.find((view) => view.value === target.view)?.value ?? 'list');
    }
    if (target.subTab !== undefined) showSubTab(target.tab, target.subTab);
    // A field that never renders lands nothing, so the reveal ends at the selection (Q8).
    if (target.field !== undefined) {
      setFieldReveal({ field: target.field });
      landField(target.field);
    }
  }, [move, landField]);

  return { connectionReveal, clearConnectionReveal, selectionReveal, clearSelectionReveal, fieldReveal };
}
