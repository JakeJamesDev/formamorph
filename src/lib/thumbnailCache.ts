/**
 * Persistent, version-gated cache of world preview thumbnails (the heaviest, most-repeated
 * asset in the world browser), stored as Blobs in their own IndexedDB database. Keyed by the
 * server's `thumbnail_file` (a per-upload UUID); the world's `updated_at` is recorded so a
 * same-filename re-upload still invalidates. Complements (and outlives) the browser's 24h
 * HTTP cache on these images.
 */
import { openDatabase, promisifyRequest } from './idb';

const DB_NAME = 'FORMAMORPH_THUMBS_DB';
const STORE_NAME = 'thumbnails';
const DB_VERSION = 1;
const MAX_ENTRIES = 800;

export interface ThumbRecord {
  file: string;
  blob: Blob;
  updatedAt: number; // epoch ms of the world's updated_at when cached
  cachedAt: number;  // epoch ms, used for LRU pruning
}

// Normalize the server's mixed timestamp formats ("…T…Z" and "YYYY-MM-DD HH:MM:SS") to epoch ms.
// A number is already epoch ms and passes through unchanged.
export const toEpoch = (s: string | number | null | undefined): number => {
  if (s == null) return 0;
  if (typeof s === 'number') return Number.isNaN(s) ? 0 : s;
  const ms = Date.parse(s.replace(' ', 'T'));
  return Number.isNaN(ms) ? 0 : ms;
};

// One shared connection — opening a fresh DB per image (many per page) was a real cost.
let dbPromise: Promise<IDBDatabase> | null = null;
const openDB = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = openDatabase(DB_NAME, DB_VERSION, [{ name: STORE_NAME, keyPath: 'file' }]).catch(
      (err) => { dbPromise = null; throw err; }, // let a later call retry the open
    );
  }
  return dbPromise;
};

export const getThumb = async (file: string): Promise<ThumbRecord | null> => {
  const db = await openDB();
  const record = await promisifyRequest<ThumbRecord>(
    db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).get(file),
  );
  return record ?? null;
};

export const putThumb = async (file: string, blob: Blob, updatedAt: number): Promise<void> => {
  const db = await openDB();
  const record: ThumbRecord = { file, blob, updatedAt, cachedAt: Date.now() };
  await promisifyRequest(db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).put(record));
  // Bound disk use: drop the oldest entries beyond the cap (best-effort).
  pruneThumbs().catch(() => {});
};

// LRU prune: only does the heavy work when actually over the cap. A cheap count() gates it,
// so the common (under-cap) case never loads blobs into memory.
export const pruneThumbs = async (maxEntries = MAX_ENTRIES): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME);
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result <= maxEntries) { resolve(); return; }
      const getAll = store.getAll();
      getAll.onsuccess = () => {
        (getAll.result as ThumbRecord[])
          .sort((a, b) => b.cachedAt - a.cachedAt)
          .slice(maxEntries)
          .forEach((r) => store.delete(r.file));
        resolve();
      };
      getAll.onerror = () => reject(getAll.error);
    };
    countReq.onerror = () => reject(countReq.error);
  });
};
