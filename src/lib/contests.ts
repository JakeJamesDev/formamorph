/**
 * Pure reasoning about a contest and the listings entered into it: which contests a player may browse,
 * which listings belong to one, and what order they are shown in. No React, no network — the contest
 * tab, its slim bar and their tests all read the same answers from here.
 */
import { parseServerDate } from './serverDate';
import { hasWinner, isContestEvent } from './serverEvents';
import type { WorldRecord } from '@/components/WorldDetails';
import type { ServerEvent } from '@/types';

/**
 * How far through its life a contest is.
 *
 * `live` still takes entries, `judging` has closed but has no winner yet, and `decided` has one. The
 * two later states are the archive: the layout is the same and nothing can be entered into either.
 */
export type ContestPhase = 'live' | 'judging' | 'decided';

/** Newest window first — the order every list of contests is read in. */
const byNewestStart = (a: ServerEvent, b: ServerEvent): number =>
  (parseServerDate(b.startsAt)?.getTime() ?? 0) - (parseServerDate(a.startsAt)?.getTime() ?? 0);

/** Whether a contest is inside its window — running now, rather than scheduled or over. */
export function isContestRunning(event: ServerEvent, now: Date = new Date()): boolean {
  if (event.cancelledAt) return false;
  const starts = parseServerDate(event.startsAt);
  const ends = parseServerDate(event.endsAt);
  if (!starts || !ends) return false;
  return starts.getTime() <= now.getTime() && now.getTime() < ends.getTime();
}

/**
 * Which of its three states a contest is in.
 *
 * A winner outranks the clock: a contest decided early is decided, and one whose window is still open
 * on a slow clock has not reopened for entries.
 */
export function contestPhase(event: ServerEvent, now: Date = new Date()): ContestPhase {
  if (hasWinner(event)) return 'decided';
  return isContestRunning(event, now) ? 'live' : 'judging';
}

/** The contests among a list of events, running ones first and then newest window first. */
export function contestsOf(events: ServerEvent[], now: Date = new Date()): ServerEvent[] {
  return events
    .filter((event) => isContestEvent(event) && !event.cancelledAt)
    .sort((a, b) => {
      const running = Number(isContestRunning(b, now)) - Number(isContestRunning(a, now));
      if (running !== 0) return running;
      return byNewestStart(a, b);
    });
}

/**
 * The one contest taking entries right now, if any.
 *
 * Read from the events poll, which already carries only what is running, but judged against the clock
 * anyway: a poll five minutes stale can still be holding a contest whose deadline has passed, and
 * offering an entry the server would refuse is worse than offering none.
 */
export function activeContestOf(events: ServerEvent[], now: Date = new Date()): ServerEvent | null {
  return events.find((event) => isContestEvent(event) && isContestRunning(event, now)) ?? null;
}

/**
 * The contests whose window has closed with no winner named yet.
 *
 * What the end-of-contest poster is still owed for. Read from the contests feed rather than the events
 * poll, which carries only what is running: a player who launches the app the morning after a deadline
 * was never online for the transition, and the poll has nothing left to tell them.
 *
 * The clock is checked rather than `contestPhase`, which reads a contest that has not started yet as
 * judging — staff see scheduled ones in this feed.
 */
export function judgingContestsOf(events: ServerEvent[], now: Date = new Date()): ServerEvent[] {
  return events.filter((event) => {
    if (!isContestEvent(event) || event.cancelledAt || hasWinner(event)) return false;
    const ends = parseServerDate(event.endsAt);
    return Boolean(ends && ends.getTime() <= now.getTime());
  });
}

/**
 * The contest a listing was entered into.
 *
 * The catalog row carries the server's own column name; the withdraw reply and anything built from the
 * publish body carry the camel-cased one, so both are read.
 */
export function contestEntryIdOf(record: WorldRecord): string | null {
  const id = record.contest_event_id ?? record.contestEventId;
  return typeof id === 'string' && id ? id : null;
}

/** The listings entered into one contest. */
export function entriesOf(catalog: WorldRecord[], eventId: string | null | undefined): WorldRecord[] {
  if (!eventId) return [];
  return catalog.filter((record) => contestEntryIdOf(record) === eventId);
}

/** Whether this listing is the world a contest was won by. */
export function isContestWinner(record: WorldRecord, event: ServerEvent | null): boolean {
  if (!event?.winnerWorldId) return false;
  return String(record._id || record.id) === event.winnerWorldId;
}

