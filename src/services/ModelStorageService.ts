import { randomUUID } from '@/lib/uuid';
import { promisifyRequest } from '@/lib/idb';
import { LibraryStore, type StoredRecord } from './LibraryStore';
import type { ModelMetadata, VrmData } from '@/types';

/** A locally-stored VRM plus its library timestamps. Local-only, like `StoredEntityRecord`. */
export type StoredModelRecord = StoredRecord<VrmData>;

/**
 * The pre-library record shape: the VRM's descriptors sat at the top level rather than under `data`, and
 * the creation stamp was named `addedAt`. Read only by the one-time migration below.
 */
interface FlatModelRecord {
  id: string;
  name: string;
  type?: string;
  blob?: Blob;
  size?: number;
  addedAt?: string;
}

const isFlat = (record: unknown): record is FlatModelRecord =>
  !!record && typeof record === 'object' && !('data' in record) && 'blob' in record;

/**
 * Singleton owning the local model library (IndexedDB `FORMAMORPH_MODELS_DB`/`models`). Kept out of the
 * save-game DB (`dbUtils`) because that one opens versionlessly and can't gain a new object store cleanly.
 * VRMs are stored as Blobs — lighter than base64 for multi-MB files, and GLTFLoader accepts the resulting
 * `blob:` URLs. The CRUD lives in `LibraryStore`; this names the operations in model terms and folds the
 * legacy flat records forward.
 */
class ModelStorageService {
  private readonly store = new LibraryStore<VrmData, ModelMetadata>({
    dbName: 'FORMAMORPH_MODELS_DB',
    storeName: 'models',
    noun: 'Model',
    // Presence, not `instanceof Blob`: structured-clone round-trips don't guarantee the constructor
    // identity of this realm, and a missing payload is the failure actually worth catching.
    isValid: (model) => !!model.blob,
    toMetadata: (record) => ({
      id: record.id,
      name: record.name,
      type: record.data?.type ?? '',
      size: record.data?.size ?? 0,
      createdAt: record.createdAt,
      lastAccessed: record.lastAccessed,
    }),
  });

  /** Runs once per session; later calls await the same pass rather than rescanning. */
  private migration: Promise<void> | null = null;

  /** Open the IndexedDB connection (idempotent). */
  initialize() {
    return this.store.initialize();
  }

  /**
   * Fold any pre-library flat records into the wrapped shape, in place. Runs before every operation because
   * a flat record has no `data` and would otherwise read as missing.
   */
  private async ensureMigrated(): Promise<void> {
    this.migration ??= (async () => {
      await this.store.ensureInitialized();
      const db = this.store.db!;
      const raw = await promisifyRequest<unknown[]>(
        db.transaction(['models'], 'readonly').objectStore('models').getAll(),
      );
      const flat = raw.filter(isFlat);
      if (!flat.length) return;
      const write = db.transaction(['models'], 'readwrite').objectStore('models');
      await Promise.all(
        flat.map((record) =>
          promisifyRequest(
            write.put({
              id: record.id,
              name: record.name,
              createdAt: record.addedAt,
              lastAccessed: record.addedAt,
              data: { type: record.type ?? 'model/vrm', blob: record.blob!, size: record.size ?? 0 },
            } satisfies StoredModelRecord),
          ),
        ),
      );
    })();
    return this.migration;
  }

  /** Store an uploaded VRM file and return its library record. */
  async addModel(file: File): Promise<StoredModelRecord> {
    await this.ensureMigrated();
    const record: StoredModelRecord = {
      id: randomUUID(),
      name: file.name.replace(/\.[^.]+$/, ''),
      data: { type: file.type || 'model/vrm', blob: file, size: file.size },
    };
    await this.store.store(record);
    return record;
  }

  /** List stored models as grid metadata, newest first. */
  async getModelMetadata(): Promise<ModelMetadata[]> {
    await this.ensureMigrated();
    const models = await this.store.getMetadata();
    return models.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }

  /** Load one model's payload; rejects if missing or malformed. */
  async getModelData(id: string): Promise<VrmData> {
    await this.ensureMigrated();
    return this.store.getData(id);
  }

  /** Upsert a model by `id`; `createdAt` is sticky (stamped once), `lastAccessed` bumped each store. */
  async storeModel(model: StoredModelRecord): Promise<void> {
    await this.ensureMigrated();
    return this.store.store(model);
  }

  /** Remove a model from the library by `id`. */
  async deleteModel(id: string): Promise<void> {
    await this.ensureMigrated();
    return this.store.delete(id);
  }
}

export default new ModelStorageService();
