import { describe, it, expect } from 'vitest';
import {
  REPORT_DETAILS_MAX,
  reportCategoryLabel,
  reportCategoryTally,
  reportDraftError,
  reportTargetTitle,
  serverSupportsReports,
  sortReportGroups,
  withoutGroup,
  type QueuedReport,
  type ReportGroup,
} from './contentReports';

const report = (over: Partial<QueuedReport> = {}): QueuedReport => ({
  id: `r-${Math.random().toString(16).slice(2, 8)}`,
  reporter_id: 'u1',
  reporter_username: 'reporter',
  category: 'spam',
  details: null,
  created_at: '2026-08-01T12:00:00.000Z',
  target_gone_at: null,
  ...over,
});

const group = (over: Partial<ReportGroup> = {}): ReportGroup => ({
  target_kind: 'listing',
  target_id: 'w1',
  target_name: 'Sedge Landing',
  target_author_id: 'a1',
  target_author_username: 'author',
  target_author_role: null,
  target_snippet: 'A world for testing',
  target_parent_id: null,
  report_count: 1,
  first_reported_at: '2026-08-01T12:00:00.000Z',
  last_reported_at: '2026-08-01T12:00:00.000Z',
  target_gone: false,
  reports: [report()],
  ...over,
});

describe('detecting whether the server has reports at all', () => {
  it('says yes to a server that answers with its categories', () => {
    expect(serverSupportsReports({ categories: ['spam', 'other'] })).toBe(true);
  });

  it('says no when the request failed outright', () => {
    // A server that predates the feature 404s, and every control stays off screen rather than offering
    // an action that would fail.
    expect(serverSupportsReports(null)).toBe(false);
    expect(serverSupportsReports(undefined)).toBe(false);
  });

  it('says no to a payload with no categories in it', () => {
    expect(serverSupportsReports({})).toBe(false);
    expect(serverSupportsReports({ categories: [] })).toBe(false);
    expect(serverSupportsReports({ categories: 'spam' })).toBe(false);
  });
});

describe('validating a draft', () => {
  it('asks for a category before anything else', () => {
    expect(reportDraftError({ category: null, details: '' })).toMatch(/what is wrong/i);
  });

  it('accepts a category on its own — details are optional', () => {
    expect(reportDraftError({ category: 'spam', details: '' })).toBeNull();
  });

  it('refuses details past the server cap', () => {
    const error = reportDraftError({ category: 'spam', details: 'x'.repeat(REPORT_DETAILS_MAX + 1) });

    expect(error).toMatch(new RegExp(String(REPORT_DETAILS_MAX)));
  });

  it('measures the trimmed text, as the server does', () => {
    const padded = `${'x'.repeat(REPORT_DETAILS_MAX)}      `;

    expect(reportDraftError({ category: 'spam', details: padded })).toBeNull();
  });
});

describe('naming what was reported', () => {
  it('names a listing by its title', () => {
    expect(reportTargetTitle(group())).toBe('Listing: Sedge Landing');
  });

  it('names a comment by where it sits', () => {
    expect(reportTargetTitle(group({ target_kind: 'comment' }))).toBe('Comment on "Sedge Landing"');
  });

  it('names a profile by the username', () => {
    expect(reportTargetTitle(group({ target_kind: 'profile', target_name: 'offender' })))
      .toBe('Profile: offender');
  });

  it('falls back to the kind when the snapshot has no name', () => {
    expect(reportTargetTitle(group({ target_name: null }))).toBe('Listing');
  });
});

describe('reading a pile-on', () => {
  it('counts each category rather than listing every report', () => {
    const tally = reportCategoryTally(group({
      report_count: 4,
      reports: [
        report({ category: 'spam' }),
        report({ category: 'spam' }),
        report({ category: 'hate' }),
        report({ category: 'spam' }),
      ],
    }));

    expect(tally).toEqual([
      { category: 'spam', count: 3 },
      { category: 'hate', count: 1 },
    ]);
  });

  it('breaks a tie by name, so the order does not shuffle between reads', () => {
    const tally = reportCategoryTally(group({
      reports: [report({ category: 'spam' }), report({ category: 'hate' })],
    }));

    expect(tally.map((row) => row.category)).toEqual(['hate', 'spam']);
  });

  it('labels a category the client has never heard of with its raw value', () => {
    // The server owns the list; a deploy that adds one ahead of the client must not render a blank chip.
    expect(reportCategoryLabel('doxxing')).toBe('doxxing');
    expect(reportCategoryLabel('hate')).toBe('Hate or harassment');
  });
});

describe('ordering the queue', () => {
  it('puts the worst category first, however few said it', () => {
    const sorted = sortReportGroups([
      group({ target_id: 'spammy', report_count: 6, reports: Array.from({ length: 6 }, () => report({ category: 'spam' })) }),
      group({ target_id: 'illegal', report_count: 1, reports: [report({ category: 'illegal' })] }),
    ]);

    expect(sorted.map((row) => row.target_id)).toEqual(['illegal', 'spammy']);
  });

  it('breaks a severity tie by how many reported it', () => {
    const sorted = sortReportGroups([
      group({ target_id: 'one', report_count: 1, reports: [report({ category: 'hate' })] }),
      group({ target_id: 'many', report_count: 5, reports: [report({ category: 'hate' })] }),
    ]);

    expect(sorted.map((row) => row.target_id)).toEqual(['many', 'one']);
  });

  it('breaks a full tie by the most recent report', () => {
    const sorted = sortReportGroups([
      group({ target_id: 'older', last_reported_at: '2026-08-01T00:00:00.000Z', reports: [report({ category: 'hate' })] }),
      group({ target_id: 'newer', last_reported_at: '2026-08-09T00:00:00.000Z', reports: [report({ category: 'hate' })] }),
    ]);

    expect(sorted.map((row) => row.target_id)).toEqual(['newer', 'older']);
  });

  it('ranks a category it does not know below every one it does', () => {
    const sorted = sortReportGroups([
      group({ target_id: 'unknown', reports: [report({ category: 'doxxing' })] }),
      group({ target_id: 'known', reports: [report({ category: 'other' })] }),
    ]);

    expect(sorted.map((row) => row.target_id)).toEqual(['known', 'unknown']);
  });

  it('leaves the array it was given alone', () => {
    const queue = [
      group({ target_id: 'spammy', reports: [report({ category: 'spam' })] }),
      group({ target_id: 'illegal', reports: [report({ category: 'illegal' })] }),
    ];

    sortReportGroups(queue);

    expect(queue.map((row) => row.target_id)).toEqual(['spammy', 'illegal']);
  });
});

describe('taking a resolved group out of the queue', () => {
  it('removes only the target that was resolved', () => {
    const queue = [
      group({ target_kind: 'listing', target_id: 'w1' }),
      group({ target_kind: 'comment', target_id: 'c1' }),
    ];

    const left = withoutGroup(queue, { target_kind: 'listing', target_id: 'w1' });

    expect(left.map((row) => row.target_id)).toEqual(['c1']);
  });

  it('keeps a different kind that happens to share an id', () => {
    // The pair is the key, not the id: nothing stops a comment and a listing carrying the same one.
    const queue = [
      group({ target_kind: 'listing', target_id: 'same' }),
      group({ target_kind: 'comment', target_id: 'same' }),
    ];

    const left = withoutGroup(queue, { target_kind: 'listing', target_id: 'same' });

    expect(left).toHaveLength(1);
    expect(left[0].target_kind).toBe('comment');
  });
});
