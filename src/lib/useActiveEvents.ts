import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import EventService from '@/services/EventService';
import { COMMUNITY_ENABLED } from '@/lib/featureFlags';
import { useDevEventSample } from '@/lib/useDevEventSample';
import { useDevRoute } from '@/lib/devRouter';
import type { ServerEvent } from '@/types';

/** How often the events list is re-read. Slow on purpose: an event runs for days. */
export const EVENTS_POLL_MS = 5 * 60 * 1000;

/** The closest together two focus-driven reads may land. Alt-tabbing is not news about an event. */
export const EVENTS_FOCUS_FLOOR_MS = 60 * 1000;

/** The mounted polls, so an admin's event write can nudge them without threading a callback down. */
const pollers = new Set<() => void>();

/**
 * Re-read every mounted events poll now.
 *
 * Called after an admin creates, edits, cancels, or decides an event: the poll is minutes-slow by
 * design, and an extended deadline that reopens a contest must reach the publish flow before then.
 */
export function refreshActiveEvents(): void {
  pollers.forEach((poll) => poll());
}

interface ActiveEventsOptions {
  /**
   * Called after every successful poll. The server pushes nothing, so this is the app's one chance to
   * notice a mid-session broadcast — the events poll nudges the unread badge along with itself.
   */
  onPoll?: () => void;
}

/**
 * The events currently running, re-read on an interval and whenever the window regains focus.
 *
 * The app's only polling interval, so it is deliberately conservative: it never runs when the community
 * features are off, it holds its callback in a ref (an inline arrow re-identifies every render, and a
 * poll that moves its host's state is a fetch loop — the notification feed shipped exactly that), and a
 * failed read is logged and swallowed. A first read that fails leaves the list empty, so every surface
 * built on it simply doesn't appear.
 */
export function useActiveEvents({ onPoll }: ActiveEventsOptions = {}): ServerEvent[] {
  const [events, setEvents] = useState<ServerEvent[]>([]);
  const devRoute = useDevRoute();
  const devFixture = import.meta.env.DEV && devRoute?.modal === 'eventAck';

  const onPollRef = useRef(onPoll);
  useEffect(() => { onPollRef.current = onPoll; });

  // Retires an in-flight read whose reply would land after a newer one, or after unmount.
  const readId = useRef(0);
  const lastReadAt = useRef(0);

  const refresh = useCallback(async () => {
    const read = (readId.current += 1);
    lastReadAt.current = Date.now();
    try {
      const next = await EventService.fetchActive();
      if (read === readId.current) {
        setEvents(next);
        onPollRef.current?.();
      }
    } catch (error) {
      // Silent: an unreachable community server is the common case offline, and an event nobody can
      // read is not worth a toast. The last known list stands rather than blinking out.
      console.error('Failed to load active events:', error);
    }
  }, []);

  useEffect(() => {
    if (!COMMUNITY_ENABLED || devFixture) return;

    void refresh();
    pollers.add(refresh);
    const timer = window.setInterval(() => { void refresh(); }, EVENTS_POLL_MS);
    const onFocus = () => {
      if (Date.now() - lastReadAt.current < EVENTS_FOCUS_FLOOR_MS) return;
      void refresh();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      readId.current += 1;
      pollers.delete(refresh);
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh, devFixture]);

  // DEV: `#dev?modal=eventAck` serves a canned event instead of the network, so the banner and the
  // acknowledge modal are checkable offline and whether or not one is really running.
  const samples = useDevEventSample(devFixture);
  const phase = devRoute?.tab === 'end' ? 'end' : 'start';
  // Memoized because the sample's id is fresh per call: built in the render body it would be a new event
  // every frame, and an acknowledgment keyed by id would never stick.
  const devEvents = useMemo(
    () => (samples ? [samples.devEventSample(phase)] : []),
    [samples, phase],
  );

  return devFixture ? devEvents : events;
}
