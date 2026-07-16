import { openDatabase, promisifyRequest } from '@/lib/idb';
import type { Dictionary, DictionaryMetadata, CommunityLink } from '@/types';

/**
 * A locally-stored dictionary ("book") plus its library timestamps and community link. Analogous to
 * `StoredWorldRecord`: every field outside `data` stays on this wrapper, so none of it reaches an exported
 * dictionary file.
 */
export interface StoredDictionaryRecord extends CommunityLink {
  id: string;
  name: string;
  createdAt?: string;
  lastAccessed?: string;
  data: Dictionary;
}

/** Singleton owning the local dictionary library (IndexedDB `dictionariesDB`/`dictionaries`). Mirrors the
 *  local-persistence half of `WorldStorageService`; default-exported as one shared instance. */
class DictionaryStorageService {
  dbName = 'dictionariesDB';
  storeName = 'dictionaries';
  db: IDBDatabase | null = null;

  constructor() {
    this.initialize();
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

  /** List stored dictionaries as lightweight metadata (no entries), for the library grid. */
  async getDictionaryMetadata(): Promise<DictionaryMetadata[]> {
    await this.ensureInitialized();
    const store = this.db!.transaction([this.storeName], 'readonly').objectStore(this.storeName);
    const records = await promisifyRequest<StoredDictionaryRecord[]>(store.getAll());
    return records.map((r) => ({
      id: r.id,
      name: r.name,
      entryCount: r.data?.entries?.length ?? 0,
      createdAt: r.createdAt,
      lastAccessed: r.lastAccessed,
      // The community link travels with the metadata: the library grid never shows it, but the download
      // flow reads these to tell a fresh listing from one you already hold (see lib/downloadState).
      sourceId: r.sourceId,
      dirty: r.dirty,
      editedAt: r.editedAt,
      downloadedAt: r.downloadedAt,
      sourceUpdatedAt: r.sourceUpdatedAt,
    }));
  }

  /** Load one dictionary's full book (with entries); rejects if missing or malformed. */
  async getDictionaryData(id: string): Promise<Dictionary> {
    await this.ensureInitialized();
    if (!id) return Promise.reject('Dictionary ID is required');
    const store = this.db!.transaction([this.storeName], 'readonly').objectStore(this.storeName);
    const record = await promisifyRequest<StoredDictionaryRecord | undefined>(store.get(id));
    if (!record?.data || !Array.isArray(record.data.entries)) return Promise.reject('Dictionary not found');
    return record.data;
  }

  /** Upsert a dictionary by `id`; `createdAt` is sticky (stamped once), `lastAccessed` bumped each store. */
  async storeDictionary(dictionary: StoredDictionaryRecord): Promise<void> {
    await this.ensureInitialized();
    if (!dictionary.name || !dictionary.data || !Array.isArray(dictionary.data.entries)) {
      throw new Error('Invalid dictionary: missing required fields');
    }
    return new Promise<void>((resolve, reject) => {
      const store = this.db!.transaction([this.storeName], 'readwrite').objectStore(this.storeName);
      const getRequest = store.get(dictionary.id);
      getRequest.onsuccess = () => {
        const existing = getRequest.result as StoredDictionaryRecord | undefined;
        // Rebuilt field-by-field rather than spread, so anything not named here is dropped. The community
        // link is read-merged because the editor's save passes only id/name/data — without this, the first
        // edit to a downloaded book would sever it. `??`, not `||`: a download's `dirty: false` must win.
        const putRequest = store.put({
          id: dictionary.id,
          name: dictionary.name,
          data: dictionary.data,
          createdAt: existing?.createdAt ?? dictionary.createdAt ?? new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          sourceId: dictionary.sourceId ?? existing?.sourceId,
          dirty: dictionary.dirty ?? existing?.dirty,
          editedAt: dictionary.editedAt ?? existing?.editedAt,
          downloadedAt: dictionary.downloadedAt ?? existing?.downloadedAt,
          sourceUpdatedAt: dictionary.sourceUpdatedAt ?? existing?.sourceUpdatedAt,
        });
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject('Failed to store dictionary');
      };
      getRequest.onerror = () => reject('Failed to store dictionary');
    });
  }

  /** Remove a dictionary from the library by `id`. */
  async deleteDictionary(id: string): Promise<void> {
    await this.ensureInitialized();
    if (!id) throw new Error('Dictionary ID is required');
    const store = this.db!.transaction([this.storeName], 'readwrite').objectStore(this.storeName);
    await promisifyRequest(store.delete(id));
  }
}

export default new DictionaryStorageService();
