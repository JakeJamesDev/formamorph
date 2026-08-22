import { describe, it, expect } from 'vitest';
import {
  activeContestOf, contestPhase, contestsOf, contestEntryIdOf, contestsWonBy, entriesOf, isContestRunning,
  isContestWinner, judgingContestsOf, orderContestEntries, shuffleWithSeed,
} from './contests';
import { daysFrom, serverEvent as event } from '@/test/serverEvents';
import type { WorldRecord } from '@/components/WorldDetails';

const at = (offsetDays: number) => daysFrom(offsetDays);

const entry = (id: string, likes: number, eventId: string | null = 'e1'): WorldRecord => ({
  _id: id, name: id, likes, contest_event_id: eventId,
});

describe('which state a contest is in', () => {
  it('is live inside its window', () => {
    expect(contestPhase(event())).toBe('live');
    expect(isContestRunning(event())).toBe(true);
  });

  it('is judging once the window closes with no winner named', () => {
    expect(contestPhase(event({ startsAt: at(-20), endsAt: at(-2) }))).toBe('judging');
  });

  it('is decided the moment a winner is named, however much of the window is left', () => {
    expect(contestPhase(event({ winnerWorldId: 'w2' }))).toBe('decided');
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

describe('the contests still waiting on a winner', () => {
  it('is the closed contest with nothing decided — what the end poster is owed for', () => {
    const closed = event({ id: 'closed', startsAt: at(-20), endsAt: at(-2) });

    expect(judgingContestsOf([closed]).map((e) => e.id)).toEqual(['closed']);
  });

  it('drops a contest still taking entries, which has not ended to announce', () => {
    expect(judgingContestsOf([event()])).toEqual([]);
  });

  it('drops one whose winner has been picked — that news travels by broadcast and badge', () => {
    const decided = event({ startsAt: at(-20), endsAt: at(-2), winnerWorldId: 'w1', winnerName: 'Lantern Reef' });

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

  it('names the winner by the id the contest recorded', () => {
    const decided = event({ winnerWorldId: 'w2' });
    expect(isContestWinner(entry('w2', 0), decided)).toBe(true);
    expect(isContestWinner(entry('w1', 0), decided)).toBe(false);
    expect(isContestWinner(entry('w2', 0), event())).toBe(false);
  });

  it('finds the contest a listing won, so its card can say so anywhere', () => {
    const decided = event({ id: 'won', winnerWorldId: 'w2' });
    expect(contestsWonBy(entry('w2', 0), [event(), decided]).map((e) => e.id)).toEqual(['won']);
    expect(contestsWonBy(entry('w1', 0), [event(), decided])).toEqual([]);
  });

  it('finds it for a local copy too, by the listing its download link names', () => {
    // The library holds no listing id of its own; what ties a copy to the world that won is `sourceId`.
    const decided = event({ id: 'won', winnerWorldId: 'w2' });
    const copy: WorldRecord = { id: 'downloaded-abc', name: 'Saltmarsh', sourceId: 'w2' };
    expect(contestsWonBy(copy, [decided]).map((e) => e.id)).toEqual(['won']);
    expect(contestsWonBy({ id: 'downloaded-def', name: 'Other' }, [decided])).toEqual([]);
  });

  it('reports every contest one world has won, newest first', () => {
    const older = event({ id: 'older', startsAt: at(-400), endsAt: at(-380), winnerWorldId: 'w2' });
    const newer = event({ id: 'newer', startsAt: at(-40), endsAt: at(-20), winnerWorldId: 'w2' });
    expect(contestsWonBy(entry('w2', 0), [older, newer]).map((e) => e.id)).toEqual(['newer', 'older']);
  });

  it('awards nothing for a contest that was called off', () => {
    const cancelled = event({ id: 'off', winnerWorldId: 'w2', cancelledAt: at(-1) });
    expect(contestsWonBy(entry('w2', 0), [cancelled])).toEqual([]);
  });

  it('awards nothing for an announcement that happens to carry the id', () => {
    const announcement = event({ id: 'ann', type: 'announcement', winnerWorldId: 'w2' });
    expect(contestsWonBy(entry('w2', 0), [announcement])).toEqual([]);
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

  it('pins the winner in front of the likes once one is picked', () => {
    const decided = event({ winnerWorldId: 'w4', winnerName: 'w4' });
    expect(orderContestEntries(entries, decided, 0.42).map((w) => w._id)).toEqual(['w4', 'w2', 'w5', 'w3', 'w1']);
  });

  it('leaves the likes order alone when the winning world is no longer in the catalog', () => {
    const decided = event({ winnerWorldId: 'gone', winnerName: 'Gone' });
    expect(orderContestEntries(entries, decided, 0.42).map((w) => w._id)).toEqual(['w2', 'w5', 'w3', 'w1', 'w4']);
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
