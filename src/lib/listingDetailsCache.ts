/**
 * Listing details kept on disk, so a listing opened before shows its last known details at once.
 *
 * Each entry is exactly what the details read answered, keyed by listing and reader. The reader is the
 * same identity the catalog tag uses: what a listing says can differ by who asks, so one reader's entry
 * is never another's. Its own database, so a version change here never blocks the catalog's open.
 */
import { cachedConnection, clearStore, promisifyRequest, pruneLeastRecent, transactionDone } from './idb';
import { currentReader } from '@/lib/currentReader';
import type { ListingDetails } from '@/services/WorldStorageService';

const DB_NAME = 'FORMAMORPH_LISTING_DETAILS_DB';
const STORE_NAME = 'details';
const DB_VERSION = 1;

/** How many entries the store keeps before it evicts the least recently used. */
export const MAX_CACHED_DETAILS = 300;

type EntryKey = [reader: string, listingId: string];

interface DetailsRecord {
  key: EntryKey;
  details: ListingDetails;
  usedAt: number;
}

/** This reader's key for a listing. */
const entryKey = (listingId: string): EntryKey => [currentReader(), listingId];

const openDB = cachedConnection(DB_NAME, DB_VERSION, [{ name: STORE_NAME, keyPath: 'key' }]);

// Strictly increasing, so entries stored within one millisecond still have an order to evict by.
let lastStamp = 0;
const stamp = (): number => (lastStamp = Math.max(Date.now(), lastStamp + 1));

/** This reader's cached details for a listing, or null. A hit counts as a use. */
export const getCachedDetails = async (listingId: string): Promise<ListingDetails | null> => {
  const key = entryKey(listingId);
  const db = await openDB();
  const store = db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME);
  const record = await promisifyRequest<DetailsRecord | undefined>(store.get(key));
  if (!record) return null;
  store.put({ ...record, usedAt: stamp() } satisfies DetailsRecord);
  return record.details;
};

/** Store a fresh answer for this reader, evicting the least recently used entries past the cap. */
export const putCachedDetails = async (listingId: string, details: ListingDetails): Promise<void> => {
  // Keyed before the first await, so the reader is the one asking now and not whoever holds the app later.
  const key = entryKey(listingId);
  const db = await openDB();
  const tx = db.transaction([STORE_NAME], 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.put({ key, details, usedAt: stamp() } satisfies DetailsRecord);
  pruneLeastRecent<DetailsRecord>(store, MAX_CACHED_DETAILS, (r) => r.usedAt, (r) => r.key);
  await transactionDone(tx);
};

/** Forget this reader's entry for a listing they may no longer see. */
export const dropCachedDetails = async (listingId: string): Promise<void> => {
  const key = entryKey(listingId);
  const db = await openDB();
  await promisifyRequest(db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).delete(key));
};

/** Empty the store for every reader. */
export const clearListingDetails = async (): Promise<void> => {
  await clearStore(await openDB(), STORE_NAME);
};
