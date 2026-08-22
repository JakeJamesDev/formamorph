/**
 * Reading an event's prose back out of the server when the list it came from was served without it.
 *
 * Only two surfaces show an event's authored text — the acknowledge poster and the contest rules dialog
 * — and both are opened one event at a time, so the detail is fetched on demand rather than carried by
 * every row of a list that grows forever.
 */
import { useEffect, useState } from 'react';
import EventService from '@/services/EventService';
import { cachedEventProse, storeEventProse } from '@/lib/eventsCache';
import type { ServerEvent } from '@/types';

/**
 * Whether this row was served without its prose.
 *
 * Field absence, not a server version: a server that ignored the slim parameter answers with the prose
 * aboard, and that row needs nothing further. `rulesText` is not the test — a contest may legitimately
 * have none, and an announcement always has none.
 */
export function needsEventProse(event: ServerEvent): boolean {
  return event.body === undefined;
}

/** An event and whether its prose is still on its way. */
export interface EventProse<T extends ServerEvent | null> {
  event: T;
  /**
   * A read is in flight. A surface offering an irreversible action — the poster, which is answered once
   * — waits this out; one that can simply be reopened need not.
   */
  pending: boolean;
}

export function useEventProse(event: ServerEvent, active?: boolean): EventProse<ServerEvent>;
export function useEventProse(event: ServerEvent | null, active?: boolean): EventProse<ServerEvent | null>;

/**
 * The event with its prose, fetching it once when the row on hand is missing it.
 *
 * A read that fails stops pending anyway, with the row unchanged: an unreadable body is a poster with
 * nothing to read, not one nobody can ever dismiss.
 *
 * @param event - The row a surface was handed, or null when it has nothing to show
 * @param active - Whether the surface is on screen; a closed dialog fetches nothing
 */
export function useEventProse(
  event: ServerEvent | null,
  active = true,
): EventProse<ServerEvent | null> {
  const [filled, setFilled] = useState<ServerEvent | null>(
    () => (event ? cachedEventProse(event.id) ?? null : null),
  );
  const [failed, setFailed] = useState<string | null>(null);

  const id = event?.id ?? null;
  const wanted = Boolean(event && active && needsEventProse(event));

  useEffect(() => {
    if (!id || !wanted) return;

    const held = cachedEventProse(id);
    if (held) { setFilled(held); return; }

    let current = true;
    EventService.fetchOne(id)
      .then((full) => {
        storeEventProse(full);
        if (current) setFilled(full);
      })
      .catch((error) => {
        console.error('Failed to load the event:', error);
        if (current) setFailed(id);
      });

    return () => { current = false; };
  }, [id, wanted]);

  if (!event) return { event: null, pending: false };
  if (!needsEventProse(event)) return { event, pending: false };

  const read = filled && filled.id === event.id ? filled : cachedEventProse(event.id);
  if (!read) return { event, pending: failed !== event.id };

  // Only the two prose fields are taken from the detail read; every other field stays the list's, which
  // is the one a caller may have just had refreshed.
  return { event: { ...event, body: read.body, rulesText: read.rulesText }, pending: false };
}
