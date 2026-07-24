/**
 * Persistent cache of digest embedding vectors for semantic memory, in its own IndexedDB database
 * (never a new store on an existing DB). Keyed by model id + content hash of the digest text
 * (lib/memoryRelevance.vectorKey), so an edited or regenerated digest is a cache miss that simply
 * re-embeds, and a model swap invalidates everything without a migration. Vectors are derived data —
 * losing this DB costs a re-embed, never a memory.
 */
import { openDatabase, promisifyRequest } from './idb';

const DB_NAME = 'FORMAMORPH_EMBEDDINGS_DB';
const STORE_NAME = 'vectors';
const DB_VERSION = 1;
const MAX_ENTRIES = 5000;

interface VectorRecord {
  key: string;
  vector: ArrayBuffer;
  dims: number;
  cachedAt: number; // epoch ms, used for LRU pruning
}

// One shared connection; a failed open resets so a later call can retry (thumbnailCache pattern).
let dbPromise: Promise<IDBDatabase> | null = null;
const openDB = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = openDatabase(DB_NAME, DB_VERSION, [{ name: STORE_NAME, keyPath: 'key' }]).catch(
      (err) => { dbPromise = null; throw err; },
    );
  }
  return dbPromise;
};

/** Batch read: the found vectors by key; missing keys are simply absent from the map. */
export const getVectors = async (keys: string[]): Promise<Map<string, Float32Array>> => {
  const found = new Map<string, Float32Array>();
  if (keys.length === 0) return found;
  const db = await openDB();
  const store = db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME);
  const records = await Promise.all(keys.map((k) => promisifyRequest<VectorRecord | undefined>(store.get(k))));
  records.forEach((r) => { if (r) found.set(r.key, new Float32Array(r.vector)); });
  return found;
};

export const putVector = async (key: string, vector: Float32Array): Promise<void> => {
  const db = await openDB();
  const record: VectorRecord = {
    key,
    // slice() of a copied Float32Array is always a plain ArrayBuffer; the cast drops the
    // SharedArrayBuffer arm TS keeps from the generic .buffer type.
    vector: vector.slice().buffer as ArrayBuffer,
    dims: vector.length,
    cachedAt: Date.now(),
  };
  await promisifyRequest(db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).put(record));
  pruneVectors().catch(() => {});
};

// LRU prune, count-gated so the common under-cap case stays cheap.
export const pruneVectors = async (maxEntries = MAX_ENTRIES): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME);
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result <= maxEntries) { resolve(); return; }
      const getAll = store.getAll();
      getAll.onsuccess = () => {
        (getAll.result as VectorRecord[])
          .sort((a, b) => b.cachedAt - a.cachedAt)
          .slice(maxEntries)
          .forEach((r) => store.delete(r.key));
        resolve();
      };
      getAll.onerror = () => reject(getAll.error);
    };
    countReq.onerror = () => reject(countReq.error);
  });
};
