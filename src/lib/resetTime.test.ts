import { describe, expect, it } from 'vitest';
import { formatResetTime } from './resetTime';

const MONDAY = '2026-11-09T00:00:00.000Z';

describe('formatResetTime', () => {
  it('names the weekday and time in the viewer zone, so the Monday UTC reset reads as Sunday in the Americas', () => {
    expect(formatResetTime(MONDAY, 'America/Los_Angeles')).toBe('Sunday at 4:00 PM');
    expect(formatResetTime(MONDAY, 'UTC')).toBe('Monday at 12:00 AM');
    expect(formatResetTime(MONDAY, 'Asia/Tokyo')).toBe('Monday at 9:00 AM');
  });

  it('follows the process zone when none is given', () => {
    const before = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      expect(formatResetTime(MONDAY)).toBe('Sunday at 7:00 PM');
    } finally {
      if (before === undefined) delete process.env.TZ; else process.env.TZ = before;
    }
  });

  it('is null for a missing or unreadable instant', () => {
    expect(formatResetTime(null)).toBeNull();
    expect(formatResetTime('garbage')).toBeNull();
  });
});
