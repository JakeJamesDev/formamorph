import { describe, it, expect } from 'vitest';
import {
  activeContestOf, contestPhase, contestsOf, contestEntryIdOf, entriesOf, isContestRunning,
  judgingContestsOf, orderContestEntries, placeInContest, placementsBy, shuffleWithSeed, contestSections,
  standingsOrder, tiedLikeCounts,
} from './contests';
import type { ContestSection } from './contests';
import { daysFrom, serverEvent as event } from '@/test/serverEvents';
import type { ServerEvent } from '@/types';
import { formatServerDate } from './serverDate';
import type { WorldRecord } from '@/components/WorldDetails';

const at = (offsetDays: number) => daysFrom(offsetDays);

const entry = (
  id: string,
  likes: number,
  eventId: string | null = 'e1',
  createdAt?: string,
): WorldRecord => ({
  _id: id, name: id, likes, contest_event_id: eventId, created_at: createdAt,
});

/** A podium out of world ids, gold first — the server's shape, minus the snapshots nobody asserts. */
const podium = (...worldIds: (string | null)[]) => worldIds.map((worldId, index) => ({
  place: (index + 1) as 1 | 2 | 3, worldName: worldId ?? 'Gone', authorName: 'an author', worldId,
}));

/** A contest whose results are out. The stamp always rides with the podium, as it does on the server. */
const decidedWith = (
  worldIds: (string | null)[],
  over: Partial<ServerEvent> = {},
): ServerEvent => event({ resultsAnnouncedAt: at(0), placements: podium(...worldIds), ...over });

describe('which state a contest is in', () => {
  it('is live inside its window', () => {
    expect(contestPhase(event())).toBe('live');
    expect(isContestRunning(event())).toBe(true);
  });

  it('is judging once the window closes with the results still to come', () => {
    expect(contestPhase(event({ startsAt: at(-20), endsAt: at(-2) }))).toBe('judging');
  });

  it('is decided the moment the results are announced, however much of the window is left', () => {
    expect(contestPhase(decidedWith(['w2']))).toBe('decided');
  });

  it('is not running before it starts, or once it has been called off', () => {
    expect(isContestRunning(event({ startsAt: at(2), endsAt: at(9) }))).toBe(false);
    expect(isContestRunning(event({ cancelledAt: at(-1) }))).toBe(false);
  });
});

describe('the contests worth showing', () => {
  it('puts the running one first and orders the rest newest first', () => {
    const ended = event({ id: 'old', startsAt: at(-40), endsAt: at(-30) });
    const recent = event({ id: 'recent', startsAt: at(-20), endsAt: at(-10) });
    const running = event({ id: 'now' });

    expect(contestsOf([ended, recent, running]).map((e) => e.id)).toEqual(['now', 'recent', 'old']);
  });

  it('drops announcements and canceled contests, which no longer happened', () => {
    const announcement = event({ id: 'a1', type: 'announcement' });
    const called_off = event({ id: 'c1', cancelledAt: at(-1) });

    expect(contestsOf([announcement, called_off, event()]).map((e) => e.id)).toEqual(['e1']);
  });
});

describe('the contests still waiting on their results', () => {
  it('is the closed contest with nothing decided — what the end poster is owed for', () => {
    const closed = event({ id: 'closed', startsAt: at(-20), endsAt: at(-2) });

    expect(judgingContestsOf([closed]).map((e) => e.id)).toEqual(['closed']);
  });

  it('drops a contest still taking entries, which has not ended to announce', () => {
    expect(judgingContestsOf([event()])).toEqual([]);
  });

  it('drops one whose results are out — that news travels by broadcast and badge', () => {
    const decided = decidedWith(['w1'], { startsAt: at(-20), endsAt: at(-2) });

    expect(judgingContestsOf([decided])).toEqual([]);
  });

  it('drops one that was called off, which ended in nothing to judge', () => {
    const called_off = event({ startsAt: at(-20), endsAt: at(-2), cancelledAt: at(-2) });

    expect(judgingContestsOf([called_off])).toEqual([]);
  });

  it('drops an announcement, whose ending is nobody to wait for', () => {
    const notice = event({ type: 'announcement', startsAt: at(-20), endsAt: at(-2) });

    expect(judgingContestsOf([notice])).toEqual([]);
  });

  it('drops one that has not started, which staff see in this same feed', () => {
    const scheduled = event({ id: 'soon', startsAt: at(4), endsAt: at(20) });

    expect(judgingContestsOf([scheduled])).toEqual([]);
  });

  it('drops one whose window cannot be read rather than announcing an undated ending', () => {
    expect(judgingContestsOf([event({ endsAt: 'not a date' })])).toEqual([]);
  });
});

