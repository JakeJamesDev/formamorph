import { describe, it, expect } from 'vitest';
import { describeAccountAge, isFreshAccount } from './accountAge';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

describe('how old an account was when it liked', () => {
  it('reads "same second" at zero, and for a clock that ran backwards', () => {
    // Two server timestamps a hair apart in the wrong order is a clock artifact, not a negative age.
    expect(describeAccountAge(0)).toBe('same second');
    expect(describeAccountAge(-30)).toBe('same second');
  });

  it('counts seconds under a minute', () => {
    expect(describeAccountAge(1)).toBe('1 second');
    expect(describeAccountAge(45)).toBe('45 seconds');
  });

  it('counts minutes under an hour, and turns over on the hour', () => {
    expect(describeAccountAge(MINUTE)).toBe('1 minute');
    expect(describeAccountAge(4 * MINUTE)).toBe('4 minutes');
    expect(describeAccountAge(HOUR - 1)).toBe('59 minutes');
    expect(describeAccountAge(HOUR)).toBe('1 hour');
  });

  it('counts hours under a day, and turns over on the day', () => {
    expect(describeAccountAge(5 * HOUR)).toBe('5 hours');
    expect(describeAccountAge(DAY - 1)).toBe('23 hours');
    expect(describeAccountAge(DAY)).toBe('1 day');
  });

  it('counts days under a month, and turns over on the month', () => {
    expect(describeAccountAge(9 * DAY)).toBe('9 days');
    expect(describeAccountAge(MONTH - 1)).toBe('29 days');
    expect(describeAccountAge(MONTH)).toBe('1 month');
  });

  it('counts months under a year, and turns over on the year', () => {
    expect(describeAccountAge(6 * MONTH)).toBe('6 months');
    expect(describeAccountAge(YEAR - 1)).toBe('12 months');
    expect(describeAccountAge(YEAR)).toBe('1 year');
  });

  it('counts years above that', () => {
    expect(describeAccountAge(3 * YEAR)).toBe('3 years');
  });

  it('reads "same second" for a gap too small to name', () => {
    // Two timestamps inside the same second come back as a fraction, which no unit can count.
    expect(describeAccountAge(0.4)).toBe('same second');
  });

  it('reads "same second" for a missing or unusable number', () => {
    // A server that predates the field sends nothing; the row still has to render.
    expect(describeAccountAge(undefined)).toBe('same second');
    expect(describeAccountAge(Number.NaN)).toBe('same second');
  });
});

describe('spotting an account made for the like', () => {
  it('calls anything under a day fresh, and a day old not', () => {
    expect(isFreshAccount(0)).toBe(true);
    expect(isFreshAccount(DAY - 1)).toBe(true);
    expect(isFreshAccount(DAY)).toBe(false);
    expect(isFreshAccount(3 * DAY)).toBe(false);
  });

  it('marks nothing when the server sent no age', () => {
    // An unmarked row is the safe default: a tint nobody can explain is worse than no tint.
    expect(isFreshAccount(undefined)).toBe(false);
    expect(isFreshAccount(Number.NaN)).toBe(false);
  });
});
