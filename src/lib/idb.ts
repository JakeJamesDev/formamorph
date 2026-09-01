/**
 * Tiny shared helpers over the callback-based IndexedDB API: open a database (creating any missing
 * object stores) and promisify a single request. Each consumer keeps its own connection caching and
 * transaction logic — this just removes the repeated open/promise boilerplate.
 */

export interface StoreSpec {
  name: string;
  keyPath: string;
}

/**
 * Open `name` (at `version`, or versionless when `version` is undefined — used by the legacy save
 * DB), creating any missing stores in `onupgradeneeded`. Rejects with the open request's error.
 */
export function openDatabase(
  name: string,
  version: number | undefined,
  stores: StoreSpec[],
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of stores) {
        if (!db.objectStoreNames.contains(store.name)) {
          db.createObjectStore(store.name, { keyPath: store.keyPath });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Resolve with a request's `result` on success; reject with its `error` on failure. */
export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Empty one object store.
 *
 * A transaction rather than a database delete: a delete is blocked by any connection still open, and
 * anything holding one — a card mid-render, another tab — would leave the caller's purge silently undone.
 */
export async function clearStore(db: IDBDatabase, store: string): Promise<void> {
  await promisifyRequest(db.transaction([store], 'readwrite').objectStore(store).clear());
}
