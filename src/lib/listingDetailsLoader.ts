/**
 * One listing's details, from disk at once and from the server when it answers.
 *
 * The fresh read always runs and keeps the disk current: an answer replaces the entry, a listing this
 * reader may not see drops it, and no answer leaves it. The cached read gives way to a fresh answer, so
 * details from disk never land after it and a slow disk never holds it back.
 */
import WorldStorageService, { type ListingDetails, type ListingDetailsRead } from '@/services/WorldStorageService';
import { dropCachedDetails, getCachedDetails, putCachedDetails } from '@/lib/listingDetailsCache';
import { currentReader } from '@/lib/currentReader';

export interface ListingDetailsLoad {
  /** This reader's last known details, or null when none are held or the fresh answer came first. */
  cached: Promise<ListingDetails | null>;
  fresh: Promise<ListingDetailsRead>;
}

const readFresh = async (listingId: string): Promise<ListingDetailsRead> => {
  let reader: string;
  let read: ListingDetailsRead;
  try {
    reader = currentReader();
    read = await WorldStorageService.readListingDetails(listingId);
    // An answer read for somebody who has since signed in or out is theirs, not the new reader's.
    if (currentReader() !== reader) return read;
  } catch {
    return { status: 'unreachable' };
  }
  const write = read.status === 'ok' ? putCachedDetails(listingId, read.details)
    : read.status === 'gone' ? dropCachedDetails(listingId)
      : null;
  write?.catch((error: unknown) => console.error('Failed to update the listing details cache:', error));
  return read;
};

/** Start reading a listing's details. */
export function loadListingDetails(listingId: string): ListingDetailsLoad {
  const fresh = readFresh(listingId);
  // Only a real answer supersedes the disk; after a failed request the cached details are all there is.
  const answered = fresh.then((read) => (read.status === 'unreachable' ? new Promise<null>(() => {}) : null));
  const cached = Promise.race([getCachedDetails(listingId).catch(() => null), answered]);
  return { cached, fresh };
}
