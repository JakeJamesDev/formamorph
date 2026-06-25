/**
 * Local cache of the full workshop world catalog (light metadata only — no content, no base64
 * images), in its own IndexedDB database. Lets the Discover browser render, search, sort, and
 * paginate entirely client-side instead of a server round-trip per page. The catalog is small
 * (~600 records × ~700 B) and the server returns all of it in one `?limit=1000` request, so we
 * refresh by replacing the whole set (which also reconciles new/updated/removed worlds + counts).
 */
import { openDatabase, promisifyRequest } from './idb';

const DB_NAME = 'FORMAMORPH_CATALOG_DB';
const STORE_NAME = 'worlds';
const DB_VERSION = 1;

// A catalog record is exactly a server list entry; kept loose since fields come straight from the API.
export type CatalogWorld = Record<string, unknown> & { id: string };

let dbPromise: Promise<IDBDatabase> | null = null;
const openDB = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = openDatabase(DB_NAME, DB_VERSION, [{ name: STORE_NAME, keyPath: 'id' }]).catch(
      (err) => { dbPromise = null; throw err; }, // let a later call retry the open
    );
  }
  return dbPromise;
};

/** All cached worlds (empty array if nothing cached yet). */
export const getCatalog = async (): Promise<CatalogWorld[]> => {
  const db = await openDB();
  const records = await promisifyRequest<CatalogWorld[]>(
    db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll(),
  );
  return records ?? [];
};

/** Replace the entire cached catalog with a fresh server snapshot. */
export const replaceCatalog = async (worlds: CatalogWorld[]): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    worlds.forEach((w) => { if (w && w.id) store.put(w); });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};
