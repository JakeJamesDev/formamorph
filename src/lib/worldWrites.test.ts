import { describe, expect, it } from 'vitest';
import { advancedClock, mergeWorldWrites } from './worldWrites';

describe('advancedClock', () => {
  it('reads turn start plus every advance the turn made so far', () => {
    const before = { minutes: 60 };
    const onCall = { minutes: 480 };
    expect(advancedClock(10, before)).toBe(11);
    expect(advancedClock(10, mergeWorldWrites(before, onCall))).toBe(19);
  });

  it('reads nothing when the turn has not advanced the clock', () => {
    expect(advancedClock(10, undefined)).toBeUndefined();
    expect(advancedClock(10, { location: 'gate' })).toBeUndefined();
  });

  it('reads an advance of zero minutes as the turn start', () => {
    expect(advancedClock(10, { minutes: 0 })).toBe(10);
  });
});
