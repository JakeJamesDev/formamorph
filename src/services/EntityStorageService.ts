import { LibraryStore, type StoredRecord } from './LibraryStore';
import { primaryImage } from '@/lib/entityImages';
import { describePlaceholders } from '@/lib/placeholders';
import { EMPTY_LETTERS, entityPlacementLetters, labelPlaceholders } from '@/lib/placementLetters';
import { migrateCarriedPlaceholders } from '@/lib/version';
import { carriedPlaceholders } from '@/lib/placeholderHomes';
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
    // Library cards have no world or playthrough behind them, so chips render display-only against the
    // defs the standalone character carries — same treatment its community listing gets. The name goes
    // through it too: a card titled with a chip would otherwise read as a raw placement id. Converted once
    // per record, since both fields read the same defs and the whole library runs this on every render.
    toMetadata: (record) => {
      const placeholders = carriedPlaceholders({
        placeholders: migrateCarriedPlaceholders(record.data?.placeholders),
        sharedPlaceholders: migrateCarriedPlaceholders(record.data?.sharedPlaceholders),
      });
      return {
        id: record.id,
        name: labelPlaceholders(record.name, placeholders, { letters: record.data ? entityPlacementLetters(record.data) : EMPTY_LETTERS }),
        description: describePlaceholders(record.data?.playerDescription ?? '', placeholders) || undefined,
        image: primaryImage(record.data),
        tags: record.data?.tags ?? [],
        createdAt: record.createdAt,
        lastAccessed: record.lastAccessed,
        // The community link travels with the metadata: the library grid never shows it, but the download
        // flow reads these to tell a fresh listing from one you already hold (see lib/downloadState).
        sourceId: record.sourceId,
        dirty: record.dirty,
        editedAt: record.editedAt,
        downloadedAt: record.downloadedAt,
        sourceUpdatedAt: record.sourceUpdatedAt,
      };
    },
  });

  /** Open the IndexedDB connection (idempotent). */
  initialize() {
    return this.store.initialize();
  }

  /** List stored characters as grid metadata; `image` is the portrait so the grid can render it. */
  getEntityMetadata(): Promise<EntityMetadata[]> {
    return this.store.getMetadata();
  }

  /** Load one character's full entity; rejects if missing. A library character never passes through
   *  `migrateWorld`, so its carried defs take the value-record conversion here — the single read boundary
   *  the editor and add-to-world both go through. */
  async getEntityData(id: string): Promise<Entity> {
    const entity = await this.store.getData(id);
    return {
      ...entity,
      ...(entity.placeholders ? { placeholders: migrateCarriedPlaceholders(entity.placeholders) } : {}),
      ...(entity.sharedPlaceholders ? { sharedPlaceholders: migrateCarriedPlaceholders(entity.sharedPlaceholders) } : {}),
    };
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
