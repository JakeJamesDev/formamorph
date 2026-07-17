import { LibraryStore, type StoredRecord } from './LibraryStore';
import type { Entity, EntityMetadata } from '@/types';

/** A locally-stored character ("entity") plus its library timestamps. Local-only, like `StoredDictionaryRecord`. */
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
      image: record.data?.image,
      createdAt: record.createdAt,
      lastAccessed: record.lastAccessed,
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
