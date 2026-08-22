import { describe, it, expect } from 'vitest';
import {
  adminEventState,
  toLocalInputValue,
  fromLocalInputValue,
  adminEventActions,
  adminEventSummary,
  groupAdminEvents,
  entryBlockReason,
} from './adminEvents';
import { daysFrom, serverEvent } from '@/test/serverEvents';
import type { ServerEvent } from '@/types';

const NOW = new Date('2026-08-20T12:00:00Z');
const at = (offsetDays: number) => daysFrom(offsetDays, NOW);

/**
 * A contest whose results are out. The stamp rides with the podium, as it does on the server: assigning
 * a place is not announcing it, and a fixture that split them would test a state nothing produces.
 */
const decided = (over: Partial<ServerEvent> = {}): ServerEvent => event({
  startsAt: at(-9),
  endsAt: at(-1),
  resultsAnnouncedAt: at(-1),
  resultsMessageId: 'm-results',
  placements: [{ place: 1, worldId: 'w1', worldName: 'Lantern Reef', authorName: 'suneater' }],
  ...over,
});

const event = (over: Partial<ServerEvent> = {}): ServerEvent =>
  serverEvent({ title: 'Summer Isles Contest', startsAt: at(-4), endsAt: at(8), ...over });

describe('which state an event is in', () => {
  it('is active inside its window', () => {
    expect(adminEventState(event(), NOW)).toBe('active');
  });

  it('is scheduled before its window opens', () => {
    expect(adminEventState(event({ startsAt: at(2), endsAt: at(9) }), NOW)).toBe('scheduled');
  });

  it('is judging once a contest closes with its results still to come', () => {
    expect(adminEventState(event({ startsAt: at(-9), endsAt: at(-1) }), NOW)).toBe('judging');
  });

  it('is ended once a contest has announced its results', () => {
    expect(adminEventState(decided(), NOW)).toBe('ended');
  });

  it('is ended for a closed announcement, which has no results to wait for', () => {
    const notice = event({ type: 'announcement', startsAt: at(-9), endsAt: at(-1) });

    expect(adminEventState(notice, NOW)).toBe('ended');
  });

  it('is canceled whatever the clock says', () => {
    expect(adminEventState(event({ cancelledAt: at(-1) }), NOW)).toBe('canceled');
  });

  it('counts the closing instant as closed, not as one more moment of running', () => {
    expect(adminEventState(event({ startsAt: at(-4), endsAt: NOW.toISOString() }), NOW)).toBe('judging');
  });
});

describe('grouping the calendar', () => {
  const running = event({ id: 'running' });
  const judging = event({ id: 'judging', startsAt: at(-20), endsAt: at(-2) });
  const soon = event({ id: 'soon', startsAt: at(3), endsAt: at(10) });
  const over = decided({ id: 'over', startsAt: at(-40), endsAt: at(-30) });
  const called_off = event({ id: 'called-off', cancelledAt: at(-1) });
  const all = [over, called_off, soon, judging, running];

  it('puts what is running and what is being judged under Happening Now', () => {
    const groups = groupAdminEvents(all, true, NOW);

    expect(groups.happeningNow.map((e) => e.id)).toEqual(['running', 'judging']);
  });

  it('separates what has not started from what is over', () => {
    const groups = groupAdminEvents(all, true, NOW);

    expect(groups.scheduled.map((e) => e.id)).toEqual(['soon']);
    expect(groups.past.map((e) => e.id)).toContain('over');
  });

  it('shows an administrator the events that were called off', () => {
    const groups = groupAdminEvents(all, true, NOW);

    expect(groups.past.map((e) => e.id)).toContain('called-off');
  });

  it('keeps them from a moderator, whose read of the calendar is about what is happening', () => {
    const groups = groupAdminEvents(all, false, NOW);

    expect(groups.past.map((e) => e.id)).not.toContain('called-off');
    expect(groups.past.map((e) => e.id)).toContain('over');
  });

  it('orders each group newest window first', () => {
    const older = event({ id: 'older', startsAt: at(1), endsAt: at(2) });
    const newer = event({ id: 'newer', startsAt: at(5), endsAt: at(6) });

    const groups = groupAdminEvents([older, newer], true, NOW);

    expect(groups.scheduled.map((e) => e.id)).toEqual(['newer', 'older']);
  });
});

