import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDevRoute } from '@/lib/devRouter';
import type { PickState } from '@/managers/EntityPickCard';
import type { PresenceReveal } from '@/lib/entityPicking';
import { showRoutineStart, showStartFor } from '@/lib/routineSelection';
import type { Entity } from '@/types';

/** The World Editor's one entity pick, which the location panel and the Locations Canvas both read and set. */
export interface EntityPick {
  pick: PickState | null;
  onPickChange: (next: PickState | null) => void;
  /** Whether the pick is a selected row on the Presence tab on screen, which the canvas beside the panel draws. */
  shown: boolean;
  /** The canvas reports each move into and out of full screen. */
  onFullscreenChange?: (open: boolean) => void;
  /** Opens the Locations Canvas in full screen with the pick kept. */
  onEditFullScreen?: () => void;
  /** Set until the canvas opens full screen for `onEditFullScreen`. */
  fullscreenRequested?: boolean;
  onFullscreenRequestTaken?: () => void;
}

/**
 * Holds the pick. Outside full screen a pick lives only as a selected Presence row: it clears when it stops being
 * one (another tab, another location with no row, the Locations section gone) and when full screen closes on a
 * pick that is not one.
 */
export function useEntityPick({ hasPresenceRow, presenceAt, entityOf, reveal, onRevealTaken, showCanvas }: {
  /** Whether the Presence tab on screen has a row for this entity. */
  hasPresenceRow: (entityId: string) => boolean;
  /** The location whose Presence tab is on screen. */
  presenceAt: string | null;
  /** The world's entity by id, for the Start a kept pick opens on. */
  entityOf?: (entityId: string) => Entity | undefined;
  /** An undo's request to select an entity there. It waits for the tab, and the next move drops it. */
  reveal?: PresenceReveal | null;
  onRevealTaken?: () => void;
  /** Puts the Locations Canvas on screen, so it can open full screen. */
  showCanvas?: () => void;
}) {
  const [pick, setPick] = useState<PickState | null>(null);
  const [fullscreenRequested, setFullscreenRequested] = useState(false);
  const shown = !!pick && hasPresenceRow(pick.entityId);
  const shownRef = useRef(shown);
  const fullscreenRef = useRef(false);
  // The location whose Start the shown pick's editor is on.
  const seatedAt = useRef(presenceAt);

  useEffect(() => {
    if (shownRef.current && !shown && !fullscreenRef.current) setPick(null);
    shownRef.current = shown;
  }, [shown]);

  const onFullscreenChange = useCallback((open: boolean) => {
    if (!open && fullscreenRef.current && !shownRef.current) setPick(null);
    fullscreenRef.current = open;
  }, []);

  // No row now (an undone add) leaves no selection; the Start of the change stays on show.
  useEffect(() => {
    if (!reveal || !presenceAt) return;
    const row = hasPresenceRow(reveal.entityId);
    setPick(row ? { entityId: reveal.entityId, mode: reveal.mode } : null);
    if (row && reveal.startId) showRoutineStart(reveal.entityId, reveal.startId);
    seatedAt.current = presenceAt;
    onRevealTaken?.();
  }, [reveal, presenceAt, hasPresenceRow, onRevealTaken]);

  // A pick kept across a change of location opens on that location's Start. Full screen keeps the card's Start.
  const pickedId = shown ? pick.entityId : null;
  useEffect(() => {
    if (!presenceAt || seatedAt.current === presenceAt) return;
    seatedAt.current = presenceAt;
    const entity = pickedId && !fullscreenRef.current ? entityOf?.(pickedId) : undefined;
    if (entity) showStartFor(entity, presenceAt);
  }, [presenceAt, pickedId, entityOf]);

  const onEditFullScreen = useCallback(() => {
    showCanvas?.();
    setFullscreenRequested(true);
  }, [showCanvas]);
  const onFullscreenRequestTaken = useCallback(() => setFullscreenRequested(false), []);

  // DEV dev-router: `fullscreen=1&pick=<entity id>` (or `<entity id>:knownIn`) picks on the full-screen canvas.
  const route = useDevRoute();
  const devPick = route?.fullscreen ? route.pick : undefined;
  useEffect(() => {
    if (!import.meta.env.DEV || !devPick) return;
    const [entityId, mode] = devPick.split(':');
    setPick({ entityId, mode: mode === 'knownIn' ? 'knownIn' : 'locations' });
  }, [devPick]);

  const entityPick = useMemo<EntityPick>(
    () => ({ pick, onPickChange: setPick, shown, onFullscreenChange, onEditFullScreen, fullscreenRequested, onFullscreenRequestTaken }),
    [pick, shown, onFullscreenChange, onEditFullScreen, fullscreenRequested, onFullscreenRequestTaken],
  );
  return { entityPick };
}
