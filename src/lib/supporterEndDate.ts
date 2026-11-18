/** The longest duration the server accepts, in days. */
export const MAX_SUPPORTER_DAYS = 3650;

/** The end date of a timed Supporter-only listing, or null when it has none or has passed. */
export function supporterUntilOf(
  listing: { supporter_only?: unknown; supporter_until?: unknown },
  now = Date.now(),
): Date | null {
  if (listing.supporter_only !== true || typeof listing.supporter_until !== 'string') return null;
  const time = Date.parse(listing.supporter_until);

  return Number.isNaN(time) || time <= now ? null : new Date(time);
}

/** A date as the reader's locale writes it. */
export const formatSupporterDate = (date: Date): string => date.toLocaleDateString(undefined, { dateStyle: 'medium' });

/** The line a card and a details window show for a timed listing; null for any other. */
export function supporterEndLabel(
  listing: { supporter_only?: unknown; supporter_until?: unknown },
  now = Date.now(),
): string | null {
  const until = supporterUntilOf(listing, now);

  return until ? `Supporter-only until ${formatSupporterDate(until)}` : null;
}

/** Read the days field: a whole number the server accepts, or null. Blank is null too. */
export function parseSupporterDays(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const days = Number(text);

  return days >= 1 && days <= MAX_SUPPORTER_DAYS ? days : null;
}

/** Whether a listing kind can carry an end date. */
export const canHaveEndDate = (kind: string): boolean => kind === 'mascot' || kind === 'world';
