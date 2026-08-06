import { LibraryStore, type StoredRecord } from './LibraryStore';
import { primaryImage } from '@/lib/entityImages';
import { describePlaceholders } from '@/lib/placeholders';
import type { Entity, EntityMetadata } from '@/types';

/** A locally-stored character ("entity") plus its library timestamps, and (via `StoredRecord`) the
 *  community-link fields so a character can be published to and downloaded from the community server. */
export type StoredEntityRecord = StoredRecord<Entity>;

/** Singleton owning the local character library (IndexedDB `entitiesDB`/`entities`). The CRUD lives in
 *  `LibraryStore`; this names the operations in character terms. Default-exported as one shared instance. */
class EntityStorageService {
  private readonly store = new LibraryStore<Entity, EntityMetadata>({
    dbName: 'entitiesDB',
    storeName: 'entities',
    noun: 'Entity',
    toMetadata: (record) => ({
      id: record.id,
      name: record.name,
      // Library cards have no world or playthrough behind them, so chips render display-only against the
      // defs the standalone character carries — same treatment its community listing gets.
      description: describePlaceholders(record.data?.playerDescription ?? '', record.data?.placeholders) || undefined,
      image: primaryImage(record.data),
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

  /** List stored characters as grid metadata; `image` is the portrait so the grid can render it. */
  getEntityMetadata(): Promise<EntityMetadata[]> {
    return this.store.getMetadata();
  }

  /** Load one character's full entity; rejects if missing. */
  getEntityData(id: string): Promise<Entity> {
    return this.store.getData(id);
  }

  /** Upsert a character by `id`; `createdAt` is sticky (stamped once), `lastAccessed` bumped each store. */
  storeEntity(entity: StoredEntityRecord): Promise<void> {
    return this.store.store(entity);
  }

  /** Remove a character from the library by `id`. */
  deleteEntity(id: string): Promise<void> {
    return this.store.delete(id);
  }
}

export default new EntityStorageService();
