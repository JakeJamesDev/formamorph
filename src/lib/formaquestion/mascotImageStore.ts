/**
 * The player's Mascot images, as blobs by id in their own IndexedDB database. Not a cache: nothing drops an
 * image but a delete or a clear. The rig in the help settings holds the ids; bundled images never enter it.
 */
import { clearStore, openDatabase, promisifyRequest } from '@/lib/idb';
import { randomUUID } from '@/lib/uuid';

const DB_NAME = 'FORMAMORPH_MASCOT_DB';
const STORE_NAME = 'images';
const DB_VERSION = 1;

interface MascotImageRecord {
  id: string;
  blob: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;
const openDB = (): Promise<IDBDatabase> => {
  dbPromise ??= openDatabase(DB_NAME, DB_VERSION, [{ name: STORE_NAME, keyPath: 'id' }]).catch((error: unknown) => {
    dbPromise = null; // a later call retries the open
    throw error;
  });
  return dbPromise;
};

const objectStore = async (mode: IDBTransactionMode): Promise<IDBObjectStore> =>
  (await openDB()).transaction([STORE_NAME], mode).objectStore(STORE_NAME);

/** Stores one image and returns its new id. */
export async function addMascotImage(blob: Blob): Promise<string> {
  const record: MascotImageRecord = { id: randomUUID(), blob };
  await promisifyRequest((await objectStore('readwrite')).put(record));
  return record.id;
}

/** One image's blob, or null when the store has no image with that id. */
export async function getMascotImage(id: string): Promise<Blob | null> {
  const record = await promisifyRequest<MascotImageRecord | undefined>((await objectStore('readonly')).get(id));
  return record?.blob ?? null;
}

/** Removes one image. A missing id is not an error. */
export async function deleteMascotImage(id: string): Promise<void> {
  await promisifyRequest((await objectStore('readwrite')).delete(id));
}

/** Removes every image. */
export async function clearMascotImages(): Promise<void> {
  await clearStore(await openDB(), STORE_NAME);
}
