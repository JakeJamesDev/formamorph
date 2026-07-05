import { openDatabase, promisifyRequest } from '@/lib/idb';
import type { Entity, EntityMetadata } from '@/types';

/** A locally-stored character ("entity") plus its library timestamps. Local-only, like `StoredDictionaryRecord`. */
export interface StoredEntityRecord {
  id: string;
  name: string;
  createdAt?: string;
  lastAccessed?: string;
  data: Entity;
}

/** Singleton owning the local character library (IndexedDB `entitiesDB`/`entities`). Mirrors
 *  `DictionaryStorageService`; default-exported as one shared instance. */
class EntityStorageService {
  dbName = 'entitiesDB';
  storeName = 'entities';
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

  /** List stored characters as grid metadata; `image` is the portrait so the grid can render it. */
  async getEntityMetadata(): Promise<EntityMetadata[]> {
    await this.ensureInitialized();
    const store = this.db!.transaction([this.storeName], 'readonly').objectStore(this.storeName);
    const records = await promisifyRequest<StoredEntityRecord[]>(store.getAll());
    return records.map((r) => ({
      id: r.id,
      name: r.name,
      image: r.data?.image,
      createdAt: r.createdAt,
      lastAccessed: r.lastAccessed,
    }));
  }

  /** Load one character's full entity; rejects if missing. */
  async getEntityData(id: string): Promise<Entity> {
    await this.ensureInitialized();
    if (!id) return Promise.reject('Entity ID is required');
    const store = this.db!.transaction([this.storeName], 'readonly').objectStore(this.storeName);
    const record = await promisifyRequest<StoredEntityRecord | undefined>(store.get(id));
    if (!record?.data) return Promise.reject('Entity not found');
    return record.data;
  }

  /** Upsert a character by `id`; `createdAt` is sticky (stamped once), `lastAccessed` bumped each store. */
  async storeEntity(entity: StoredEntityRecord): Promise<void> {
    await this.ensureInitialized();
    if (!entity.name || !entity.data) {
      throw new Error('Invalid entity: missing required fields');
    }
    return new Promise<void>((resolve, reject) => {
      const store = this.db!.transaction([this.storeName], 'readwrite').objectStore(this.storeName);
      const getRequest = store.get(entity.id);
      getRequest.onsuccess = () => {
        const existing = getRequest.result as StoredEntityRecord | undefined;
        const putRequest = store.put({
          id: entity.id,
          name: entity.name,
          data: entity.data,
          createdAt: existing?.createdAt ?? entity.createdAt ?? new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
        });
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject('Failed to store entity');
      };
      getRequest.onerror = () => reject('Failed to store entity');
    });
  }

  /** Remove a character from the library by `id`. */
  async deleteEntity(id: string): Promise<void> {
    await this.ensureInitialized();
    if (!id) throw new Error('Entity ID is required');
    const store = this.db!.transaction([this.storeName], 'readwrite').objectStore(this.storeName);
    await promisifyRequest(store.delete(id));
  }
}

export default new EntityStorageService();
