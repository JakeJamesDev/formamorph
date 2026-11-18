import { describe, it, expect } from 'vitest';
import { parseSupporterDays, supporterEndLabel, supporterUntilOf } from './supporterEndDate';

const NOW = Date.parse('2026-11-14T12:00:00.000Z');
const FUTURE = '2026-12-01T00:00:00.000Z';

describe('supporterUntilOf', () => {
  it('reads the end date of a Supporter-only listing', () => {
    expect(supporterUntilOf({ supporter_only: true, supporter_until: FUTURE }, NOW)?.toISOString()).toBe(FUTURE);
  });

  it.each([
    ['no end date', { supporter_only: true }],
    ['no flag', { supporter_until: FUTURE }],
    ['an end date in the past', { supporter_only: true, supporter_until: '2026-11-01T00:00:00.000Z' }],
    ['an unreadable date', { supporter_only: true, supporter_until: 'soon' }],
  ])('is null for %s', (_name, listing) => {
    expect(supporterUntilOf(listing, NOW)).toBeNull();
  });
});

describe('supporterEndLabel', () => {
  it('names the date for a timed listing and nothing for an untimed one', () => {
    expect(supporterEndLabel({ supporter_only: true, supporter_until: FUTURE }, NOW)).toMatch(/^Supporter-only until .*2026/);
    expect(supporterEndLabel({ supporter_only: true }, NOW)).toBeNull();
  });
});

describe('parseSupporterDays', () => {
  it.each([['7', 7], [' 30 ', 30], ['3650', 3650]])('reads %s', (text, days) => {
    expect(parseSupporterDays(text)).toBe(days);
  });

  it.each(['', '0', '-3', '1.5', '3651', 'abc'])('refuses "%s"', (text) => {
    expect(parseSupporterDays(text)).toBeNull();
  });
});
