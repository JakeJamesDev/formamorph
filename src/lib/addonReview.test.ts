import { describe, expect, it } from 'vitest';
import {
  durationLabel,
  pendingCount,
  reviewRows,
  stageAcknowledgment,
  stageDecision,
  visibleRows,
  waitingLabel,
  type PendingReviews,
} from '@/lib/addonReview';
import type { AddonRow } from '@/lib/worldDependencies';

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-13T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW - days * DAY).toISOString();

/** One offering as the add-on route answers it. */
function offer(over: Partial<AddonRow> & { _id: string }): AddonRow {
  return {
    kind: 'entity',
    name: 'Marsh Warden',
    author: { username: 'quill' },
    reviewState: 'unreviewed',
    updatedSinceReview: false,
    offeredAt: daysAgo(10),
    created_at: daysAgo(40),
    updated_at: daysAgo(2),
    ...over,
  };
}

const rowsOf = (addons: AddonRow[], pending: PendingReviews = {}) => reviewRows(addons, pending);
const rowFor = (addons: AddonRow[], id: string, pending: PendingReviews = {}) =>
  rowsOf(addons, pending).find((row) => row.id === id)!;

describe('reviewRows', () => {
  it('reads the saved answer, the author and the kind off the offering', () => {
    const [row] = rowsOf([offer({ _id: 'a', kind: 'dictionary', reviewState: 'approved' })]);

    expect(row).toMatchObject({
      id: 'a',
      name: 'Marsh Warden',
      author: 'quill',
      kindLabel: 'Dictionary',
      saved: 'approved',
      state: 'approved',
      pending: false,
      needsAttention: false,
    });
  });

  it('waits from the offer date while unreviewed, not from the listing\'s own dates', () => {
    const [row] = rowsOf([offer({ _id: 'a', offeredAt: daysAgo(10), created_at: daysAgo(40) })]);

    expect(row.waitingSince).toBe(Date.parse(daysAgo(10)));
    expect(waitingLabel(row, NOW)).toBe('Waiting 10 days');
  });

  it('waits from the change when the source moved after the answer', () => {
    const [row] = rowsOf([offer({
      _id: 'a', reviewState: 'approved', updatedSinceReview: true,
      reviewedAt: daysAgo(9), updated_at: daysAgo(3),
    })]);

    expect(row.needsAttention).toBe(true);
    expect(row.showUpdatedBadge).toBe(true);
    expect(waitingLabel(row, NOW)).toBe('Waiting 3 days');
  });

  it('reports when a settled row was answered rather than a waiting time', () => {
    const [row] = rowsOf([offer({ _id: 'a', reviewState: 'declined', reviewedAt: daysAgo(4) })]);

    expect(row.needsAttention).toBe(false);
    expect(waitingLabel(row, NOW)).toBe('Reviewed 4 days ago');
  });

  it('shows the staged answer on the control and drops the update badge for it', () => {
    const addons = [offer({ _id: 'a', reviewState: 'approved', updatedSinceReview: true })];

    const row = rowFor(addons, 'a', { a: 'declined' });

    expect(row).toMatchObject({ saved: 'approved', state: 'declined', pending: true });
    // The stage is the acknowledgment, so the two badges never contradict each other.
    expect(row.showUpdatedBadge).toBe(false);
    expect(row.updatedSinceReview).toBe(true);
  });
});

