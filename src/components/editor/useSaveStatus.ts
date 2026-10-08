import { useCallback, useEffect, useRef, useState } from 'react';
import { useMountedRef } from '@/lib/useMountedRef';

/** What the Save face shows. `clean` is the muted Save; `pending` is the enabled one. */
export type SaveStatus = 'clean' | 'pending' | 'saving' | 'saved' | 'failed';

/** The last save's outcome, before the world's dirty flag is folded in. */
export type SavePhase = 'idle' | 'saving' | 'saved' | 'failed';

/** How long Saved holds before the face fades to the muted Save. */
export const SAVED_HOLD_MS = 2000;

/** Saving and Failed hold whatever the world does; an edit ends Saved. */
export function saveStatusOf(phase: SavePhase, dirty: boolean): SaveStatus {
  if (phase === 'saving' || phase === 'failed') return phase;
  if (dirty) return 'pending';
  return phase === 'saved' ? 'saved' : 'clean';
}

/**
 * Tracks the world's saves for the Save face. `track` runs one save and walks the status through it; a call
 * while a save runs gets that save's promise instead of a second write.
 */
export function useSaveStatus(dirty: boolean) {
  const [phase, setPhase] = useState<SavePhase>('idle');
  const inFlight = useRef<Promise<boolean> | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const mounted = useMountedRef();

  const wasDirty = useRef(dirty);
  useEffect(() => () => window.clearTimeout(holdTimer.current), []);
  // Only a clean-to-dirty edit ends the hold: a save's result can commit a render before the flag clears.
  useEffect(() => {
    const edited = dirty && !wasDirty.current;
    wasDirty.current = dirty;
    if (edited && phase === 'saved') {
      window.clearTimeout(holdTimer.current);
      setPhase('idle');
    }
  }, [phase, dirty]);

  const settle = useCallback((ok: boolean) => {
    inFlight.current = null;
    if (!mounted.current) return;
    setPhase(ok ? 'saved' : 'failed');
    if (ok) holdTimer.current = window.setTimeout(() => { if (mounted.current) setPhase('idle'); }, SAVED_HOLD_MS);
  }, [mounted]);

  const track = useCallback((save: () => Promise<boolean>): Promise<boolean> => {
    if (inFlight.current) return inFlight.current;
    window.clearTimeout(holdTimer.current);
    setPhase('saving');
    const run = save().then(
      (ok) => { settle(ok); return ok; },
      (error: unknown) => { settle(false); throw error; },
    );
    inFlight.current = run;
    return run;
  }, [settle]);

  return { status: saveStatusOf(phase, dirty), track };
}
