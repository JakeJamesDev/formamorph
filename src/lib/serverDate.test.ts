import { describe, it, expect } from 'vitest';
import { formatServerDateTime, parseServerDate } from './serverDate';

describe('parseServerDate', () => {
  // Asserted as instants rather than formatted strings: a formatted comparison agrees with itself on a
  // machine already running in UTC, so it would stop catching the bug on exactly the CI box most likely
  // to run it.
  it('reads a bare server timestamp as UTC, not as local time', () => {
    // SQLite's CURRENT_TIMESTAMP is UTC but carries no zone marker. Handed to `new Date` as-is it is
    // read as local time, so every server date displays off by the viewer's offset.
    expect(parseServerDate('2026-07-30 12:00:00')?.toISOString()).toBe('2026-07-30T12:00:00.000Z');
  });

  it('leaves an ISO timestamp alone', () => {
    // The app writes its own local timestamps with `toISOString`; those already carry a zone.
    expect(parseServerDate('2026-07-30T12:00:00.000Z')?.toISOString()).toBe('2026-07-30T12:00:00.000Z');
  });

  it('preserves an explicit non-UTC offset', () => {
    expect(parseServerDate('2026-07-30T12:00:00+05:00')?.toISOString()).toBe('2026-07-30T07:00:00.000Z');
  });

  it('returns null for an unparseable value', () => {
    expect(parseServerDate('not a date')).toBeNull();
  });

  it('returns null for an empty string', () => {
    // The profile dialog passes `String(createdAt ?? '')` for an account whose profile hasn't loaded yet.
    expect(parseServerDate('')).toBeNull();
  });
});

describe('formatServerDateTime', () => {
  it('renders a parseable timestamp', () => {
    expect(formatServerDateTime('2026-07-30 12:00:00')).toBeTruthy();
  });

  it('returns an empty string for an unparseable value', () => {
    expect(formatServerDateTime('not a date')).toBe('');
  });
});
