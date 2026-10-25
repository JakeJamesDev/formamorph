import { describe, it, expect } from 'vitest';
import { clockReading, daypartAt, formatClock } from './gameClock';

describe('clockReading', () => {
  it('rounds 21:59.7 up to 22:00', () => {
    // Start 8:00, so 13.995h elapsed is 21:59.7.
    expect(clockReading(13.995)).toEqual({ day: 1, hour: 22, minute: 0, daypart: 'night' });
  });

  it('rolls the day instead of reading minute 60 or hour 24', () => {
    // 15.995h after 8:00 is 23:59.7.
    expect(clockReading(15.995)).toMatchObject({ day: 2, hour: 0, minute: 0 });
  });

  it('agrees with the stamp the panel prints', () => {
    for (const elapsed of [0, 0.25, 13.995, 15.995, 40.5]) {
      const { day, hour, minute } = clockReading(elapsed);
      const hh = String(hour).padStart(2, '0');
      const mm = String(minute).padStart(2, '0');
      expect(formatClock(elapsed)).toBe(`Day ${day}, ${hh}:${mm}`);
    }
  });

  it('gives the panel the daypart of the rounded minute', () => {
    // 05:59.7 on day 2 shows as 06:00, which is dawn.
    expect(formatClock(21.995)).toBe('Day 2, 06:00');
    expect(daypartAt(21.995)).toBe('dawn');
  });

  it('uses the calendar hours per day', () => {
    expect(clockReading(5, { startHour: 0, hoursPerDay: 10 })).toMatchObject({ day: 1, hour: 5, minute: 0 });
    expect(clockReading(10, { startHour: 0, hoursPerDay: 10 })).toMatchObject({ day: 2, hour: 0 });
  });

  it('reads the default start hour at zero elapsed', () => {
    expect(clockReading(0)).toMatchObject({ day: 1, hour: 8, minute: 0 });
  });
});
