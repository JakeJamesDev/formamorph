import { useCallback, useMemo, useState } from 'react';
import type { OpeningKey } from '@/lib/drawnOpening';
import { openingPickGroups, pickedOption, type OpeningPickGroup } from './openingPick';
import { readOpeningPick, writeOpeningPick } from './lensStore';
import type { LensWorld } from './lens';

export interface OpeningPickHandle {
  /** The picked Opening's key, or null under None and once its Opening is gone. */
  pick: OpeningKey | null;
  groups: OpeningPickGroup[];
  setPick: (key: OpeningKey | null) => void;
}

/** The one Opening pick of a world, which Test Code and the Test Bench share. Kept for the session, per world. */
export function useOpeningPick(worldId: string | null | undefined, world: LensWorld): OpeningPickHandle {
  const [stored, setStored] = useState<{ worldId: string | null | undefined; key: OpeningKey | null }>(
    () => ({ worldId, key: worldId ? readOpeningPick(worldId) : null }),
  );
  // Another world's pick never carries over: a world switch reads that world's own.
  const key = stored.worldId === worldId ? stored.key : worldId ? readOpeningPick(worldId) : null;
  if (stored.worldId !== worldId) setStored({ worldId, key });
  const groups = useMemo(() => openingPickGroups(world), [world]);
  const setPick = useCallback((next: OpeningKey | null) => {
    if (worldId) writeOpeningPick(worldId, next);
    setStored({ worldId, key: next });
  }, [worldId]);
  return { pick: pickedOption(groups, key)?.key ?? null, groups, setPick };
}
