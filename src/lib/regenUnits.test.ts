import { describe, it, expect } from 'vitest';
import { REGEN_UNITS, regenPer, regenPerHour, regenUnitOf } from './regenUnits';
import type { RegenUnit } from '@/types';

describe('regen units', () => {
  it('reads an absent or unknown unit as hours', () => {
    expect(regenUnitOf({})).toBe('hours');
    expect(regenUnitOf({ regenUnit: 'fortnights' as RegenUnit })).toBe('hours');
    expect(regenUnitOf({ regenUnit: 'days' })).toBe('days');
  });

  it('stores per hour and reads back the amount typed, in every unit', () => {
    expect(regenPerHour(1, 'days')).toBeCloseTo(1 / 24, 12);
    expect(regenPerHour(3, 'minutes')).toBe(180);
    for (const unit of REGEN_UNITS) {
      for (const amount of [1, 1.5, -2, 0.1, 7]) expect(regenPer(regenPerHour(amount, unit), unit)).toBe(amount);
    }
  });

  it('shows a per-hour regen in a larger unit as the sum over that span', () => {
    expect(regenPer(2, 'days')).toBe(48);
    expect(regenPer(2, 'weeks')).toBe(336);
  });
});
