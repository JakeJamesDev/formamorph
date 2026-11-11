import { useEffect, useMemo, useState } from 'react';
import { useDevRoute } from '@/lib/devRouter';
import type { PickState } from '@/managers/EntityPickCard';

/** The World Editor's one entity pick, which the location panel and the Locations Canvas both read and set. */
export interface EntityPick {
  pick: PickState | null;
  onPickChange: (next: PickState | null) => void;
  /** Whether the canvas beside the panel draws the pick. Full screen draws it either way. */
  shown: boolean;
}

export function useEntityPick() {
  const [pick, setPick] = useState<PickState | null>(null);
  const [shown, setShown] = useState(false);

  // DEV dev-router: `pick=<entity id>` (or `<entity id>:knownIn`) sets the pick; without `fullscreen=1` it is on show.
  const route = useDevRoute();
  const devPick = route?.pick;
  const devFullscreen = !!route?.fullscreen;
  useEffect(() => {
    if (!import.meta.env.DEV || !devPick) return;
    const [entityId, mode] = devPick.split(':');
    setPick({ entityId, mode: mode === 'knownIn' ? 'knownIn' : 'locations' });
    setShown(!devFullscreen);
  }, [devPick, devFullscreen]);

  const entityPick = useMemo<EntityPick>(() => ({ pick, onPickChange: setPick, shown }), [pick, shown]);
  return { entityPick, setShown };
}
