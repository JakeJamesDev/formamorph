/**
 * Persistent, version-gated cache of world preview thumbnails (the heaviest, most-repeated
 * asset in the world browser), stored as Blobs in their own IndexedDB database. Keyed by the
 * server's `thumbnail_file` (a per-upload UUID); the world's `updated_at` is recorded so a
 * same-filename re-upload still invalidates. Complements (and outlives) the browser's 24h
 * HTTP cache on these images.
 */
import { clearStore, openDatabase, promisifyRequest } from './idb';

const DB_NAME = 'FORMAMORPH_THUMBS_DB';
const STORE_NAME = 'thumbnails';
const DB_VERSION = 1;
const MAX_ENTRIES = 800;
/** How many resolved object URLs the session keeps. Several grid pages' worth, so paging through the
 *  whole catalog once and coming back costs no second read. */
export const MAX_SESSION_ENTRIES = 240;

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

/** Read many records in one transaction. Files with nothing stored are simply absent from the answer. */
export const getThumbs = async (files: string[]): Promise<ThumbRecord[]> => {
  if (!files.length) return [];
  const db = await openDB();
  const store = db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME);
  const records = await Promise.all(files.map((f) => promisifyRequest<ThumbRecord>(store.get(f))));
  return records.filter((r): r is ThumbRecord => Boolean(r));
};

/* ── The session store ──────────────────────────────────────────────────────────────────────────
   Resolved object URLs, held for as long as the tab lives. A card that has shown a thumbnail once
   paints it on its first frame from here, with no database open, no read, and no effect. The map
   owns every URL it holds and revokes only what it replaces or evicts. */

interface SessionEntry {
  url: string;
  updatedAt: number;
}

// Insertion order is recency order: a hit re-inserts, so the first key is always the coldest.
const session = new Map<string, SessionEntry>();

/** The remembered URL for `file`, or null when nothing at least as new as `wantEpoch` is held. */
export const peekThumb = (file: string, wantEpoch: number): string | null => {
  const entry = session.get(file);
  if (!entry || entry.updatedAt < wantEpoch) return null;
  return entry.url;
};

/** Mark a remembered entry most recently used, so eviction reaches the ones nobody is looking at. */
export const touchThumb = (file: string): void => {
  const entry = session.get(file);
  if (!entry) return;
  session.delete(file);
  session.set(file, entry);
};

/** Resolve a blob to an object URL and remember it for the session. Answers the URL. */
export const rememberThumb = (file: string, blob: Blob, updatedAt: number): string => {
  const previous = session.get(file);
  if (previous) {
    URL.revokeObjectURL(previous.url); // a newer upload replaces the picture the old URL pointed at
    session.delete(file);
  }
  const url = URL.createObjectURL(blob);
  session.set(file, { url, updatedAt });
  while (session.size > MAX_SESSION_ENTRIES) {
    const coldest = session.keys().next();
    if (coldest.done) break;
    const evicted = session.get(coldest.value);
    if (evicted) URL.revokeObjectURL(evicted.url);
    session.delete(coldest.value);
  }
  return url;
};

// Files a batch read is currently covering. A card that mounts while one is in flight waits on that
// single transaction instead of opening a read of its own.
const pending = new Map<string, Promise<void>>();

/** The batch read covering `file`, when one is in flight. */
export const pendingThumb = (file: string): Promise<void> | undefined => pending.get(file);

/**
 * Read a page's stored thumbnails in one transaction and remember every current one. Files already
 * remembered are skipped, so paging back over seen cards reads nothing at all.
 */
export const preloadThumbs = async (items: { file: string; updatedAt: number }[]): Promise<void> => {
  const wanted = items.filter((i) => i.file && !peekThumb(i.file, i.updatedAt) && !pending.has(i.file));
  if (!wanted.length) return;

  const read = (async () => {
    try {
      const records = await getThumbs(wanted.map((i) => i.file));
      const byFile = new Map(records.map((r) => [r.file, r]));
      for (const { file, updatedAt } of wanted) {
        const record = byFile.get(file);
        if (record && record.updatedAt >= updatedAt) rememberThumb(file, record.blob, record.updatedAt);
      }
    } catch {
      // A failed batch is not an error the reader sees; each card falls back to its own read.
    } finally {
      wanted.forEach(({ file }) => pending.delete(file));
    }
  })();

  wanted.forEach(({ file }) => pending.set(file, read));
  return read;
};

/** Forget every remembered URL, revoking each. */
export const clearSessionThumbs = (): void => {
  session.forEach((entry) => URL.revokeObjectURL(entry.url));
  session.clear();
};

/** Empty the thumbnail cache, on disk and in memory. */
export const clearThumbs = async (): Promise<void> => {
  clearSessionThumbs();
  return clearStore(await openDB(), STORE_NAME);
};
