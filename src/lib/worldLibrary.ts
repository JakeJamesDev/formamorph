/**
 * The world library's IndexedDB schema: one store of whole world records, and one of the list fields
 * derived from each. Free of the DOM, so the JSON file worker writes it during a backup restore.
 *
 * Every write goes through {@link putWorldRecord} or {@link deleteWorldRecord} inside one transaction over
 * both stores, so a list read never sees a world without its metadata, or the reverse.
 */
import type { ContentLink, WorldMetadata } from '@/types';
import { describePlaceholders } from './placeholders';
import { allPlaceholders, type PlaceholderHomesWorld } from './placeholderHomes';
import { migrateCarriedPlaceholders } from './version';
import { getAllReadable, isReadable, promisifyRequest, readOrNull, transactionDone } from './idb';
import { announceWorldSaved } from './worldChangeSignal';

export const WORLD_LIBRARY_DB = 'worldsDB';
export const WORLD_LIBRARY_VERSION = 2;
export const WORLD_STORE = 'worlds';
export const WORLD_META_STORE = 'worldMeta';

/** One library copy held inside a world, as the linked-content surfaces list it. */
export interface LinkedCopy {
  itemId: string;
  itemName: string;
  kind: 'entity' | 'dictionary';
  link: ContentLink;
}

/** The metadata store's record: the list fields, plus what launch seeding and link lookups read. */
export interface WorldMetaRecord extends WorldMetadata {
  sourceHash?: string;
  /** Every copy in the world that follows a library item. */
  linkedCopies: LinkedCopy[];
}

/** The loose stored-record shape this module reads; inner world content stays untyped. */
interface StoredWorldShape {
  id: string;
  name?: string;
  description?: string;
  author?: string;
  thumbnail?: string;
  sourceId?: string;
  dirty?: boolean;
  editedAt?: string;
  downloadedAt?: string;
  sourceUpdatedAt?: string;
  sourceAuthorId?: string;
  sourceHash?: string;
  createdAt?: string;
  lastAccessed?: string;
  data?: object;
}

/** The parts of a world's content its metadata reads. */
interface ContentShape {
  worldOverview?: { thumbnail?: string | null; tags?: string[] } | null;
  placeholders?: unknown;
  entities?: unknown;
  dictionaries?: unknown;
}

const contentOf = (record: StoredWorldShape): ContentShape => (record.data ?? {}) as ContentShape;

type CopyShape = { id?: string; name?: string; link?: ContentLink };

function copiesOf(items: unknown, kind: LinkedCopy['kind']): LinkedCopy[] {
  if (!Array.isArray(items)) return [];
  return (items as CopyShape[])
    .filter((item) => item?.link?.libraryId)
    .map((item) => ({ itemId: item.id ?? '', itemName: item.name ?? '', kind, link: item.link as ContentLink }));
}

/** The blurb a library card draws: chips rendered display-only against the world's own defs. */
function describeBlurb(record: StoredWorldShape): string {
  const text = record.description ?? '';
  try {
    // Stored records never pass through `migrateWorld`, so their defs take the value-record conversion here.
    const content = (record.data ?? {}) as PlaceholderHomesWorld;
    const data = { ...content, placeholders: migrateCarriedPlaceholders(content.placeholders) };
    return describePlaceholders(text, allPlaceholders(data));
  } catch {
    // A malformed def must not abort the upgrade transaction it runs in.
    return text;
  }
}

/**
 * Derive a stored world's metadata record.
 *
 * @param record - The whole stored world record
 */
