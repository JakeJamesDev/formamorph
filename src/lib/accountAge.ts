/** The steps the phrase steps through, largest first. Each is how many seconds one of that unit is. */
const UNITS: readonly (readonly [seconds: number, name: string])[] = [
  [365 * 86_400, 'year'],
  [30 * 86_400, 'month'],
  [86_400, 'day'],
  [3_600, 'hour'],
  [60, 'minute'],
  [1, 'second'],
];

/** An age at or under this reads as fresh enough to mark — an account made the same day it liked. */
export const FRESH_ACCOUNT_SECONDS = 86_400;

/**
 * How old an account was at a moment, in the words a person would use.
 *
 * Coarse on purpose: staff are looking for a cluster of accounts made minutes before they liked, and a
 * count of days does that job while an exact duration only asks to be read twice. Months are counted at
 * thirty days and years at three hundred and sixty five, which is close enough for a judgment nobody
 * makes on the boundary.
 *
 * @param seconds - The gap between the signup and the like, as the server counted it
 * @returns A phrase like `4 minutes`, or `same second` when there is no gap to name
 */
export function describeAccountAge(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return 'same second';

  for (const [size, name] of UNITS) {
    const count = Math.floor(seconds / size);
    if (count >= 1) return `${count} ${name}${count === 1 ? '' : 's'}`;
  }

  return 'same second';
}

/** Whether an account was young enough at like time to be worth a second look. */
export const isFreshAccount = (seconds: number | null | undefined): boolean =>
  typeof seconds === 'number' && Number.isFinite(seconds) && seconds < FRESH_ACCOUNT_SECONDS;
