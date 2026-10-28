import { toEpoch } from '@/lib/thumbnailCache';

/** A catalog listing as the browser holds it. `pinned_at` is set while staff keep it at the top. */
export interface PinnableListing {
  pinned_at?: unknown;
}

/** When staff pinned a listing, as an epoch, or 0 when it is not pinned. */
const pinEpoch = (listing: PinnableListing): number =>
  typeof listing.pinned_at === 'string' || typeof listing.pinned_at === 'number' ? toEpoch(listing.pinned_at) : 0;

/** Whether staff have pinned a listing. */
export const isPinned = (listing: PinnableListing): boolean => pinEpoch(listing) > 0;

/** Sort comparator that puts pinned listings first, newest pin first, and leaves the rest tied. */
export function comparePinned(a: PinnableListing, b: PinnableListing): number {
  return pinEpoch(b) - pinEpoch(a);
}
