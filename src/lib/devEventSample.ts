/**
 * DEV-only stand-in for the event `useActiveEvents` would otherwise fetch. Dynamically imported by
 * `#dev?view=mainMenu&modal=eventAck`, so the banner and the acknowledge modal can be checked without a
 * server and without an event really running. `tab=start|end` picks which phase is served.
 */
import { randomUUID } from '@/lib/uuid';
import { DAY_MS } from '@/lib/serverDate';
import type { ServerEvent, ServerEventPhase } from '@/types';

/**
 * A canned running contest, at whichever phase is asked for. Dates are relative so it is never stale,
 * and the id is fresh on every visit so the acknowledge modal and the banner arrive un-answered rather
 * than staying collapsed from the last look at them.
 */
export function devEventSample(phase: ServerEventPhase = 'start'): ServerEvent {
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
    startsAt: new Date(now - 4 * DAY_MS).toISOString(),
    endsAt: new Date(now + (ended ? -1 * DAY_MS : 12 * DAY_MS)).toISOString(),
    cancelledAt: null,
    startMessageId: 'dev-message-start',
    endMessageId: ended ? 'dev-message-end' : null,
    winnerMessageId: ended ? 'dev-message-winner' : null,
    winnerWorldId: ended ? 'dev-world' : null,
    winnerName: ended ? 'The Long Thaw' : null,
    winnerAuthorName: ended ? 'sedgewright' : null,
  };
}

/**
 * A canned set of contests for the Community Creations contest tab: one running, two archived, one of
 * them decided — enough for the tab, its slim bar and its archive selector. The entries themselves come
 * from the real catalog, so a dev machine with no contest entries sees the tab's empty state.
 */
export function devContestSamples(): ServerEvent[] {
  const now = Date.now();
  const running = devEventSample('start');

  return [
    running,
    {
      ...running,
      id: 'dev-contest-decided',
      title: 'Autumn Ruins Contest',
      startsAt: new Date(now - 60 * DAY_MS).toISOString(),
      endsAt: new Date(now - 30 * DAY_MS).toISOString(),
      winnerMessageId: 'dev-message-winner',
      winnerWorldId: 'dev-world',
      winnerName: 'The Long Thaw',
      winnerAuthorName: 'sedgewright',
    },
    {
      ...running,
      id: 'dev-contest-judging',
      title: 'Spring Tides Contest',
      startsAt: new Date(now - 20 * DAY_MS).toISOString(),
      endsAt: new Date(now - 2 * DAY_MS).toISOString(),
    },
  ];
}

/**
 * A canned calendar for the admin Events tab: one of every state the tab groups by, so all three
 * groups, both role views and every row control are reachable without a live server.
 *
 * Dates are relative, and the states are the ones the tab derives from them rather than stamped —
 * a fixture whose state was asserted rather than derived would hide a bug in the derivation.
 */
export function devAdminEventSamples(): ServerEvent[] {
  const now = Date.now();
  const base = devEventSample('start');

  return [
    { ...base, id: 'dev-event-active', title: 'Winter World-Building Contest' },
    {
      ...base,
      id: 'dev-event-notice',
      type: 'announcement',
      title: 'Update Preview',
      bannerText: 'The next update lands next week — see what is coming.',
      rulesText: null,
      startsAt: new Date(now - 2 * DAY_MS).toISOString(),
      endsAt: new Date(now + 5 * DAY_MS).toISOString(),
    },
    {
      ...base,
      id: 'dev-event-judging',
      title: 'Spring Tides Contest',
      startsAt: new Date(now - 20 * DAY_MS).toISOString(),
      endsAt: new Date(now - 2 * DAY_MS).toISOString(),
    },
    {
      ...base,
      id: 'dev-event-scheduled',
      title: 'Autumn Hauntings Contest',
      startsAt: new Date(now + 10 * DAY_MS).toISOString(),
      endsAt: new Date(now + 30 * DAY_MS).toISOString(),
      startMessageId: null,
    },
    {
      ...base,
      id: 'dev-event-ended',
      title: 'Autumn Ruins Contest',
      startsAt: new Date(now - 60 * DAY_MS).toISOString(),
      endsAt: new Date(now - 30 * DAY_MS).toISOString(),
      winnerMessageId: 'dev-message-winner',
      winnerWorldId: 'dev-world',
      winnerName: 'The Long Thaw',
      winnerAuthorName: 'sedgewright',
    },
    {
      ...base,
      id: 'dev-event-canceled',
      type: 'announcement',
      title: 'Midsummer Screenshot Week',
      rulesText: null,
      startsAt: new Date(now - 15 * DAY_MS).toISOString(),
      endsAt: new Date(now - 8 * DAY_MS).toISOString(),
      cancelledAt: new Date(now - 12 * DAY_MS).toISOString(),
    },
  ];
}
