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
import { promisifyRequest } from './idb';

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
    meta.put(worldMetaOf(at.value as StoredWorldShape));
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

/** Resolve when `transaction` commits; reject with its error when it fails or aborts. */
export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    const fail = () => reject(transaction.error ?? new Error('The library write was aborted'));
    transaction.onerror = fail;
    transaction.onabort = fail;
  });
}

/** Write whole world records and their metadata in one transaction. */
export async function putWorldRecords(db: IDBDatabase, records: readonly StoredWorldShape[]): Promise<void> {
  const transaction = libraryTransaction(db, 'readwrite');
  for (const record of records) putWorldRecord(transaction, record);
  await transactionDone(transaction);
}

/** One world's metadata record, or undefined when the world is not stored. */
export function readWorldMeta(db: IDBDatabase, id: string): Promise<WorldMetaRecord | undefined> {
  return promisifyRequest<WorldMetaRecord | undefined>(
    db.transaction([WORLD_META_STORE], 'readonly').objectStore(WORLD_META_STORE).get(id),
  );
}

/** Every metadata record in the library. */
export async function readAllWorldMeta(db: IDBDatabase): Promise<WorldMetaRecord[]> {
  return promisifyRequest<WorldMetaRecord[]>(
    db.transaction([WORLD_META_STORE], 'readonly').objectStore(WORLD_META_STORE).getAll(),
  );
}
