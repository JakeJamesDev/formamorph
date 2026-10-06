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
 * Resolve when `transaction` commits; reject with its error when it fails or aborts.
 *
 * A write is done only at commit: a full disk aborts the transaction after every request in it succeeded.
 */
export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    // A failed request's error reaches the transaction before the abort sets `transaction.error`.
    const fail = (event: Event) => reject(
      (event.target as IDBRequest | IDBTransaction | null)?.error ?? transaction.error ?? new Error('The write was aborted'),
    );
    transaction.onerror = fail;
    transaction.onabort = fail;
  });
}

/**
 * Read with `read`, then write from its result in the same transaction; resolve when that commits.
 *
 * Settles on every path: a write that throws aborts the transaction and rejects with what it threw, and a
 * write that writes nothing resolves when the transaction completes.
 *
 * @param transaction - The read-write transaction `read` runs in
 * @param read - The request whose result the write needs
 * @param write - Queues the writes; may throw to refuse
 */
export function writeAfterRead<T>(
  transaction: IDBTransaction, read: IDBRequest<T>, write: (result: T) => void,
): Promise<void> {
  const done = transactionDone(transaction);
  let thrown: { error: unknown } | null = null;
  read.onsuccess = () => {
    try {
      write(read.result);
    } catch (error) {
      thrown = { error };
      transaction.abort();
    }
  };
  return done.catch((error: unknown) => { throw thrown ? thrown.error : error; });
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
