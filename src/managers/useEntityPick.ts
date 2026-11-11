import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDevRoute } from '@/lib/devRouter';
import type { PickState } from '@/managers/EntityPickCard';
import type { PresenceReveal } from '@/lib/entityPicking';

/** The World Editor's one entity pick, which the location panel and the Locations Canvas both read and set. */
export interface EntityPick {
  pick: PickState | null;
  onPickChange: (next: PickState | null) => void;
  /** Whether the pick is a selected row on the Presence tab on screen, which the canvas beside the panel draws. */
  shown: boolean;
  /** The canvas reports each move into and out of full screen. */
  onFullscreenChange?: (open: boolean) => void;
}

/**
 * Holds the pick. Outside full screen a pick lives only as a selected Presence row: it clears when it stops being
 * one (another tab, another location with no row, the Locations section gone) and when full screen closes on a
 * pick that is not one.
 */
export function useEntityPick({ hasPresenceRow, presenceOnScreen, reveal, onRevealTaken }: {
  /** Whether the Presence tab on screen has a row for this entity. */
  hasPresenceRow: (entityId: string) => boolean;
  /** Whether a location's Presence tab is on screen. */
  presenceOnScreen: boolean;
  /** An undo's request to select an entity there. It waits for the tab, and the next move drops it. */
  reveal?: PresenceReveal | null;
  onRevealTaken?: () => void;
}) {
  const [pick, setPick] = useState<PickState | null>(null);
  const shown = !!pick && hasPresenceRow(pick.entityId);
  const shownRef = useRef(shown);
  const fullscreenRef = useRef(false);

  useEffect(() => {
    if (shownRef.current && !shown && !fullscreenRef.current) setPick(null);
    shownRef.current = shown;
  }, [shown]);

  const onFullscreenChange = useCallback((open: boolean) => {
    if (!open && fullscreenRef.current && !shownRef.current) setPick(null);
    fullscreenRef.current = open;
  }, []);

  // An entity with no row now (an undone add) leaves the tab on screen with no selection.
  useEffect(() => {
    if (!reveal || !presenceOnScreen) return;
    setPick(hasPresenceRow(reveal.entityId) ? { entityId: reveal.entityId, mode: reveal.mode } : null);
    onRevealTaken?.();
  }, [reveal, presenceOnScreen, hasPresenceRow, onRevealTaken]);

  // DEV dev-router: `fullscreen=1&pick=<entity id>` (or `<entity id>:knownIn`) picks on the full-screen canvas.
  const route = useDevRoute();
  const devPick = route?.fullscreen ? route.pick : undefined;
  useEffect(() => {
    if (!import.meta.env.DEV || !devPick) return;
    const [entityId, mode] = devPick.split(':');
    setPick({ entityId, mode: mode === 'knownIn' ? 'knownIn' : 'locations' });
  }, [devPick]);

  const entityPick = useMemo<EntityPick>(
    () => ({ pick, onPickChange: setPick, shown, onFullscreenChange }),
    [pick, shown, onFullscreenChange],
  );
  return { entityPick };
}
