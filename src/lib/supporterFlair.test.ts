import { describe, expect, it } from 'vitest';
import { flairTier, supporterTenure } from './supporterFlair';

const NOW = new Date(2026, 9, 15, 12);
const monthsAgo = (months: number) => new Date(2026, 9 - months, 10).toISOString();

describe('supporter tenure wording', () => {
  it('counts a pledge under a month as 0 months', () => {
    expect(supporterTenure(monthsAgo(0), NOW)).toBe('0 months');
  });

  it('says whole months under a year', () => {
    expect(supporterTenure(monthsAgo(11), NOW)).toBe('11 months');
    expect(supporterTenure(monthsAgo(1), NOW)).toBe('1 month');
  });

  it('says years and months from a year on', () => {
    expect(supporterTenure(monthsAgo(14), NOW)).toBe('1 year, 2 months');
    expect(supporterTenure(monthsAgo(24), NOW)).toBe('2 years');
  });

  it('holds a month back until its day has passed', () => {
    expect(supporterTenure(new Date(2026, 8, 20).toISOString(), NOW)).toBe('0 months');
  });

  it('states nothing for a null or unreadable start', () => {
    expect(supporterTenure(null, NOW)).toBeNull();
    expect(supporterTenure('not a date', NOW)).toBeNull();
  });
});

describe('the tier to draw', () => {
  it('reads a missing field, a null, and an unknown tier as no flair', () => {
    expect(flairTier(undefined)).toBeNull();
    expect(flairTier(null)).toBeNull();
    expect(flairTier({ tier: 'platinum' })).toBeNull();
    expect(flairTier({ tier: 'supporter_plus' })).toBe('supporter_plus');
  });
});
