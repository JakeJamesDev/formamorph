import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildLens, EMPTY_LENS, lensLocationOptions, lensPcOptions,
  seedLens, type BenchLens, type LensOption, type LensState, type LensWorld,
} from './lens';
import { readLensState, writeLensState } from './lensStore';

export interface BenchLensHandle {
  lens: BenchLens;
  pcOptions: LensOption[];
  locationOptions: LensOption[];
  setPc: (traitId: string | null) => void;
  setLocation: (locationId: string | null) => void;
}

/**
 * The Bench's lens: seeded when the Bench opens, then the author's own until they change it. Seeding reads
 * the session's stored selection first and the editor's current location only where that has nothing to say,
 * so re-opening the Bench lands where the author left it rather than wherever the editor happens to be.
 *
 * The editor's selection is read at the moment of opening and not after — moving the list selection with the
 * Bench open would otherwise re-aim the lens under an author who is mid-test.
 */
export function useBenchLens(
  worldId: string | null | undefined,
  world: LensWorld,
  { open, selectedLocationId }: { open: boolean; selectedLocationId: string | null },
): BenchLensHandle {
  const [state, setState] = useState<LensState>(EMPTY_LENS);
  // Read at seed time rather than depended on, so neither an edit nor a selection re-seeds a lens in use.
  const latest = useRef({ world, selectedLocationId });
  latest.current = { world, selectedLocationId };

  // Opening the Bench is the only thing that seeds. Re-running it would be harmless — a seed reads the
  // stored selection, which is the author's own the moment they pick one — but nothing else should ask.
  useEffect(() => {
    if (!open || !worldId) return;
    setState(seedLens(latest.current.world, readLensState(worldId), latest.current.selectedLocationId));
  }, [open, worldId]);

  // Written where the selection changes rather than on a state effect, so the seed itself — which is either
  // what storage already holds or a world the author hasn't chosen anything in yet — never writes a record.
  const apply = useCallback((next: LensState) => {
    if (worldId) writeLensState(worldId, next);
    setState(next);
  }, [worldId]);

  const lens = useMemo(() => buildLens(world, state), [world, state]);

  return {
    lens,
    pcOptions: useMemo(() => lensPcOptions(world), [world]),
    locationOptions: useMemo(() => lensLocationOptions(world, lens.pins), [world, lens.pins]),
    setPc: useCallback((pcTraitId: string | null) => apply({ ...state, pcTraitId }), [apply, state]),
    setLocation: useCallback((locationId: string | null) => apply({ ...state, locationId }), [apply, state]),
  };
}