describe('which listings belong to a contest', () => {
  it('reads the entry off the catalog row and off a camel-cased one alike', () => {
    expect(contestEntryIdOf({ contest_event_id: 'e1' })).toBe('e1');
    expect(contestEntryIdOf({ contestEventId: 'e1' })).toBe('e1');
    expect(contestEntryIdOf({ contest_event_id: null })).toBeNull();
  });

  it("gathers only this contest's entries", () => {
    const catalog = [entry('w1', 3), entry('w2', 1, 'other'), entry('w3', 0, null)];
    expect(entriesOf(catalog, 'e1').map((w) => w._id)).toEqual(['w1']);
    expect(entriesOf(catalog, null)).toEqual([]);
  });

  it('names which step a listing took, by the id the contest recorded', () => {
    const decided = decidedWith(['w1', 'w2', 'w3']);
    expect(placeInContest(entry('w1', 0), decided)).toBe(1);
    expect(placeInContest(entry('w2', 0), decided)).toBe(2);
    expect(placeInContest(entry('w3', 0), decided)).toBe(3);
    expect(placeInContest(entry('w9', 0), decided)).toBeNull();
    expect(placeInContest(entry('w1', 0), event())).toBeNull();
  });

  it('is null for a contest that is not there at all', () => {
    expect(placeInContest(entry('w1', 0), null)).toBeNull();
  });

  it('finds the contest a listing placed in, and its step, so a card can say both', () => {
    const decided = decidedWith(['w1', 'w2'], { id: 'won' });
    expect(placementsBy(entry('w2', 0), [event(), decided]))
      .toEqual([{ contest: decided, place: 2 }]);
    expect(placementsBy(entry('w9', 0), [event(), decided])).toEqual([]);
  });

  it('finds it for a local copy too, by the listing its download link names', () => {
    // The library holds no listing id of its own; what ties a copy to the world that placed is `sourceId`.
    const decided = decidedWith(['w2'], { id: 'won' });
    const copy: WorldRecord = { id: 'downloaded-abc', name: 'Saltmarsh', sourceId: 'w2' };
    expect(placementsBy(copy, [decided])).toEqual([{ contest: decided, place: 1 }]);
    expect(placementsBy({ id: 'downloaded-def', name: 'Other' }, [decided])).toEqual([]);
  });

  it('reports every contest one world has placed in, newest first, one line each', () => {
    const older = decidedWith(['a', 'w2'], { id: 'older', startsAt: at(-400), endsAt: at(-380) });
    const newer = decidedWith(['w2'], { id: 'newer', startsAt: at(-40), endsAt: at(-20) });
    expect(placementsBy(entry('w2', 0), [older, newer]).map((p) => [p.contest.id, p.place]))
      .toEqual([['newer', 1], ['older', 2]]);
  });

  it('awards nothing for a contest that was called off', () => {
    const cancelled = decidedWith(['w2'], { id: 'off', cancelledAt: at(-1) });
    expect(placementsBy(entry('w2', 0), [cancelled])).toEqual([]);
  });

  it('awards nothing for an announcement that happens to carry a podium', () => {
    const announcement = decidedWith(['w2'], { id: 'ann', type: 'announcement' });
    expect(placementsBy(entry('w2', 0), [announcement])).toEqual([]);
  });

  it('badges each world that shares a place with the place it shares, listing and local copy alike', () => {
    // Two golds and the bronze that competition ranking puts after them. The lookup is by world, so a
    // shared place is meant to need nothing new — this is what says so.
    const tied = event({
      resultsAnnouncedAt: at(0),
      placements: [
        { place: 1, worldId: 'w1', worldName: 'Gold', authorName: 'an author' },
        { place: 1, worldId: 'w2', worldName: 'Also Gold', authorName: 'an author' },
        { place: 3, worldId: 'w3', worldName: 'Bronze', authorName: 'an author' },
      ],
    });

    expect(placementsBy(entry('w1', 0), [tied]).map((p) => p.place)).toEqual([1]);
    expect(placementsBy(entry('w2', 0), [tied]).map((p) => p.place)).toEqual([1]);
    expect(placeInContest(entry('w3', 0), tied)).toBe(3);
    expect(placementsBy({ id: 'local-copy', name: 'Also Gold', sourceId: 'w2' }, [tied]).map((p) => p.place))
      .toEqual([1]);
  });

  it('never badges a world whose place lost its listing id', () => {
    // The snapshot survives a deletion; the id does not, and a record with no id must not answer to it.
    const decided = decidedWith([null], { id: 'won' });
    expect(placementsBy({ id: 'downloaded-abc', name: 'Gone' }, [decided])).toEqual([]);
  });
});

