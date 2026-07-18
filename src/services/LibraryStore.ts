import { openDatabase, promisifyRequest } from '@/lib/idb';
import type { CommunityLink } from '@/types';

/**
 * The wrapper shape every local library record shares: identity and library timestamps around an opaque
 * `data` payload, plus the optional `CommunityLink` fields (`sourceId`/`dirty`/download stamps) so any library
 * type can be published/downloaded. Types that never link to the community simply leave them unset.
 */
export interface StoredRecord<T> extends CommunityLink {
  id: string;
  name: string;
  createdAt?: string;
  lastAccessed?: string;
  data: T;
}

/** How one library type specializes the shared store: where it lives, how it reads, and how it validates. */
export interface LibraryStoreOptions<T, M> {
  dbName: string;
  storeName: string;
  /**
   * Capitalized display noun for error messages, e.g. `Dictionary`. Lowercased where the message reads
   * that way, so the wording matches what each service raised before.
   */
  noun: string;
  /** Projects a stored record down to the lightweight metadata the library grid renders. */
  toMetadata: (record: StoredRecord<T>) => M;
  /** Rejects a structurally malformed payload. Presence of `data` is already checked separately. */
  isValid?: (data: T) => boolean;
}

/**
 * Shared local-library persistence over one IndexedDB store: lazy connection, metadata listing, single-record
 * load, sticky-timestamp upsert, and delete. Dictionaries, characters, and models differ only in where they
 * live and how they read, so they supply those via options rather than restating the CRUD.
 *
 * Worlds deliberately don't use this: `WorldStorageService` read-merges its own local-only fields
 * (`sourceId`, `dirty`, and the download stamps) and layers community-server and default-seeding logic on top.
 */
export class LibraryStore<T, M> {
  readonly dbName: string;
  readonly storeName: string;
  db: IDBDatabase | null = null;
  private readonly noun: string;
  private readonly lowerNoun: string;
  private readonly toMetadata: (record: StoredRecord<T>) => M;
  private readonly isValid: (data: T) => boolean;

  constructor(options: LibraryStoreOptions<T, M>) {
    this.dbName = options.dbName;
    this.storeName = options.storeName;
    this.noun = options.noun;
    this.lowerNoun = options.noun.toLowerCase();
    this.toMetadata = options.toMetadata;
    this.isValid = options.isValid ?? (() => true);
    // Warm the connection on construction so the first read isn't waiting on the open; every operation
    // still awaits `ensureInitialized`, so this is an optimization rather than a precondition.
    void this.initialize().catch(() => { /* retried by ensureInitialized */ });
  }

  /** Open the IndexedDB connection (idempotent — no-op once `db` is set). */
  async initialize() {
    if (this.db) return;
    this.db = await openDatabase(this.dbName, 1, [{ name: this.storeName, keyPath: 'id' }]);
  }

  /** Lazily open the DB if not yet connected; awaited at the top of every operation. */
  async ensureInitialized() {
    if (!this.db) await this.initialize();
  }

  private objectStore(mode: IDBTransactionMode): IDBObjectStore {
    return this.db!.transaction([this.storeName], mode).objectStore(this.storeName);
  }

  /** List stored records as grid metadata, projected by `toMetadata`. */
  async getMetadata(): Promise<M[]> {
    await this.ensureInitialized();
    const records = await promisifyRequest<StoredRecord<T>[]>(this.objectStore('readonly').getAll());
    return records.map((record) => this.toMetadata(record));
  }

  /** Load one record's full payload; rejects if missing or malformed. */
  async getData(id: string): Promise<T> {
    await this.ensureInitialized();
    if (!id) return Promise.reject(`${this.noun} ID is required`);
    const record = await promisifyRequest<StoredRecord<T> | undefined>(this.objectStore('readonly').get(id));
    if (!record?.data || !this.isValid(record.data)) return Promise.reject(`${this.noun} not found`);
    return record.data;
  }

  /** Upsert by `id`; `createdAt` is sticky (stamped once), `lastAccessed` bumped each store. */
  async store(record: StoredRecord<T>): Promise<void> {
    await this.ensureInitialized();
    if (!record.name || !record.data || !this.isValid(record.data)) {
      throw new Error(`Invalid ${this.lowerNoun}: missing required fields`);
    }
    return new Promise<void>((resolve, reject) => {
      const store = this.objectStore('readwrite');
      const getRequest = store.get(record.id);
      getRequest.onsuccess = () => {
        const existing = getRequest.result as StoredRecord<T> | undefined;
        const putRequest = store.put({
          id: record.id,
          name: record.name,
          data: record.data,
          createdAt: existing?.createdAt ?? record.createdAt ?? new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          // Community link (publish/download): read-merged so an editor save that passes only id/name/data
          // keeps it. `??`, not `||`: a download's `dirty: false` must win over an existing `true`.
          sourceId: record.sourceId ?? existing?.sourceId,
          dirty: record.dirty ?? existing?.dirty,
          editedAt: record.editedAt ?? existing?.editedAt,
          downloadedAt: record.downloadedAt ?? existing?.downloadedAt,
          sourceUpdatedAt: record.sourceUpdatedAt ?? existing?.sourceUpdatedAt,
        });
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(`Failed to store ${this.lowerNoun}`);
      };
      getRequest.onerror = () => reject(`Failed to store ${this.lowerNoun}`);
    });
  }

  /** Remove a record from the library by `id`. */
  async delete(id: string): Promise<void> {
    await this.ensureInitialized();
    if (!id) throw new Error(`${this.noun} ID is required`);
    await promisifyRequest(this.objectStore('readwrite').delete(id));
  }
}
