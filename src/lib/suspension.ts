import { formatServerDate } from '@/lib/serverDate';

/** The suspension notice prefill when the account has no end. */
const OPEN_ENDED_BODY = 'Your account has been suspended.\n\n**Reason:** ';

/**
 * A suspension's end as a readable local date, or null when there is no end to show.
 *
 * @param until - The row's `suspendedUntil`, which is null for a suspension with no end
 * @returns The date in the viewer's locale, or null
 */
export function suspensionEndLabel(until: unknown): string | null {
  if (typeof until !== 'string' || !until) return null;

  return formatServerDate(until) || null;
}

/**
 * Prefill for the notice offered after a suspension. The end date appears only when there is one.
 *
 * @param until - The stored `suspendedUntil` from the server's answer
 * @returns `{ subject, body }` for the message composer
 */
export function suspensionTemplate(until: unknown): { subject: string; body: string } {
  const end = suspensionEndLabel(until);

  return {
    subject: 'Your account has been suspended',
    body: end ? `Your account has been suspended until **${end}**.\n\n**Reason:** ` : OPEN_ENDED_BODY,
  };
}
