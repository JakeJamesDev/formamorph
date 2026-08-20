import { useEffect, useState } from 'react';
import EventService from '@/services/EventService';
import { COMMUNITY_ENABLED } from '@/lib/featureFlags';
import { contestsOf } from '@/lib/contests';
import { useDevRoute } from '@/lib/devRouter';
import type { ServerEvent } from '@/types';

/**
 * Every contest a player may browse — the one running now and the archives behind it.
 *
 * Read once each time the browser opens rather than polled: an archive is finished, and the running
 * contest already has the events poll watching it. A failed read leaves the list empty, so the tab
 * simply doesn't appear.
 *
 * `loaded` tells an empty list apart from one that has not been read yet, which is the difference
 * between "this server runs no contests" and "the answer is still coming" — the tab is aimed at from
 * the event banner, and bouncing off it while the read is in flight would undo the click.
 *
 * @param open - Whether the surface holding the tab is on screen
 */
export function useContests(open: boolean): { contests: ServerEvent[]; loaded: boolean } {
  const [contests, setContests] = useState<ServerEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const devRoute = useDevRoute();
  const devFixture = import.meta.env.DEV && devRoute?.modal === 'community' && devRoute.tab === 'contest';

  useEffect(() => {
    if (!open || !COMMUNITY_ENABLED || devFixture) return;

    let current = true;
    EventService.fetchList()
      .then((events) => { if (current) setContests(contestsOf(events)); })
      // Silent, as the events poll is: a community server nobody can reach is the offline case, and a
      // contest that cannot be read is one the player is not told about rather than warned about.
      .catch((error) => console.error('Failed to load contests:', error))
      .finally(() => { if (current) setLoaded(true); });

    return () => { current = false; };
  }, [open, devFixture]);

  // DEV: `#dev?modal=community&tab=contest` serves canned contests — one running and two archived — so
  // the tab, its three grid states and its archive selector are checkable without a live event.
  useEffect(() => {
    if (!open || !devFixture) return;
    void import('@/lib/devEventSample').then(({ devContestSamples }) => {
      setContests(devContestSamples());
      setLoaded(true);
    });
  }, [open, devFixture]);

  return { contests, loaded };
}
