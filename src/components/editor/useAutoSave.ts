import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { measureChange, type CommittedChange } from '@/lib/changeMeter';
import { createAutoSaveScheduler } from '@/lib/autoSaveScheduler';
import { useMountedRef } from '@/lib/useMountedRef';
import { onWorldChangedElsewhere } from '@/lib/worldChangeSignal';
import WorldStorageService from '@/services/WorldStorageService';

/**
 * Saves the open world on its own: the recorder's changes fill the count, and the scheduler picks the moment.
 * Returns the wrapper every manual save goes through, so the two never overlap, and a step that waits for the running save.
 *
 * A world joins in once it is in the library. A new world and an unedited bundled default wait for a save by
 * hand: the one stays out of the library, and the other keeps its bundled updates after a stray edit.
 */
export function useAutoSave({ enabled, idleMs, worldId, stored, dirty, onChange, save }: {
  /** The preference, and no tour running. */
  enabled: boolean;
  /** The pause after the last change that saves a small one. */
  idleMs: number;
  worldId: string | null;
  /** The world has a copy in the library. */
  stored: boolean;
  dirty: boolean;
  onChange: (listener: (change: CommittedChange) => void) => () => void;
  /** The auto save. It resolves false on a failure. */
  save: () => Promise<boolean>;
}) {
  const saveRef = useRef(save);
  const worldIdRef = useRef(worldId);
  useLayoutEffect(() => { saveRef.current = save; worldIdRef.current = worldId; });
  const mounted = useMountedRef();
  // The world an auto save wrote during this visit.
  const [autoSavedId, setAutoSavedId] = useState<string | null>(null);
  const [scheduler] = useState(() => createAutoSaveScheduler({
    save: () => {
      const id = worldIdRef.current;
      return saveRef.current().then((ok) => {
        if (ok && mounted.current) setAutoSavedId(id);
        return ok;
      });
    },
  }));
  useEffect(() => scheduler.setIdleMs(idleMs), [idleMs, scheduler]);

  // Each holds the world id it is true for, so another world starts over without a reset.
  const [savedByHand, setSavedByHand] = useState<string | null>(null);
  const [notDefault, setNotDefault] = useState<string | null>(null);
  useEffect(() => {
    if (!worldId || !stored) return;
    let live = true;
    // An unreadable record reads as a default: auto save then waits for a save by hand.
    Promise.resolve()
      .then(() => WorldStorageService.isUneditedDefault(worldId))
      .then((unedited) => { if (live && !unedited) setNotDefault(worldId); }, () => {});
    return () => { live = false; };
  }, [worldId, stored]);
  const joined = stored && worldId !== null && (savedByHand === worldId || notDefault === worldId);

  useEffect(() => onChange((change) => scheduler.add(measureChange(change))), [onChange, scheduler]);
  useEffect(() => {
    scheduler.setEnabled(enabled && joined);
    return () => scheduler.setEnabled(false);
  }, [enabled, joined, scheduler]);
  // Pauses at once: a save due before the dialog's render would overwrite the other tab's.
  useEffect(() => {
    if (!worldId) return;
    return onWorldChangedElsewhere((id) => { if (id === worldId) scheduler.setEnabled(false); });
  }, [worldId, scheduler]);
  // A world back to what is on disk has nothing to save.
  useEffect(() => { if (!dirty) scheduler.clear(); }, [dirty, scheduler]);

  const manual = useCallback((write: () => Promise<boolean>) => scheduler.manual(write).then((ok) => {
    if (ok && mounted.current) setSavedByHand(worldId);
    return ok;
  }), [scheduler, worldId, mounted]);

  // Steps that wait for a render holding the result of the saves they waited for.
  const [waiting, setWaiting] = useState<(() => void)[]>([]);
  useEffect(() => {
    if (!waiting.length) return;
    setWaiting([]);
    for (const then of waiting) then();
  }, [waiting]);
  /** Runs `then` now when no save runs, or after the render that follows the running saves. */
  const afterSavesRender = useCallback((then: () => void) => {
    if (!scheduler.state.saving) { then(); return; }
    scheduler.afterSaves(() => { if (mounted.current) setWaiting((queued) => [...queued, then]); });
  }, [scheduler, mounted]);

  return {
    manual,
    afterSaves: scheduler.afterSaves,
    afterSavesRender,
    /** An auto save wrote the open world during this visit. */
    autoSaved: worldId !== null && autoSavedId === worldId,
  };
}