export function worldMetaOf(record: StoredWorldShape): WorldMetaRecord {
  const content = contentOf(record);
  const overview = content.worldOverview ?? undefined;
  return {
    id: record.id,
    name: record.name ?? '',
    description: describeBlurb(record),
    author: record.author || '',
    // A remote thumbnail can't render offline and is blocked cross-origin, so the embedded one wins over a URL.
    thumbnail: (record.thumbnail && !/^https?:\/\//i.test(record.thumbnail))
      ? record.thumbnail
      : (overview?.thumbnail || record.thumbnail || ''),
    tags: overview?.tags || [],
    sourceId: record.sourceId,
    dirty: record.dirty,
    editedAt: record.editedAt,
    downloadedAt: record.downloadedAt,
    sourceUpdatedAt: record.sourceUpdatedAt,
    sourceAuthorId: record.sourceAuthorId,
    sourceHash: record.sourceHash,
    createdAt: record.createdAt,
    lastAccessed: record.lastAccessed,
    linkedCopies: [
      ...copiesOf(content.entities, 'entity'),
      ...copiesOf(content.dictionaries, 'dictionary'),
    ],
  };
}

/** The list fields alone, as the menu and pickers take them. */
export function listFieldsOf(meta: WorldMetaRecord): WorldMetadata {
  const { sourceHash: _hash, linkedCopies: _copies, ...fields } = meta;
  return fields;
}

/** Fill the metadata store from the world store, one record at a time, inside the upgrade transaction. */
function fillMetadata(transaction: IDBTransaction): void {
  const meta = transaction.objectStore(WORLD_META_STORE);
  const cursor = transaction.objectStore(WORLD_STORE).openCursor();
  cursor.onsuccess = () => {
    const at = cursor.result;
    if (!at) return;
    // A value the browser can't read back comes out null; listing it would abort the upgrade.
    if (at.value && typeof at.value === 'object') meta.put(worldMetaOf(at.value as StoredWorldShape));
    at.continue();
  };
}

/**
 * Open the library at the current version, creating or upgrading its stores.
 *
 * The connection closes itself when another connection asks for a newer version, so this tab never
 * blocks that upgrade.
 *
 * @param onBlocked - Called when an open connection at an older version holds the upgrade back
 */
export function openWorldLibrary(onBlocked?: () => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WORLD_LIBRARY_DB, WORLD_LIBRARY_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORLD_STORE)) db.createObjectStore(WORLD_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(WORLD_META_STORE)) {
        db.createObjectStore(WORLD_META_STORE, { keyPath: 'id' });
        fillMetadata(request.transaction!);
      }
    };
    request.onblocked = () => onBlocked?.();
    request.onsuccess = () => {
      const db = request.result;
      db.addEventListener('versionchange', () => db.close());
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

/** A transaction over both library stores. */
export function libraryTransaction(db: IDBDatabase, mode: IDBTransactionMode): IDBTransaction {
  return db.transaction([WORLD_STORE, WORLD_META_STORE], mode);
}

/** Write a whole world record and its metadata in `transaction`. */
export function putWorldRecord(transaction: IDBTransaction, record: StoredWorldShape): IDBRequest {
  transaction.objectStore(WORLD_META_STORE).put(worldMetaOf(record));
  return transaction.objectStore(WORLD_STORE).put(record);
}

/** Delete a world record and its metadata in `transaction`. */
export function deleteWorldRecord(transaction: IDBTransaction, id: string): IDBRequest {
  transaction.objectStore(WORLD_META_STORE).delete(id);
  return transaction.objectStore(WORLD_STORE).delete(id);
}

/** Write whole world records and their metadata in one transaction. */
export async function putWorldRecords(db: IDBDatabase, records: readonly StoredWorldShape[]): Promise<void> {
  const transaction = libraryTransaction(db, 'readwrite');
  for (const record of records) putWorldRecord(transaction, record);
  await transactionDone(transaction);
  for (const record of records) announceWorldSaved(record.id);
}

/** One world's metadata record, or undefined when it is not stored or can't be read. */
export async function readWorldMeta(db: IDBDatabase, id: string): Promise<WorldMetaRecord | undefined> {
  const meta = await readOrNull<unknown>(
    db.transaction([WORLD_META_STORE], 'readonly').objectStore(WORLD_META_STORE).get(id),
  );
  return isReadable(meta) ? meta as WorldMetaRecord : undefined;
}

/** The library's metadata, and the stored worlds that have none and can't be read to derive it. */
export interface WorldMetaRead {
  meta: WorldMetaRecord[];
  unreadable: string[];
}

/** Read `ids` from the world store. A refused read aborts a read-write transaction, so reads run read-only. */
function readWorldRecords(db: IDBDatabase, ids: string[]): Promise<unknown[]> {
  const worlds = db.transaction([WORLD_STORE], 'readonly').objectStore(WORLD_STORE);
  return Promise.all(ids.map((id) => readOrNull<unknown>(worlds.get(id))));
}

/** Derive and store metadata for `ids` from their world records. */
async function rebuildWorldMeta(db: IDBDatabase, ids: string[]): Promise<WorldMetaRead> {
  const records = await readWorldRecords(db, ids);
  const readable = ids.filter((_, index) => isReadable(records[index]));
  const read: WorldMetaRead = { meta: [], unreadable: ids.filter((id) => !readable.includes(id)) };
  if (readable.length === 0) return read;

  // Read again where the write happens, so a save landing between the two passes is never overwritten.
  const transaction = libraryTransaction(db, 'readwrite');
  const worlds = transaction.objectStore(WORLD_STORE);
  for (const id of readable) {
    const request = worlds.get(id);
    request.onsuccess = () => {
      if (!isReadable(request.result)) return;
      const meta = worldMetaOf(request.result as StoredWorldShape);
      transaction.objectStore(WORLD_META_STORE).put(meta);
      read.meta.push(meta);
    };
  }
  await transactionDone(transaction);
  return read;
}

/**
 * Every metadata record in the library.
 *
 * A stored world whose metadata is missing or unreadable gets it rebuilt from its world record. One bad
 * row would otherwise hide the whole library.
 */
export async function readAllWorldMeta(db: IDBDatabase): Promise<WorldMetaRead> {
  const [meta, worldIds] = await Promise.all([
    getAllReadable<WorldMetaRecord>(db, WORLD_META_STORE),
    promisifyRequest(db.transaction([WORLD_STORE], 'readonly').objectStore(WORLD_STORE).getAllKeys()),
  ]);
  const listed = new Set(meta.map((m) => m.id));
  const missing = worldIds.map(String).filter((id) => !listed.has(id));
  if (missing.length === 0) return { meta, unreadable: [] };

  const rebuilt = await rebuildWorldMeta(db, missing);
  return {
    meta: [...meta, ...rebuilt.meta].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    unreadable: rebuilt.unreadable,
  };
}

/**
 * Delete a world's entry only while its record still can't be read.
 *
 * @returns False when the record reads again, as after a backup restore, and nothing was deleted
 */
export async function deleteUnreadableWorld(db: IDBDatabase, id: string): Promise<boolean> {
  try {
    return await deleteIfNull(db, id);
  } catch {
    // A lost file refuses the read and aborts that transaction, so the check runs read-only before the delete.
  }
  const [record] = await readWorldRecords(db, [id]);
  if (isReadable(record)) return false;
  const transaction = libraryTransaction(db, 'readwrite');
  deleteWorldRecord(transaction, id);
  await transactionDone(transaction);
  return true;
}

/** Delete the entry if its record reads back as null, with the check and the delete in one transaction. */
async function deleteIfNull(db: IDBDatabase, id: string): Promise<boolean> {
  const transaction = libraryTransaction(db, 'readwrite');
  let deleted = false;
  const read = transaction.objectStore(WORLD_STORE).get(id);
  read.onsuccess = () => {
    if (isReadable(read.result)) return;
    deleteWorldRecord(transaction, id);
    deleted = true;
  };
  await transactionDone(transaction);
  return deleted;
}
