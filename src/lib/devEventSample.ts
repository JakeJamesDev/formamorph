/**
 * DEV-only stand-in for the event `useActiveEvents` would otherwise fetch. Dynamically imported by
 * `#dev?view=mainMenu&modal=eventAck`, so the banner and the acknowledge modal can be checked without a
 * server and without an event really running. `tab=start|end` picks which phase is served.
 */
import { randomUUID } from '@/lib/uuid';
import { DAY_MS } from '@/lib/serverDate';
import type { EventPlacement, ServerEvent, ServerEventPhase } from '@/types';

/**
 * Stand-in poster artwork: a 2:1 picture in four quadrants with a marked subject a quarter across and
 * three quarters down. Inline rather than a file, so it loads with no server, and deliberately lopsided
 * so a band that ignored the framing below is visible at a glance rather than plausible.
 */
const DEV_POSTER_ART = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500">
  <rect width="500" height="250" fill="#1e3a8a"/>
  <rect x="500" width="500" height="250" fill="#7c3aed"/>
  <rect y="250" width="500" height="250" fill="#0f766e"/>
  <rect x="500" y="250" width="500" height="250" fill="#b45309"/>
  <circle cx="250" cy="375" r="80" fill="#fde047"/>
  <text x="250" y="392" font-size="44" font-family="sans-serif" text-anchor="middle" fill="#1c1917">HERE</text>
</svg>`)}`;

/** Framed on that marker, at twice the scale that just covers the band. */
const DEV_POSTER_PLACEMENT = { zoom: 2, x: 0.25, y: 0.75 };

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
    posterColor: '#1e3a8a',
    posterImageUrl: DEV_POSTER_ART,
    posterPlacement: DEV_POSTER_PLACEMENT,
    startsAt: new Date(now - 4 * DAY_MS).toISOString(),
    endsAt: new Date(now + (ended ? -1 * DAY_MS : 12 * DAY_MS)).toISOString(),
    cancelledAt: null,
    startMessageId: 'dev-message-start',
    endMessageId: ended ? 'dev-message-end' : null,
    resultsMessageId: ended ? 'dev-message-results' : null,
    resultsAnnouncedAt: ended ? new Date(now - DAY_MS).toISOString() : null,
    placements: ended ? DEV_PODIUM : [],
  };
}

/** A full podium, so every dev surface meets three places rather than only gold. */
const DEV_PODIUM: EventPlacement[] = [
  { place: 1, worldId: 'dev-world', worldName: 'The Long Thaw', authorName: 'sedgewright' },
  { place: 2, worldId: 'dev-world-2', worldName: 'Nine Frozen Bells', authorName: 'marrowmoss' },
  { place: 3, worldId: 'dev-world-3', worldName: 'The Kindling Hour', authorName: 'ashgrove' },
];

/**
 * A canned set of contests for the Community Creations contest tab: one running, two archived, one of
 * them decided with a full podium — enough for the tab, its slim bar and its archive selector. The entries themselves come
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
      resultsMessageId: 'dev-message-results',
      resultsAnnouncedAt: new Date(now - 29 * DAY_MS).toISOString(),
      placements: DEV_PODIUM,
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
      resultsMessageId: 'dev-message-results',
      resultsAnnouncedAt: new Date(now - 29 * DAY_MS).toISOString(),
      placements: DEV_PODIUM,
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
