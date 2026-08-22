/**
 * The one events list the app reads, shared by every surface that wants it.
 *
 * The archive is permanent, so the list only grows: without this, the main menu's launch read and every
 * open of the Community Creations browser each pull the whole thing down again. Held in memory for the
 * session and deliberately never persisted — an archive on disk would put winner badges in front of a
 * player who is offline, which the badge work decided against.
 *
 * Rows are asked for slim. A server that has never heard of the parameter answers with whole rows, so
 * nothing here depends on the server having been upgraded.
 */
import EventService from '@/services/EventService';
import AuthService from '@/services/AuthService';
import { EVENTS_POLL_MS } from '@/lib/useActiveEvents';
import type { ServerEvent } from '@/types';

/**
 * How long a read stands before the next reader revalidates behind it.
 *
 * The events poll's own interval, shared rather than restated: an archive is no more urgent than the
 * banner, so reopening the browser inside the window costs nothing and a winner announced mid-session
 * still lands within it.
 */
export const EVENTS_STALE_MS = EVENTS_POLL_MS;

interface CacheEntry {
  events: ServerEvent[];
  readAt: number;
  /** Whose read this was. Staff see rows nobody else does, so a signed-in read is not a signed-out one. */
  token: string | null;
}

let entry: CacheEntry | null = null;
let inFlight: Promise<ServerEvent[]> | null = null;

/** Retires a read whose reply would land after a newer one, or after the cache was dropped. */
let generation = 0;

const listeners = new Set<(events: ServerEvent[]) => void>();

/**
 * The full rows read back for the two surfaces that show prose, kept beside the list rather than in
 * their own module: they are the same events, so an admin's edit has to reach both or a rules dialog
 * already opened keeps the wording that was just rewritten.
 */
const prose = new Map<string, ServerEvent>();

/** The full row already read back for this event, if one has been. */
export function cachedEventProse(id: string): ServerEvent | undefined {
  return prose.get(id);
}

/** Keep a full row, so reopening the surface that wanted it is not a second request. */
export function storeEventProse(event: ServerEvent): void {
  prose.set(event.id, event);
}

const tokenNow = (): string | null => AuthService.token ?? null;

/** What is held right now, or null when this session's caller has read nothing yet. */
export function cachedEvents(): ServerEvent[] | null {
  if (!entry || entry.token !== tokenNow()) return null;
  return entry.events;
}

/** Whether what is held is recent enough to answer with instead of going back to the server. */
function isFresh(): boolean {
  return Boolean(entry && entry.token === tokenNow() && Date.now() - entry.readAt < EVENTS_STALE_MS);
}

function fetchAndStore(): Promise<ServerEvent[]> {
  const read = ++generation;
  const token = tokenNow();

  // Cleared inside this chain rather than in a `finally` hung off it: the caller's `await` resumes
  // before a trailing handler would run, and would find the settled read still posted as in flight.
  const settle = () => { if (inFlight === pending) inFlight = null; };

  const pending: Promise<ServerEvent[]> = EventService.fetchList({ slim: true }).then(
    (events) => {
      settle();
      if (read === generation) {
        entry = { events, readAt: Date.now(), token };
        listeners.forEach((listener) => listener(events));
      }
      return events;
    },
    // Rethrown so the caller still hears about it — but a failed read must not wedge every later one
    // behind a rejected promise.
    (error: unknown) => { settle(); throw error; },
  );

  inFlight = pending;
  return pending;
}

/**
 * The events list — what is held when it is recent, one shared fetch otherwise.
 *
 * Concurrent callers share the in-flight read rather than racing two of them, which is what makes the
 * main menu's launch read and a browser opened a second later cost one request between them.
 */
export function readEvents(): Promise<ServerEvent[]> {
  const held = cachedEvents();
  if (held && isFresh()) return Promise.resolve(held);
  return inFlight ?? fetchAndStore();
}

/**
 * Drop what is held, and tell anyone listening what replaces it.
 *
 * Called after an admin creates, edits, cancels or decides an event — the precedent the events poll set.
 * The re-read is only started when something is mounted to receive it; with nothing listening, the next
 * reader simply misses.
 */
export function invalidateEvents(): void {
  generation += 1;
  entry = null;
  inFlight = null;
  prose.clear();

  if (listeners.size === 0) return;
  void readEvents().catch((error) => console.error('Failed to reload events:', error));
}

/**
 * Hear about every list that lands, until the returned function is called.
 *
 * @param listener - Called with the new list on each successful read
 */
export function subscribeEvents(listener: (events: ServerEvent[]) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Forget everything, listeners included. For tests, whose module state would otherwise carry over. */
export function resetEventsCache(): void {
  generation += 1;
  entry = null;
  inFlight = null;
  prose.clear();
  listeners.clear();
}
