/**
 * The `ServerEvent` fixtures every events/contest test builds on.
 *
 * One builder rather than one per file: the shape is the server's DTO, so a field added to it means one
 * edit here instead of a sweep through every test that names an event. The defaults describe a contest
 * running right now — the case most tests want — and anything else is an override.
 */
import { DAY_MS } from '@/lib/serverDate';
import type { ContestPlace, ServerEvent } from '@/types';

export { DAY_MS };

/**
 * An ISO instant a whole number of days from a reference point.
 *
 * @param offsetDays - Days ahead (positive) or behind (negative)
 * @param from - What to count from; defaults to now
 */
export const daysFrom = (offsetDays: number, from: Date | number = Date.now()): string =>
  new Date((from instanceof Date ? from.getTime() : from) + offsetDays * DAY_MS).toISOString();

/** A contest that opened four days ago and closes in twelve, with nothing decided. */
export const serverEvent = (over: Partial<ServerEvent> = {}): ServerEvent => ({
  id: 'e1',
  type: 'contest',
  title: 'Winter World-Building Contest',
  bannerText: 'Build a world around a single season.',
  body: 'The long version.',
  rulesText: 'One entry per creator.',
  // Present and null, the way the server sends them for an event nobody styled — a test about a server
  // that predates the fields deletes them rather than relying on the fixture to leave them out.
  posterColor: null,
  posterImageUrl: null,
  startsAt: daysFrom(-4),
  endsAt: daysFrom(12),
  cancelledAt: null,
  startMessageId: 'm-start',
  endMessageId: null,
  resultsMessageId: null,
  resultsAnnouncedAt: null,
  placements: [],
  ...over,
});

/**
 * A contest whose results are out, with the podium handed in as `[worldId, name, author]` triples.
 *
 * The announcement stamp rides along with the podium, because on the server it always does: assigning a
 * place is not announcing it, and a fixture that supplied one without the other would let a test pass
 * against a state the server never produces.
 */
export const decidedContest = (
  podium: Array<[worldId: string | null, worldName: string, authorName: string]>,
  over: Partial<ServerEvent> = {},
): ServerEvent => serverEvent({
  endsAt: daysFrom(-1),
  resultsMessageId: 'm-results',
  resultsAnnouncedAt: daysFrom(0),
  placements: podium.map(([worldId, worldName, authorName], index) => ({
    place: (index + 1) as ContestPlace, worldId, worldName, authorName,
  })),
  ...over,
});

/** The same event as a slim list serves it: every field but the two prose ones. */
export const withoutProse = (event: ServerEvent): ServerEvent => {
  const row = { ...event };
  delete row.body;
  delete row.rulesText;
  return row;
};

/**
 * A `matchMedia` the browser's page-size effect can attach listeners to.
 *
 * The setup file's stub is installed only when jsdom has none, so a test that ran before this one may
 * have left its own behind; the browser attaches an orientation listener on open and throws on a stub
 * without one.
 *
 * @param matches - What every query answers; false is the desktop/landscape branch
 */
export function stubMatchMedia(matches = false): void {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
