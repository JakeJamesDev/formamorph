import { useEffect, useRef } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useDevRoute } from '@/lib/devRouter';
import { loadDevFixture } from '@/lib/devFixtures';
import type { Entity } from '@/types';

/**
 * DEV-only: when the dev-route carries a `fixture`, load that fixture's world into GameDataContext and hand its
 * picked entities to `onPicked`, so a boot has a world before GameViewer mounts (GameViewer then loads the save
 * via `loadGame`, or starts a new game with the picked entities).
 * Renders nothing; mounted inside GameDataProvider alongside the views. No-op / tree-shaken in production.
 */
export function DevFixtureLoader({ onPicked }: { onPicked: (picked: Entity[] | null) => void }) {
  const { loadWorldData } = useGameData();
  const devRoute = useDevRoute();
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const name = devRoute?.fixture;
    if (!name || loadedRef.current === name) return;
    loadedRef.current = name;
    loadDevFixture(name).then((fx) => {
      if (!fx) return;
      onPicked(fx.picked ?? null);
      loadWorldData(fx.world, true);
    });
  }, [devRoute?.fixture, loadWorldData, onPicked]);

  return null;
}