describe('what a row offers', () => {
  it('offers a moderator nothing at all, the podium included', () => {
    // The tightening: announcing results speaks to every player at once, so it left the moderation team
    // along with scheduling and calling off.
    const judging = event({ startsAt: at(-9), endsAt: at(-1) });

    expect(adminEventActions(judging, false, NOW)).toEqual({
      announceResults: false, editPodium: false, edit: false, cancel: false, remove: false,
    });
  });

  it('offers an administrator the announce once the entries close', () => {
    const judging = event({ startsAt: at(-9), endsAt: at(-1) });

    expect(adminEventActions(judging, true, NOW))
      .toMatchObject({ announceResults: true, editPodium: false });
  });

  it('offers an administrator the edit and the cancel while an event runs', () => {
    expect(adminEventActions(event(), true, NOW)).toMatchObject({ edit: true, cancel: true });
  });

  it('offers no announce until the entries close', () => {
    expect(adminEventActions(event(), true, NOW).announceResults).toBe(false);
  });

  it('trades the announce for the edit once the results are out', () => {
    expect(adminEventActions(decided(), true, NOW))
      .toMatchObject({ announceResults: false, editPodium: true });
  });

  it('offers no podium edit on a contest that has not announced', () => {
    expect(adminEventActions(event({ startsAt: at(-9), endsAt: at(-1) }), true, NOW).editPodium).toBe(false);
  });

  it('offers no podium on an announcement, which has no entries to place', () => {
    const notice = event({ type: 'announcement', startsAt: at(-9), endsAt: at(-1) });

    expect(adminEventActions(notice, true, NOW))
      .toMatchObject({ announceResults: false, editPodium: false });
  });

  it('offers delete only before a start, when nobody has been told anything', () => {
    const scheduled = event({ startsAt: at(2), endsAt: at(9) });

    expect(adminEventActions(scheduled, true, NOW).remove).toBe(true);
    expect(adminEventActions(event(), true, NOW).remove).toBe(false);
  });

  it('offers nothing on an event already called off, a stored podium included', () => {
    expect(adminEventActions(decided({ cancelledAt: at(-1) }), true, NOW)).toEqual({
      announceResults: false, editPodium: false, edit: false, cancel: false, remove: false,
    });
  });
});

describe('the line under the title', () => {
  it('names first place once the results are out', () => {
    expect(adminEventSummary(decided(), NOW)).toBe('1st Place: Lantern Reef — suneater');
  });

  it('counts the rest of the podium rather than listing it', () => {
    const full = decided({
      placements: [
        { place: 1, worldId: 'w1', worldName: 'Lantern Reef', authorName: 'suneater' },
        { place: 2, worldId: 'w2', worldName: 'Nine Bells', authorName: 'marrowmoss' },
        { place: 3, worldId: 'w3', worldName: 'Kindling', authorName: 'ashgrove' },
      ],
    });

    expect(adminEventSummary(full, NOW)).toBe('1st Place: Lantern Reef — suneater (+2 more)');
  });

  it('says a closed contest is waiting on its results', () => {
    expect(adminEventSummary(event({ startsAt: at(-9), endsAt: at(-1) }), NOW))
      .toBe('Closed for entries — waiting on the results');
  });

  it('tells a running contest apart from a running notice', () => {
    expect(adminEventSummary(event(), NOW)).toBe('Open for entries');
    expect(adminEventSummary(event({ type: 'announcement' }), NOW)).toBe('Banner live');
  });
});

describe('the window fields', () => {
  it('shows an instant on the viewer own wall clock', () => {
    const iso = '2026-08-20T15:30:00.000Z';
    const local = toLocalInputValue(iso);

    // Whatever zone the test runs in, the field and the instant have to name the same moment.
    expect(new Date(local).getTime()).toBe(new Date(iso).getTime());
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('reads a server timestamp with no zone marker as the UTC it is', () => {
    expect(new Date(toLocalInputValue('2026-08-20 15:30:00')).getTime())
      .toBe(new Date('2026-08-20T15:30:00Z').getTime());
  });

  it('round-trips a field value back to the same instant', () => {
    const value = '2026-10-01T12:00';

    expect(toLocalInputValue(fromLocalInputValue(value) ?? '')).toBe(value);
  });

  it('has nothing to show for a missing timestamp, and nothing to send for an empty field', () => {
    expect(toLocalInputValue(null)).toBe('');
    expect(fromLocalInputValue('')).toBeNull();
  });
});

describe('which entries cannot be placed', () => {
  it('refuses a quarantined entry', () => {
    expect(entryBlockReason({ authorId: 'u2', quarantined: true }, 'u1')).toBe('Quarantined');
  });

  it('refuses the judge their own entry', () => {
    expect(entryBlockReason({ authorId: 'u1', quarantined: false }, 'u1')).toBe('Your entry');
  });

  it('allows anyone else', () => {
    expect(entryBlockReason({ authorId: 'u2', quarantined: false }, 'u1')).toBeNull();
  });

  it('reads a missing author as one the judge does not own, the server being the authority anyway', () => {
    expect(entryBlockReason({ authorId: null, quarantined: false }, 'u1')).toBeNull();
  });
});
