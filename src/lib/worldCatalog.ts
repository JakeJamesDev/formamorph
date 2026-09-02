/**
 * Local cache of the full workshop world catalog (light metadata only — no content, no base64
 * images), in its own IndexedDB database. Lets the community browser render, search, sort, and
 * paginate entirely client-side instead of a server round-trip per page. The catalog is small
 * (~600 records × ~700 B) and the server returns all of it in one `?limit=1000` request, so we
 * refresh by replacing the whole set (which also reconciles new/updated/removed worlds + counts).
 */
import { clearStore, openDatabase, promisifyRequest } from './idb';

const DB_NAME = 'FORMAMORPH_CATALOG_DB';
const STORE_NAME = 'worlds';
const META_STORE = 'meta';
const TAG_KEY = 'etag';
const DB_VERSION = 2;

// A catalog record is exactly a server list entry; kept loose since fields come straight from the API.
export type CatalogWorld = Record<string, unknown> & { id: string };

/**
 * The freshness tag the server answered the stored catalog with, and who it was fetched for. The
 * server's tag varies by reader — liked marks and quarantined listings are the reader's own — so a
 * tag is only worth sending back while the same reader is asking.
 */
export interface CatalogTag {
  tag: string;
  reader: string;
}

interface TagRecord extends CatalogTag {
  key: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;
const openDB = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = openDatabase(DB_NAME, DB_VERSION, [
      { name: STORE_NAME, keyPath: 'id' },
      { name: META_STORE, keyPath: 'key' },
    ]).catch(
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

/** The tag the stored catalog was fetched with, or null when there is none to send back. */
export const getCatalogTag = async (): Promise<CatalogTag | null> => {
  const db = await openDB();
  const record = await promisifyRequest<TagRecord>(
    db.transaction([META_STORE], 'readonly').objectStore(META_STORE).get(TAG_KEY),
  );
  return record ? { tag: record.tag, reader: record.reader } : null;
};

/**
 * Replace the entire cached catalog with a fresh server snapshot, and its tag with `tag`. Rows and
 * tag move together in one transaction, so a stored tag never describes a snapshot that is not there.
 * Replacing without a tag drops the old one: rows the server did not answer with have no freshness
 * to claim.
 */
export const replaceCatalog = async (worlds: CatalogWorld[], tag?: CatalogTag | null): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    worlds.forEach((w) => { if (w && w.id) store.put(w); });
    const meta = tx.objectStore(META_STORE);
    if (tag) meta.put({ key: TAG_KEY, tag: tag.tag, reader: tag.reader } satisfies TagRecord);
    else meta.delete(TAG_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

/** Empty the cached catalog and forget its tag. */
export const clearCatalog = async (): Promise<void> => {
  const db = await openDB();
  await Promise.all([clearStore(db, STORE_NAME), clearStore(db, META_STORE)]);
};
