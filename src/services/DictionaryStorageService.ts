import { LibraryStore, type StoredRecord } from './LibraryStore';
import { migrateEntryKeys } from '@/lib/version';
import { describePlaceholders } from '@/lib/placeholders';
import type { Dictionary, DictionaryMetadata } from '@/types';

/** A locally-stored dictionary ("book") plus its library timestamps, and (via `StoredRecord`) the
 *  community-link fields so a dictionary can be published to and downloaded from the community server. */
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
      // Display-only chip rendering: a library card has no world or rolls behind it, so the book's own
      // carried defs are all there is — same treatment its community listing gets.
      description: describePlaceholders(record.data?.description ?? '', record.data?.placeholders) || undefined,
      thumbnail: record.data?.thumbnail ?? undefined,
      entryCount: record.data?.entries?.length ?? 0,
      tags: record.data?.tags ?? [],
      createdAt: record.createdAt,
      lastAccessed: record.lastAccessed,
      // The community link travels with the metadata: the library grid never shows it, but the download flow
      // reads these to tell a fresh listing from one you already hold (see lib/downloadState).
      sourceId: record.sourceId,
      dirty: record.dirty,
      editedAt: record.editedAt,
      downloadedAt: record.downloadedAt,
      sourceUpdatedAt: record.sourceUpdatedAt,
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

  /**
   * Load one dictionary's full book (with entries); rejects if missing or malformed. Library books never pass
   * through `migrateWorld`, so the keyword-array migration is applied here — the single read boundary every
   * caller (editor, add-to-world, selection) goes through.
   */
  async getDictionaryData(id: string): Promise<Dictionary> {
    const book = await this.store.getData(id);
    return { ...book, entries: (book.entries ?? []).map(migrateEntryKeys) };
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
