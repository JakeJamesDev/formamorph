/**
 * DEV-only stand-in for the event `useActiveEvents` would otherwise fetch. Dynamically imported by
 * `#dev?view=mainMenu&modal=eventAck`, so the banner and the acknowledge modal can be checked without a
 * server and without an event really running. `tab=start|end` picks which phase is served.
 */
import { randomUUID } from '@/lib/uuid';
import type { ServerEvent, ServerEventPhase } from '@/types';

/**
 * A canned running contest, at whichever phase is asked for. Dates are relative so it is never stale,
 * and the id is fresh on every visit so the acknowledge modal and the banner arrive un-answered rather
 * than staying collapsed from the last look at them.
 */
export function devEventSample(phase: ServerEventPhase = 'start'): ServerEvent {
  const day = 86_400_000;
  const now = Date.now();
  const ended = phase === 'end';

  return {
    id: randomUUID(),
    type: 'contest',
    title: 'Winter World-Building Contest',
    bannerText: 'Build a world around a single season and enter it before the deadline.',
    body: 'Build a world around a single season — one place, one mood, one story worth returning to. '
      + 'Enter by publishing a world with the contest switch turned on.',
    rulesText: 'One entry per creator. Entries stay editable until the deadline, then lock for judging.',
    startsAt: new Date(now - 4 * day).toISOString(),
    endsAt: new Date(now + (ended ? -1 * day : 12 * day)).toISOString(),
    cancelledAt: null,
    startMessageId: 'dev-message-start',
    endMessageId: ended ? 'dev-message-end' : null,
    winnerMessageId: ended ? 'dev-message-winner' : null,
    winnerWorldId: ended ? 'dev-world' : null,
    winnerName: ended ? 'The Long Thaw' : null,
    winnerAuthorName: ended ? 'sedgewright' : null,
  };
}
