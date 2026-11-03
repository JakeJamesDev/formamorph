import { useSyncExternalStore } from 'react';
import { PATREON_PAGE_URL } from '@/components/PatreonSection';
import { useDevRoute } from '@/lib/devRouter';
import { openExternal } from '@/lib/openExternal';
import { SUPPORTER_TIERS } from '@/lib/supporterFlair';
import { RoadScene } from './RoadScene';
import { closeRoadScene, isRoadSceneOpen, subscribeRoadScene } from './roadSceneStore';

/** The one scene for every view. It sits above the view switch, so a view change never closes it. */
export function RoadSceneHost() {
  const requested = useSyncExternalStore(subscribeRoadScene, isRoadSceneOpen);
  const devRoute = useDevRoute();
  // DEV: `#dev?modal=road&tab=<tier>` opens the scene on a level.
  const devOpen = import.meta.env.DEV && devRoute?.modal === 'road';
  if (!requested && !devOpen) return null;
  return (
    <RoadScene
      initialTier={devOpen ? SUPPORTER_TIERS.find((tier) => tier === devRoute?.tab) : undefined}
      onKeepPlaying={() => {
        closeRoadScene();
        if (devOpen) window.location.hash = '#dev';
      }}
      onSupport={() => openExternal(PATREON_PAGE_URL)}
    />
  );
}
