import { LibraryStore, type StoredRecord } from './LibraryStore';
import type { Dictionary, DictionaryMetadata } from '@/types';

/** A locally-stored dictionary ("book") plus its library timestamps. Analogous to `StoredWorldRecord`,
 *  but purely local — dictionaries aren't a community-server concept. */
export type StoredDictionaryRecord = StoredRecord<Dictionary>;

/** Singleton owning the local dictionary library (IndexedDB `dictionariesDB`/`dictionaries`). The CRUD lives
 *  in `LibraryStore`; this names the operations in dictionary terms. Default-exported as one shared instance. */
class DictionaryStorageService {
  private readonly store = new LibraryStore<Dictionary, DictionaryMetadata>({
    dbName: 'dictionariesDB',
    storeName: 'dictionaries',
    noun: 'Dictionary',
    isValid: (dictionary) => Array.isArray(dictionary.entries),
    toMetadata: (record) => ({
      id: record.id,
      name: record.name,
      entryCount: record.data?.entries?.length ?? 0,
      createdAt: record.createdAt,
      lastAccessed: record.lastAccessed,
    }),
  });

  /** Open the IndexedDB connection (idempotent). */
  initialize() {
    return this.store.initialize();
  }

  /** List stored dictionaries as lightweight metadata (no entries), for the library grid. */
  getDictionaryMetadata(): Promise<DictionaryMetadata[]> {
    return this.store.getMetadata();
  }

  /** Load one dictionary's full book (with entries); rejects if missing or malformed. */
  getDictionaryData(id: string): Promise<Dictionary> {
    return this.store.getData(id);
  }

  /** Upsert a dictionary by `id`; `createdAt` is sticky (stamped once), `lastAccessed` bumped each store. */
  storeDictionary(dictionary: StoredDictionaryRecord): Promise<void> {
    return this.store.store(dictionary);
  }

  /** Remove a dictionary from the library by `id`. */
  deleteDictionary(id: string): Promise<void> {
    return this.store.delete(id);
  }
}

export default new DictionaryStorageService();
