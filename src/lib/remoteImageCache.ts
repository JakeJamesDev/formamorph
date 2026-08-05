/**
 * Client-side blob cache for author-supplied remote images, so a world stays playable offline after one
 * online visit. Keyed by the image's own URL, in its own IndexedDB database.
 *
 * Nothing here ever reaches a world record, an export, or a publish payload — a cached blob is resolved at
 * render time and discarded. Writing one back into an authored field would re-embed exactly the bytes that
 * pasting a URL exists to avoid.
 *
 * Bounded by total bytes rather than entry count (the thumbnail cache's rule), because these are
 * author-sized pictures rather than uniform 192px thumbnails and one world could otherwise fill the origin's
 * quota — taking saves and worlds with it when the browser evicts under pressure.
 */
import { openDatabase, promisifyRequest } from './idb';

const DB_NAME = 'FORMAMORPH_REMOTE_IMAGES_DB';
const STORE_NAME = 'images';
const DB_VERSION = 1;
const MAX_BYTES = 100_000_000;

export interface RemoteImageRecord {
  url: string;
  blob: Blob;
  bytes: number;
  cachedAt: number; // epoch ms, used for LRU pruning
}

// One shared connection: a world's gallery resolves many images at once.
let dbPromise: Promise<IDBDatabase> | null = null;
const openDB = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = openDatabase(DB_NAME, DB_VERSION, [{ name: STORE_NAME, keyPath: 'url' }]).catch(
      (err) => { dbPromise = null; throw err; }, // let a later call retry the open
    );
  }
  return dbPromise;
};

export const getCachedImage = async (url: string): Promise<RemoteImageRecord | null> => {
  const db = await openDB();
  const record = await promisifyRequest<RemoteImageRecord>(
    db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).get(url),
  );
  return record ?? null;
};

export const putCachedImage = async (url: string, blob: Blob): Promise<void> => {
  const db = await openDB();
  const record: RemoteImageRecord = { url, blob, bytes: blob.size, cachedAt: Date.now() };
  await promisifyRequest(db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).put(record));
  pruneCachedImages().catch(() => {}); // best-effort; a failed prune must not fail the render
};

/** Total bytes currently held, for the Settings readout. */
export const cachedImageBytes = async (): Promise<number> => {
  const db = await openDB();
  const all = await promisifyRequest<RemoteImageRecord[]>(
    db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll(),
  );
  return (all ?? []).reduce((sum, r) => sum + (r.bytes || 0), 0);
};

export const clearCachedImages = async (): Promise<void> => {
  const db = await openDB();
  await promisifyRequest(db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).clear());
};

/** Drop least-recently-cached entries until the store fits the byte cap. */
export const pruneCachedImages = async (maxBytes = MAX_BYTES): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME);
    const getAll = store.getAll();
    getAll.onsuccess = () => {
      const records = (getAll.result as RemoteImageRecord[]).sort((a, b) => b.cachedAt - a.cachedAt);
      let running = 0;
      for (const record of records) {
        running += record.bytes || 0;
        if (running > maxBytes) store.delete(record.url);
      }
      resolve();
    };
    getAll.onerror = () => reject(getAll.error);
  });
};
