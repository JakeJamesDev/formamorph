import { describe, it, expect } from 'vitest';
import {
  adminEventState,
  toLocalInputValue,
  fromLocalInputValue,
  adminEventActions,
  adminEventSummary,
  groupAdminEvents,
  winnerBlockReason,
} from './adminEvents';
import type { ServerEvent } from '@/types';

const NOW = new Date('2026-08-20T12:00:00Z');
const day = 86_400_000;
const at = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * day).toISOString();

const event = (over: Partial<ServerEvent> = {}): ServerEvent => ({
  id: 'e1',
  type: 'contest',
  title: 'Summer Isles Contest',
  bannerText: 'Enter by September.',
  body: 'Build a world among the Summer Isles.',
  rulesText: 'One entry per creator.',
  startsAt: at(-4),
  endsAt: at(8),
  cancelledAt: null,
  startMessageId: 'm1',
  endMessageId: null,
  winnerMessageId: null,
  winnerWorldId: null,
  winnerName: null,
  winnerAuthorName: null,
  ...over,
});

describe('which state an event is in', () => {
  it('is active inside its window', () => {
    expect(adminEventState(event(), NOW)).toBe('active');
  });

  it('is scheduled before its window opens', () => {
    expect(adminEventState(event({ startsAt: at(2), endsAt: at(9) }), NOW)).toBe('scheduled');
  });

  it('is judging once a contest closes with no winner', () => {
    expect(adminEventState(event({ startsAt: at(-9), endsAt: at(-1) }), NOW)).toBe('judging');
  });

  it('is ended once a contest has a winner', () => {
    const decided = event({ startsAt: at(-9), endsAt: at(-1), winnerWorldId: 'w1', winnerName: 'Lantern Reef' });

    expect(adminEventState(decided, NOW)).toBe('ended');
  });

  it('is ended for a closed announcement, which has no winner to wait for', () => {
    const notice = event({ type: 'announcement', startsAt: at(-9), endsAt: at(-1) });

    expect(adminEventState(notice, NOW)).toBe('ended');
  });

  it('is cancelled whatever the clock says', () => {
    expect(adminEventState(event({ cancelledAt: at(-1) }), NOW)).toBe('cancelled');
  });

  it('counts the closing instant as closed, not as one more moment of running', () => {
    expect(adminEventState(event({ startsAt: at(-4), endsAt: NOW.toISOString() }), NOW)).toBe('judging');
  });
});

describe('grouping the calendar', () => {
  const running = event({ id: 'running' });
  const judging = event({ id: 'judging', startsAt: at(-20), endsAt: at(-2) });
  const soon = event({ id: 'soon', startsAt: at(3), endsAt: at(10) });
  const over = event({ id: 'over', startsAt: at(-40), endsAt: at(-30), winnerName: 'Lantern Reef' });
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
  it('offers a moderator the winner pick and nothing else', () => {
    const judging = event({ startsAt: at(-9), endsAt: at(-1) });

    expect(adminEventActions(judging, false, NOW)).toEqual({
      pickWinner: true, edit: false, cancel: false, remove: false,
    });
  });

  it('offers an administrator the edit and the cancel while an event runs', () => {
    expect(adminEventActions(event(), true, NOW)).toMatchObject({ edit: true, cancel: true });
  });

  it('offers no winner pick until the entries close', () => {
    expect(adminEventActions(event(), true, NOW).pickWinner).toBe(false);
  });

  it('offers no winner pick once one has been named', () => {
    const decided = event({ startsAt: at(-9), endsAt: at(-1), winnerName: 'Lantern Reef' });

    expect(adminEventActions(decided, true, NOW).pickWinner).toBe(false);
  });

  it('offers delete only before a start, when nobody has been told anything', () => {
    const scheduled = event({ startsAt: at(2), endsAt: at(9) });

    expect(adminEventActions(scheduled, true, NOW).remove).toBe(true);
    expect(adminEventActions(event(), true, NOW).remove).toBe(false);
  });

  it('offers nothing on an event already called off', () => {
    expect(adminEventActions(event({ cancelledAt: at(-1) }), true, NOW)).toEqual({
      pickWinner: false, edit: false, cancel: false, remove: false,
    });
  });
});

describe('the line under the title', () => {
  it('names the winner once there is one', () => {
    const decided = event({
      startsAt: at(-9), endsAt: at(-1), winnerName: 'Lantern Reef', winnerAuthorName: 'suneater',
    });

    expect(adminEventSummary(decided, NOW)).toBe('Won by Lantern Reef — suneater');
  });

  it('says a closed contest is waiting on one', () => {
    expect(adminEventSummary(event({ startsAt: at(-9), endsAt: at(-1) }), NOW))
      .toBe('Closed for entries — waiting on a winner');
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

describe('which entries cannot win', () => {
  it('refuses a quarantined entry', () => {
    expect(winnerBlockReason({ authorId: 'u2', quarantined: true }, 'u1')).toBe('Quarantined');
  });

  it('refuses the picker their own entry', () => {
    expect(winnerBlockReason({ authorId: 'u1', quarantined: false }, 'u1')).toBe('Your entry');
  });

  it('allows anyone else', () => {
    expect(winnerBlockReason({ authorId: 'u2', quarantined: false }, 'u1')).toBeNull();
  });

  it('reads a missing author as one the picker does not own, the server being the authority anyway', () => {
    expect(winnerBlockReason({ authorId: null, quarantined: false }, 'u1')).toBeNull();
  });
});
