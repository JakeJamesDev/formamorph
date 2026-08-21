/**
 * The `ServerEvent` fixtures every events/contest test builds on.
 *
 * One builder rather than one per file: the shape is the server's DTO, so a field added to it means one
 * edit here instead of a sweep through every test that names an event. The defaults describe a contest
 * running right now — the case most tests want — and anything else is an override.
 */
import { DAY_MS } from '@/lib/serverDate';
import type { ServerEvent } from '@/types';

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
  winnerMessageId: null,
  winnerWorldId: null,
  winnerName: null,
  winnerAuthorName: null,
  ...over,
});

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