describe('the order entries are shown in', () => {
  const entries = [entry('w1', 1), entry('w2', 9), entry('w3', 4), entry('w4', 0), entry('w5', 7)];

  it('shuffles while the contest runs, so entering early is no advantage', () => {
    const first = orderContestEntries(entries, event(), 0.42).map((w) => w._id);
    const other = orderContestEntries(entries, event(), 0.77).map((w) => w._id);

    expect(first).not.toEqual(entries.map((w) => w._id));
    expect(first).not.toEqual(other);
    expect([...first].sort()).toEqual(['w1', 'w2', 'w3', 'w4', 'w5']);
  });

  it("holds one visit's order still, however often the grid re-renders", () => {
    expect(orderContestEntries(entries, event(), 0.42)).toEqual(orderContestEntries(entries, event(), 0.42));
  });

  it('settles by likes once judging starts, where a shuffle would only hide the standings', () => {
    const judging = event({ startsAt: at(-20), endsAt: at(-2) });
    expect(orderContestEntries(entries, judging, 0.42).map((w) => w._id)).toEqual(['w2', 'w5', 'w3', 'w1', 'w4']);
  });

  it('pins the whole podium in front of the likes, in podium order', () => {
    // w4 has the fewest likes and w1 the second fewest: podium order has to beat likes order, or the pin
    // means nothing for silver and bronze.
    const decided = decidedWith(['w4', 'w1', 'w3']);
    expect(orderContestEntries(entries, decided, 0.42).map((w) => w._id)).toEqual(['w4', 'w1', 'w3', 'w2', 'w5']);
  });

  it('pins gold alone when that is the whole podium', () => {
    expect(orderContestEntries(entries, decidedWith(['w4']), 0.42).map((w) => w._id))
      .toEqual(['w4', 'w2', 'w5', 'w3', 'w1']);
  });

  it('skips a placed world that is no longer in the catalog, keeping the rest pinned', () => {
    const decided = decidedWith(['gone', 'w4']);
    expect(orderContestEntries(entries, decided, 0.42).map((w) => w._id)).toEqual(['w4', 'w2', 'w5', 'w3', 'w1']);
  });

  it('leaves the likes order alone when no placed world is in the catalog', () => {
    expect(orderContestEntries(entries, decidedWith(['gone']), 0.42).map((w) => w._id))
      .toEqual(['w2', 'w5', 'w3', 'w1', 'w4']);
  });

  it('pins worlds that share a place in the order the podium stores them, not in likes order', () => {
    // w4 has the fewest likes of all five and w1 the second fewest, and both took 1st. Nothing but the
    // podium's own array order can put w4 in front of w1 here.
    const tied = event({
      resultsAnnouncedAt: at(0),
      placements: [
        { place: 1, worldId: 'w4', worldName: 'w4', authorName: 'an author' },
        { place: 1, worldId: 'w1', worldName: 'w1', authorName: 'an author' },
        { place: 3, worldId: 'w3', worldName: 'w3', authorName: 'an author' },
      ],
    });

    expect(orderContestEntries(entries, tied, 0.42).map((w) => w._id))
      .toEqual(['w4', 'w1', 'w3', 'w2', 'w5']);
  });

  it('breaks level like counts by publish time, earliest first', () => {
    const level = [entry('late', 5, 'e1', at(-2)), entry('early', 5, 'e1', at(-9)), entry('middle', 5, 'e1', at(-5))];
    const judging = event({ startsAt: at(-20), endsAt: at(-2) });

    expect(orderContestEntries(level, judging, 0.42).map((w) => w._id)).toEqual(['early', 'middle', 'late']);
  });

  it('sorts a listing whose publish time cannot be read last, rather than scrambling the rest', () => {
    // A stamp that cannot be read must not beat one that can, and two of them must still compare level —
    // which a sentinel of infinity would not, because the difference of two infinities is not a number.
    const level = [entry('junk', 5, 'e1', 'not a date'), entry('none', 5), entry('dated', 5, 'e1', at(-9))];
    const judging = event({ startsAt: at(-20), endsAt: at(-2) });

    expect(orderContestEntries(level, judging, 0.42).map((w) => w._id)).toEqual(['dated', 'junk', 'none']);
  });
});

