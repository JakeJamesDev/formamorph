import { KIND_LABELS, kindOf, type CatalogKind } from '@/lib/catalogKinds';
import { parseServerDate } from '@/lib/serverDate';

/** What the length dropdown offers. Seven is the default, and where the copy's promises are written. */
export const QUARANTINE_DAY_OPTIONS = [3, 7, 14, 30] as const;
export const DEFAULT_QUARANTINE_DAYS = 7;

/** A catalog listing as the browser holds it — every field optional, since the server shapes vary. */
interface ListingLike {
  kind?: string;
  name?: unknown;
  quarantined_at?: unknown;
  quarantine_expires_at?: unknown;
  author?: { id?: unknown; username?: unknown } | null;
}

/** Whether a listing is currently in quarantine. */
export const isQuarantined = (listing: ListingLike): boolean => Boolean(listing.quarantined_at);

/**
 * When a quarantined listing will be deleted, as a readable local date, or null when there is no
 * deadline to show.
 *
 * A date rather than a date and time: the deadline is days away, and a minute-precise timestamp reads as
 * more precision than the decision behind it had.
 *
 * @param listing - The listing
 * @returns The deletion date, or null
 */
export function quarantineDeadline(listing: ListingLike): string | null {
  if (typeof listing.quarantine_expires_at !== 'string') return null;

  return parseServerDate(listing.quarantine_expires_at)?.toLocaleDateString() ?? null;
}

/**
 * How many whole days are left, floored at zero.
 *
 * Floored because a listing past its deadline has not been swept yet rather than owing negative time —
 * "0 days left" is the honest reading of a deletion that is already due.
 *
 * @param listing - The listing
 * @param now - The instant to count from; passed in so this stays testable
 * @returns Days remaining, or null when there is no deadline
 */
export function quarantineDaysLeft(listing: ListingLike, now: Date = new Date()): number | null {
  if (typeof listing.quarantine_expires_at !== 'string') return null;

  const expires = parseServerDate(listing.quarantine_expires_at);
  if (!expires) return null;

  return Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / 86400000));
}

/** Who a quarantine notice would go to, and what it is about. */
export interface QuarantineTarget {
  author: { id: string; username: string };
  kind: CatalogKind;
  name: string;
  /** The deletion date as the author will read it. */
  deadline: string | null;
}

/**
 * Who to write to about a listing just quarantined, or null when nobody.
 *
 * Only somebody else's work qualifies: an admin quarantining their own has nobody to explain it to, and
 * an item with no author on the record has no one to address.
 *
 * @param listing - The quarantined listing, after the server's answer has been folded in
 * @param currentUserId - The signed-in admin's ID
 * @returns The notice target, or null when the quarantine should pass silently
 */
export function quarantineTargetFor(
  listing: ListingLike,
  currentUserId: string | null | undefined
): QuarantineTarget | null {
  const id = listing.author?.id;
  const username = listing.author?.username;
  if (typeof id !== 'string' || !id || typeof username !== 'string' || !username) return null;
  if (id === currentUserId) return null;

  const kind = kindOf(listing);

  return {
    author: { id, username },
    kind,
    // A listing with no name still has to read as something in the notice.
    name: typeof listing.name === 'string' && listing.name ? listing.name : KIND_LABELS[kind].one,
    deadline: quarantineDeadline(listing),
  };
}

/**
 * Prefill for a quarantine notice.
 *
 * Unlike a takedown, the thing still exists and there is something the author can do about it — so the
 * message leads with the deadline and leaves the reasons for the admin to write, since only they know
 * what needs fixing.
 *
 * @param target - The quarantined item and its author
 * @returns `{ subject, body }` for the message composer
 */
export function quarantineTemplate(target: QuarantineTarget): { subject: string; body: string } {
  const noun = KIND_LABELS[target.kind].one.toLowerCase();
  const when = target.deadline ? ` It will be deleted on **${target.deadline}** unless it is fixed before then.` : '';

  return {
    subject: `Your ${noun} "${target.name}" needs changes`,
    body: `Your ${noun} **"${target.name}"** has been hidden from Community Creations while you fix it.${when} `
      + `Updating it buys you another week.\n\n**What needs to change:** `,
  };
}
