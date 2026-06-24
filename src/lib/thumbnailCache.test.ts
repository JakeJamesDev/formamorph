import { describe, it, expect } from 'vitest';
import { toEpoch } from './thumbnailCache';

describe('toEpoch', () => {
  it('parses ISO 8601 (…T…Z) timestamps', () => {
    expect(toEpoch('2026-01-02T03:04:05Z')).toBe(Date.parse('2026-01-02T03:04:05Z'));
  });

  it('parses the server space-separated format identically to ISO', () => {
    expect(toEpoch('2026-01-02 03:04:05')).toBe(toEpoch('2026-01-02T03:04:05'));
  });

  it('returns 0 for null / undefined', () => {
    expect(toEpoch(null)).toBe(0);
    expect(toEpoch(undefined)).toBe(0);
  });

  it('returns 0 for an unparseable string', () => {
    expect(toEpoch('not a date')).toBe(0);
  });
});