/**
 * A deterministic shuffle, so an order that changes every visit is still one a test can name.
 *
 * The generator is a small integer hash rather than `Math.random`, which cannot be seeded — the seed is
 * what makes one visit's order stable across the renders within it.
 *
 * @param seed - Any number; the same seed always produces the same order
 */
export function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  let state = Math.floor(Math.abs(seed) * 1e9) + 1;
  const random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Likes on a listing, counting a missing number as none. */
const likesOf = (record: WorldRecord): number => Number(record.likes ?? 0) || 0;

/**
 * The order a contest's entries are shown in.
 *
 * While the contest runs the order is shuffled per visit, so entering early is not itself an advantage.
 * Once judging starts the shuffle would only obscure the standings, so entries settle by likes — and a
 * picked winner is pinned to the front of them.
 *
 * @param seed - The visit's shuffle seed; only read while the contest is live
 */
export function orderContestEntries(
  entries: WorldRecord[],
  event: ServerEvent | null,
  seed: number,
  now: Date = new Date(),
): WorldRecord[] {
  if (!event) return entries;
  if (contestPhase(event, now) === 'live') return shuffleWithSeed(entries, seed);

  const byLikes = [...entries].sort((a, b) => likesOf(b) - likesOf(a));
  const winner = byLikes.find((record) => isContestWinner(record, event));
  if (!winner) return byLikes;
  return [winner, ...byLikes.filter((record) => record !== winner)];
}

/**
 * Every contest a record won, out of the ones on hand, newest first.
 *
 * What puts the trophy on a world wherever it is shown — the community card and its details, the local
 * library card and its details. All of them, because a world that wins twice has won twice; dropping the
 * older title would quietly rank one honor above another.
 *
 * Two records answer to the same win: the listing, by its own server id, and a local copy, by the
 * `sourceId` its download or publish link carries — however it got there, and however much it has been
 * edited since. Only this question reads the link; whether a *listing* is the winning entry, which is
 * what pins one to the front of the contest grid, stays `isContestWinner`.
 *
 * A contest called off awarded nothing, whatever it had stamped before it was cancelled.
 */
export function contestsWonBy(record: WorldRecord, events: ServerEvent[]): ServerEvent[] {
  return events
    .filter((event) => isContestEvent(event) && !event.cancelledAt
      && (isContestWinner(record, event) || (Boolean(event.winnerWorldId) && record.sourceId === event.winnerWorldId)))
    .sort(byNewestStart);
}

/** One heading in the archive selector, and the contests filed under it. */
export interface ContestSection {
  /** The heading, as the selector renders it. */
  label: string;
  /** The contests it holds, newest first. */
  contests: ServerEvent[];
}

/** The heading over everything still going on — running, being judged, or not yet started. */
const CURRENT_LABEL = 'Current';

/** The heading a contest whose start cannot be read is filed under, rather than being dropped. */
const UNDATED_LABEL = 'Undated';

/**
 * The archive selector's sections: what has not concluded, then one heading per calendar year.
 *
 * Sixty contests is a wall of titles, and the one thing a reader is usually after — the contest running
 * now — is the one a flat list buries in the middle of it. The undecided ones lead as their own section
 * so "still happening" never reads as history, and the rest become a calendar.
 *
 * Nothing is capped or filtered: the archive is the record, so every contest handed in comes back under
 * some heading, including one whose window cannot be read at all.
 *
 * @param now - The instant to judge the phases against; defaults to the current time
 */
export function contestSections(contests: ServerEvent[], now: Date = new Date()): ContestSection[] {
  const newestFirst = [...contests].sort(byNewestStart);

  const current: ServerEvent[] = [];
  const undated: ServerEvent[] = [];
  const years = new Map<number, ServerEvent[]>();

  newestFirst.forEach((contest) => {
    if (contestPhase(contest, now) !== 'decided') {
      current.push(contest);
      return;
    }
    const started = parseServerDate(contest.startsAt);
    if (!started) {
      undated.push(contest);
      return;
    }
    const year = started.getFullYear();
    const bucket = years.get(year);
    if (bucket) bucket.push(contest);
    else years.set(year, [contest]);
  });

  const sections: ContestSection[] = [];
  if (current.length > 0) sections.push({ label: CURRENT_LABEL, contests: current });
  [...years.keys()]
    .sort((a, b) => b - a)
    .forEach((year) => sections.push({ label: String(year), contests: years.get(year) ?? [] }));
  if (undated.length > 0) sections.push({ label: UNDATED_LABEL, contests: undated });

  return sections;
}
