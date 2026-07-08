import { useEffect, useRef } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useDevRoute } from '@/lib/devRouter';
import { loadDevFixture } from '@/lib/devFixtures';

/**
 * DEV-only: when the dev-route carries a `fixture`, load that fixture's world into GameDataContext so a
 * mid-game boot has a world before GameViewer mounts (GameViewer then loads the save via `loadGame`).
 * Renders nothing; mounted inside GameDataProvider alongside the views. No-op / tree-shaken in production.
 */
export function DevFixtureLoader() {
  const { loadWorldData } = useGameData();
  const devRoute = useDevRoute();
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const name = devRoute?.fixture;
    if (!name || loadedRef.current === name) return;
    loadedRef.current = name;
    loadDevFixture(name).then((fx) => {
      if (fx) loadWorldData(fx.world, true);
    });
  }, [devRoute?.fixture, loadWorldData]);

  return null;
}
