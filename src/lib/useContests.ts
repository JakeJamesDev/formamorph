import { useEffect, useMemo, useState } from 'react';
import { COMMUNITY_ENABLED } from '@/lib/featureFlags';
import { contestsOf } from '@/lib/contests';
import { cachedEvents, readEvents, subscribeEvents } from '@/lib/eventsCache';
import { useDevEventSample } from '@/lib/useDevEventSample';
import { useDevRoute } from '@/lib/devRouter';
import type { ServerEvent } from '@/types';

/**
 * Every contest a player may browse — the one running now and the archives behind it.
 *
 * Read from the shared events cache rather than per surface: the main menu holds this open for the whole
 * session and the browser asks again on every open, and the archive is a list that only ever grows. A
 * read inside the cache's window is answered from memory; past it, what is held is shown at once and the
 * fresh answer arrives behind it, which is how a winner announced mid-session reaches an open browser.
 *
 * A failed read leaves the list empty, so the tab simply doesn't appear.
 *
 * `loaded` tells an empty list apart from one that has not been read yet, which is the difference
 * between "this server runs no contests" and "the answer is still coming" — the tab is aimed at from
 * the event banner, and bouncing off it while the read is in flight would undo the click.
 *
 * @param open - Whether the surface holding the tab is on screen
 */
export function useContests(open: boolean): { contests: ServerEvent[]; loaded: boolean } {
  const [events, setEvents] = useState<ServerEvent[]>(() => cachedEvents() ?? []);
  const [loaded, setLoaded] = useState(() => cachedEvents() !== null);
  const devRoute = useDevRoute();
  const devFixture = import.meta.env.DEV && devRoute?.modal === 'community' && devRoute.tab === 'contest';

  useEffect(() => {
    if (!open || !COMMUNITY_ENABLED || devFixture) return;

    let current = true;
    const settle = (next: ServerEvent[]) => {
      if (!current) return;
      setEvents(next);
      setLoaded(true);
    };

    const held = cachedEvents();
    if (held) settle(held);

    const unsubscribe = subscribeEvents(settle);
    readEvents()
      // Silent, as the events poll is: a community server nobody can reach is the offline case, and a
      // contest that cannot be read is one the player is not told about rather than warned about.
      .catch((error) => console.error('Failed to load contests:', error))
      .finally(() => { if (current) setLoaded(true); });

    return () => { current = false; unsubscribe(); };
  }, [open, devFixture]);

  const contests = useMemo(() => contestsOf(events), [events]);

  // DEV: `#dev?modal=community&tab=contest` serves canned contests — one running and two archived — so
  // the tab, its three grid states and its archive selector are checkable without a live event. Memoized
  // for the same reason the events poll's fixture is: the running sample's id is fresh per call.
  const samples = useDevEventSample(devFixture && open);
  const devContests = useMemo(() => (samples ? samples.devContestSamples() : []), [samples]);

  if (devFixture) return { contests: devContests, loaded: samples !== null };
  return { contests, loaded };
}
