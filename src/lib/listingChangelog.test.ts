import { describe, it, expect } from 'vitest';
import {
  CHANGELOG_BODY_MAX,
  CHANGELOG_TITLE_MAX,
  changelogDraftError,
  changelogOf,
  defaultChangelogTab,
  formatChangelogDate,
  isCalendarDate,
  sortChangelogEntries,
  todayForDateInput,
  type ChangelogEntry,
} from './listingChangelog';

const entry = (over: Partial<ChangelogEntry> = {}): ChangelogEntry => ({
  id: 'e1',
  world_id: 'w1',
  title: 'Update 1',
  body: 'The drowned quarter is walkable now.',
  entry_date: '2026-08-01',
  created_at: '2026-08-01T12:00:00.000Z',
  updated_at: '2026-08-01T12:00:00.000Z',
  ...over,
});

const draft = (over: Partial<{ title: string; body: string; date: string }> = {}) => ({
  title: 'Update 1',
  body: 'The drowned quarter is walkable now.',
  date: '2026-08-01',
  ...over,
});

describe('ordering a changelog', () => {
  it('puts the newest authored date first', () => {
    const sorted = sortChangelogEntries([
      entry({ id: 'old', entry_date: '2026-01-01' }),
      entry({ id: 'new', entry_date: '2026-08-01' }),
      entry({ id: 'mid', entry_date: '2026-07-01' }),
    ]);

    expect(sorted.map((e) => e.id)).toEqual(['new', 'mid', 'old']);
  });

  it('breaks a same-day tie by which was written last', () => {
    // Two entries dated the same day are common on a backfill, and an order that depends on which row
    // the database happened to hand back would reshuffle the panel on every fetch.
    const sorted = sortChangelogEntries([
      entry({ id: 'first', created_at: '2026-08-01T09:00:00.000Z' }),
      entry({ id: 'second', created_at: '2026-08-01T17:00:00.000Z' }),
    ]);

    expect(sorted.map((e) => e.id)).toEqual(['second', 'first']);
  });

  it('leaves the array it was given alone', () => {
    // The panel splices a new entry into the list it already holds and re-sorts; sorting in place would
    // mutate React state it does not own.
    const given = [entry({ id: 'old', entry_date: '2026-01-01' }), entry({ id: 'new', entry_date: '2026-08-01' })];

    sortChangelogEntries(given);

    expect(given.map((e) => e.id)).toEqual(['old', 'new']);
  });

  it('sorts an entry dated into the middle of a history it was added to last', () => {
    const held = sortChangelogEntries([
      entry({ id: 'new', entry_date: '2026-08-01' }),
      entry({ id: 'old', entry_date: '2026-01-01' }),
    ]);

    const after = sortChangelogEntries([...held, entry({ id: 'backfilled', entry_date: '2026-04-01' })]);

    expect(after.map((e) => e.id)).toEqual(['new', 'backfilled', 'old']);
  });
});

describe('a date an author may set', () => {
  it('takes a real calendar date', () => {
    expect(isCalendarDate('2026-08-01')).toBe(true);
    expect(isCalendarDate('2024-02-29')).toBe(true);
  });

  it('refuses a day that does not exist', () => {
    // The one a shape check alone lets through.
    expect(isCalendarDate('2026-02-31')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('2025-02-29')).toBe(false);
  });

  it('refuses anything that is not a bare day', () => {
    for (const value of ['', 'yesterday', '2026-8-1', '2026-08-01T00:00:00Z', '01/08/2026']) {
      expect(isCalendarDate(value)).toBe(false);
    }
  });

  it('reads back the day the author set, not the one UTC midnight lands on', () => {
    // `new Date('2026-08-01')` is midnight UTC, which is the previous evening anywhere west of Greenwich
    // — so a parsed date would show readers a day the author never wrote.
    const shown = formatChangelogDate('2026-08-01');

    expect(shown).toBe(new Date(2026, 7, 1).toLocaleDateString(undefined, { dateStyle: 'medium' }));
    expect(shown).not.toBe(new Date(2026, 6, 31).toLocaleDateString(undefined, { dateStyle: 'medium' }));
  });

  it('shows an unrecognizable date as it stands rather than as "Invalid Date"', () => {
    expect(formatChangelogDate('whenever')).toBe('whenever');
  });

  it('defaults to the local day, not the UTC one', () => {
    // Late evening west of Greenwich is already tomorrow in UTC, and an author writing then would be
    // handed a date they never picked. The local and UTC days only diverge when the runner has an
    // offset — this bites on a westward dev machine and is vacuously true on a UTC CI runner.
    const lateEvening = new Date(2026, 7, 1, 23, 30);

    expect(todayForDateInput(lateEvening)).toBe('2026-08-01');
  });
});

describe('what a draft has to say', () => {
  it('accepts a filled-in entry', () => {
    expect(changelogDraftError(draft())).toBeNull();
  });

  it('refuses a title that is only spaces', () => {
    expect(changelogDraftError(draft({ title: '   ' }))).toBeTruthy();
  });

  it('refuses a body that is only spaces', () => {
    expect(changelogDraftError(draft({ body: '  ' }))).toBeTruthy();
  });

  it('holds the same caps the server does', () => {
    expect(changelogDraftError(draft({ title: 'x'.repeat(CHANGELOG_TITLE_MAX) }))).toBeNull();
    expect(changelogDraftError(draft({ title: 'x'.repeat(CHANGELOG_TITLE_MAX + 1) }))).toBeTruthy();
    expect(changelogDraftError(draft({ body: 'x'.repeat(CHANGELOG_BODY_MAX) }))).toBeNull();
    expect(changelogDraftError(draft({ body: 'x'.repeat(CHANGELOG_BODY_MAX + 1) }))).toBeTruthy();
  });

  it('refuses a date the server would refuse', () => {
    expect(changelogDraftError(draft({ date: '2026-02-31' }))).toBeTruthy();
    expect(changelogDraftError(draft({ date: '' }))).toBeTruthy();
  });
});

describe('telling an empty changelog from a server that has none', () => {
  it('reads an array the server sent, however empty', () => {
    expect(changelogOf({ changelog: [] })).toEqual([]);
    expect(changelogOf({ changelog: [entry()] })).toHaveLength(1);
  });

  it('answers null when the field is absent, which is what an old deploy sends', () => {
    expect(changelogOf({})).toBeNull();
    expect(changelogOf(null)).toBeNull();
    expect(changelogOf(undefined)).toBeNull();
  });

  it('answers null rather than trusting a field of the wrong shape', () => {
    expect(changelogOf({ changelog: 'nope' })).toBeNull();
    expect(changelogOf({ changelog: 3 })).toBeNull();
  });

  it('hands back the entries in reading order', () => {
    const read = changelogOf({
      changelog: [entry({ id: 'old', entry_date: '2026-01-01' }), entry({ id: 'new', entry_date: '2026-08-01' })],
    });

    expect(read?.map((e) => e.id)).toEqual(['new', 'old']);
  });
});

describe('which panel opens first', () => {
  it('opens on the changelog for a reader whose copy is out of date', () => {
    // The one moment "what changed?" is the question in front of them.
    expect(defaultChangelogTab([entry()], 'update')).toBe('changelog');
  });

  it('opens on comments for everybody else', () => {
    expect(defaultChangelogTab([entry()], 'none')).toBe('comments');
    expect(defaultChangelogTab([entry()], 'refresh')).toBe('comments');
  });

  it('opens on comments when there is no changelog to open on', () => {
    expect(defaultChangelogTab([], 'update')).toBe('comments');
    expect(defaultChangelogTab(null, 'update')).toBe('comments');
  });
});