describe('the standings', () => {
  const standing = (id: string, likes: number, publishedAt: number) => ({ id, likes, publishedAt });

  it('puts the most-liked entry first', () => {
    const order = standingsOrder([standing('a', 2, 0), standing('b', 9, 0), standing('c', 5, 0)]);
    expect(order.map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('breaks a level count by publish time, earliest first', () => {
    const order = standingsOrder([standing('late', 5, 900), standing('early', 5, 100), standing('mid', 5, 400)]);
    expect(order.map((s) => s.id)).toEqual(['early', 'mid', 'late']);
  });

  it('leaves the entries it was given alone', () => {
    // The grid re-derives this on every render, so a sort in place would reorder the state it reads.
    const given = [standing('a', 1, 0), standing('b', 9, 0)];
    standingsOrder(given);
    expect(given.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('marks every count two or more entries share, and no other', () => {
    const shared = tiedLikeCounts([
      standing('a', 9, 0), standing('b', 9, 0), standing('c', 4, 0), standing('d', 1, 0), standing('e', 1, 0),
    ]);
    expect([...shared].sort((x, y) => x - y)).toEqual([1, 9]);
  });

  it('marks a count three entries share once', () => {
    const shared = tiedLikeCounts([standing('a', 7, 0), standing('b', 7, 0), standing('c', 7, 0)]);
    expect([...shared]).toEqual([7]);
  });

  it('marks nothing when every count is its own', () => {
    expect(tiedLikeCounts([standing('a', 3, 0), standing('b', 2, 0)]).size).toBe(0);
  });

  it('marks a level count of zero, which is the count a quiet contest is full of', () => {
    expect(tiedLikeCounts([standing('a', 0, 0), standing('b', 0, 0)]).has(0)).toBe(true);
  });
});

describe('the seeded shuffle', () => {
  it('keeps every item exactly once', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect([...shuffleWithSeed(items, 0.13)].sort((a, b) => a - b)).toEqual(items);
  });

  it('leaves a one-item list alone rather than reaching past its end', () => {
    expect(shuffleWithSeed(['only'], 0.5)).toEqual(['only']);
    expect(shuffleWithSeed([], 0.5)).toEqual([]);
  });
});

describe('the contest taking entries right now', () => {
  it('is the running contest among the events', () => {
    const announcement = event({ id: 'a1', type: 'announcement' });
    expect(activeContestOf([announcement, event()])?.id).toBe('e1');
  });

  it('is nothing when the only contest has closed, however the poll still lists it', () => {
    expect(activeContestOf([event({ startsAt: at(-20), endsAt: at(-1) })])).toBeNull();
  });

  it('is nothing when the only contest was canceled', () => {
    expect(activeContestOf([event({ cancelledAt: at(-1) })])).toBeNull();
  });

  it('is nothing when no event is a contest', () => {
    expect(activeContestOf([event({ type: 'announcement' })])).toBeNull();
  });
});

describe('the archive selector’s sections', () => {
  // Fixed instants rather than offsets: a section is named after a calendar year, so which side of New
  // Year the suite runs on must not decide what it is called.
  const NOW = new Date('2026-08-22T12:00:00.000Z');
  const on = (iso: string) => iso;
  const labels = (sections: ContestSection[]) => sections.map((s) => s.label);
  const ids = (sections: ContestSection[]) => sections.map((s) => s.contests.map((c) => c.id));

  it('pins the running contest above the years', () => {
    const running = event({ id: 'now', startsAt: on('2026-08-01T00:00:00.000Z'), endsAt: on('2026-09-01T00:00:00.000Z') });
    const older = event({ id: 'spring', startsAt: on('2026-03-01T00:00:00.000Z'), endsAt: on('2026-04-01T00:00:00.000Z'), resultsAnnouncedAt: at(0), placements: podium('w1') });

    const sections = contestSections([older, running], NOW);

    expect(labels(sections)).toEqual(['Current', '2026']);
    expect(ids(sections)).toEqual([['now'], ['spring']]);
  });

  it('puts a contest being judged in that same top section, so undecided reads apart from history', () => {
    const judging = event({ id: 'judging', startsAt: on('2026-06-01T00:00:00.000Z'), endsAt: on('2026-07-01T00:00:00.000Z') });
    const decided = event({ id: 'decided', startsAt: on('2026-05-01T00:00:00.000Z'), endsAt: on('2026-06-01T00:00:00.000Z'), resultsAnnouncedAt: at(0), placements: podium('w1') });

    expect(ids(contestSections([decided, judging], NOW))).toEqual([['judging'], ['decided']]);
  });

  it('gives each year its own section, newest year first and newest contest first inside it', () => {
    const decided = (id: string, startsAt: string) =>
      event({ id, startsAt, endsAt: startsAt, resultsAnnouncedAt: at(0), placements: podium('w1') });
    // Mid-year instants, deliberately: the heading is the *local* year, matching the date the bar prints
    // beside the title, so a midnight-UTC start would name whichever year the runner's zone puts it in.
    const list = [
      decided('a', '2024-02-01T12:00:00.000Z'),
      decided('b', '2026-06-01T12:00:00.000Z'),
      decided('c', '2025-11-01T12:00:00.000Z'),
      decided('d', '2025-04-01T12:00:00.000Z'),
    ];

    const sections = contestSections(list, NOW);

    expect(labels(sections)).toEqual(['2026', '2025', '2024']);
    expect(ids(sections)).toEqual([['b'], ['c', 'd'], ['a']]);
  });

  it('heads a contest with the same year the bar prints beside its title', () => {
    // The archive is read as a calendar, so the heading and the date under it have to agree — which they
    // only do if both are read in the viewer's own zone.
    const newYear = event({ id: 'ny', startsAt: '2026-01-01T03:00:00.000Z', endsAt: '2026-02-01T00:00:00.000Z', resultsAnnouncedAt: at(0), placements: podium('w1') });

    const [section] = contestSections([newYear], NOW);

    expect(section.label).toBe(formatServerDate(newYear.startsAt).match(/\d{4}/)?.[0]);
  });

  it('drops the top section when nothing is undecided, rather than heading an empty list', () => {
    const decided = event({ id: 'decided', startsAt: on('2025-05-01T00:00:00.000Z'), endsAt: on('2025-06-01T00:00:00.000Z'), resultsAnnouncedAt: at(0), placements: podium('w1') });

    expect(labels(contestSections([decided], NOW))).toEqual(['2025']);
  });

  it('is empty for an empty archive, and one section for a single contest', () => {
    expect(contestSections([], NOW)).toEqual([]);
    expect(ids(contestSections([event({ id: 'only' })], NOW))).toEqual([['only']]);
  });

  it('keeps a contest whose start cannot be read, under its own heading', () => {
    const undated = event({ id: 'undated', startsAt: 'not a date', endsAt: 'not a date', resultsAnnouncedAt: at(0), placements: podium('w1') });
    const dated = event({ id: 'dated', startsAt: on('2025-05-01T00:00:00.000Z'), endsAt: on('2025-06-01T00:00:00.000Z'), resultsAnnouncedAt: at(0), placements: podium('w1') });

    const sections = contestSections([undated, dated], NOW);

    expect(labels(sections)).toEqual(['2025', 'Undated']);
    expect(ids(sections)).toEqual([['dated'], ['undated']]);
  });

  it('holds every contest it was handed, so nothing drops out of the record', () => {
    const list = [
      event({ id: 'now' }),
      event({ id: 'x', startsAt: on('2021-01-01T00:00:00.000Z'), endsAt: on('2021-02-01T00:00:00.000Z'), resultsAnnouncedAt: at(0), placements: podium('w1') }),
      event({ id: 'y', startsAt: on('2019-01-01T00:00:00.000Z'), endsAt: on('2019-02-01T00:00:00.000Z') }),
    ];

    expect(contestSections(list, NOW).flatMap((s) => s.contests).map((c) => c.id).sort())
      .toEqual(['now', 'x', 'y']);
  });
});