describe('visibleRows', () => {
  const addons = [
    offer({ _id: 'new', name: 'Newest', reviewState: 'unreviewed', offeredAt: daysAgo(1), updated_at: daysAgo(1) }),
    offer({ _id: 'old', name: 'Oldest', reviewState: 'unreviewed', offeredAt: daysAgo(20), updated_at: daysAgo(20) }),
    offer({ _id: 'ok', name: 'Settled', reviewState: 'approved', reviewedAt: daysAgo(5), updated_at: daysAgo(12) }),
    offer({ _id: 'no', name: 'Refused', reviewState: 'declined', reviewedAt: daysAgo(6), updated_at: daysAgo(7) }),
    offer({
      _id: 'moved', name: 'Changed', reviewState: 'approved', updatedSinceReview: true,
      reviewedAt: daysAgo(8), updated_at: daysAgo(4),
    }),
  ];

  it('shows the unreviewed and the changed under Needs Attention, oldest waiting first', () => {
    const shown = visibleRows(rowsOf(addons), 'attention', 'oldestWaiting');

    expect(shown.map((row) => row.id)).toEqual(['old', 'moved', 'new']);
  });

  it('answers each of the other filters with its own saved state', () => {
    const rows = rowsOf(addons);

    expect(visibleRows(rows, 'all', 'name').map((r) => r.id).sort()).toEqual(['moved', 'new', 'no', 'ok', 'old']);
    expect(visibleRows(rows, 'declined', 'name').map((r) => r.id)).toEqual(['no']);
    expect(visibleRows(rows, 'approved', 'name').map((r) => r.id).sort()).toEqual(['moved', 'ok']);
    expect(visibleRows(rows, 'unreviewed', 'name').map((r) => r.id).sort()).toEqual(['new', 'old']);
  });

  it('keeps a staged row on screen under a filter its saved state fails', () => {
    // Answered, unchanged, and so out of the attention list. Staged from Everything, then Show switched
    // back: the row has to stay, or the change goes with it and the author never sees it leave.
    const rows = rowsOf(addons, { ok: 'declined' });

    expect(visibleRows(rows, 'attention', 'oldestWaiting').map((r) => r.id)).toEqual(['old', 'ok', 'moved', 'new']);
  });

  it('filters on the saved state, so answering a row does not move it out from under the cursor', () => {
    const rows = rowsOf(addons, { old: 'approved' });

    expect(visibleRows(rows, 'attention', 'oldestWaiting').map((r) => r.id)).toEqual(['old', 'moved', 'new']);
  });

  it('orders by each of the other sorts', () => {
    const rows = rowsOf(addons);

    expect(visibleRows(rows, 'all', 'newestWaiting').map((r) => r.id)).toEqual(['new', 'moved', 'ok', 'no', 'old']);
    expect(visibleRows(rows, 'all', 'name').map((r) => r.name)).toEqual(['Changed', 'Newest', 'Oldest', 'Refused', 'Settled']);
    // Not the same order as newestWaiting: a settled row's clock runs from its answer, not its last change.
    expect(visibleRows(rows, 'all', 'recentlyUpdated').map((r) => r.id)).toEqual(['new', 'moved', 'no', 'ok', 'old']);
  });

  it('orders by author, then by name within one author', () => {
    const byAuthor = [
      offer({ _id: 'b', name: 'Second', author: { username: 'quill' } }),
      offer({ _id: 'c', name: 'First', author: { username: 'quill' } }),
      offer({ _id: 'a', name: 'Only', author: { username: 'ash' } }),
    ];

    expect(visibleRows(rowsOf(byAuthor), 'all', 'author').map((r) => r.id)).toEqual(['a', 'c', 'b']);
  });

  it('breaks a tie by name rather than leaving the order to the sort', () => {
    const sameDay = [
      offer({ _id: 'b', name: 'Beta', offeredAt: daysAgo(3) }),
      offer({ _id: 'a', name: 'Alpha', offeredAt: daysAgo(3) }),
    ];

    expect(visibleRows(rowsOf(sameDay), 'all', 'oldestWaiting').map((r) => r.name)).toEqual(['Alpha', 'Beta']);
  });
});

describe('staging', () => {
  const settled = [offer({ _id: 'a', reviewState: 'approved', updatedSinceReview: false })];
  const changed = [offer({ _id: 'a', reviewState: 'approved', updatedSinceReview: true })];

  it('stages a decision that differs from the saved answer', () => {
    const next = stageDecision({}, rowFor(settled, 'a'), 'declined');

    expect(next).toEqual({ a: 'declined' });
    expect(pendingCount(next)).toBe(1);
  });

  it('drops the stage when the answer returns to the saved one', () => {
    const staged = stageDecision({}, rowFor(settled, 'a'), 'declined');

    const back = stageDecision(staged, rowFor(settled, 'a', staged), 'approved');

    expect(back).toEqual({});
  });

  it('keeps the same answer staged on a changed source, because that is the acknowledgment', () => {
    const staged = stageDecision({}, rowFor(changed, 'a'), 'declined');

    const back = stageDecision(staged, rowFor(changed, 'a', staged), 'approved');

    expect(back).toEqual({ a: 'approved' });
  });

  it('stages Mark Reviewed as the answer that already stands', () => {
    const next = stageAcknowledgment({}, rowFor(changed, 'a'));

    expect(next).toEqual({ a: 'approved' });
    expect(rowFor(changed, 'a', next).pending).toBe(true);
  });

  it('acknowledges against the staged answer, not the saved one', () => {
    const staged = { a: 'declined' } as PendingReviews;

    expect(stageAcknowledgment(staged, rowFor(changed, 'a', staged))).toEqual({ a: 'declined' });
  });
});

describe('durationLabel', () => {
  it('reads as a phrase at each step', () => {
    expect(durationLabel(0)).toBe('less than a day');
    expect(durationLabel(DAY * 1.5)).toBe('1 day');
    expect(durationLabel(DAY * 12)).toBe('12 days');
    expect(durationLabel(DAY * 30)).toBe('1 month');
    expect(durationLabel(DAY * 95)).toBe('3 months');
  });

  it('reads a clock skew as no time at all rather than a negative span', () => {
    expect(durationLabel(-DAY)).toBe('less than a day');
  });
});
