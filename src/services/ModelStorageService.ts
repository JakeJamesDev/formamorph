import { randomUUID } from '@/lib/uuid';
import { promisifyRequest } from '@/lib/idb';
import { blobHash } from '@/lib/blobHash';
import { readVrmMeta } from '@/lib/vrmMeta';
import { optimizeImageDataUrl, IMAGE_CAPS } from '@/lib/imageOptim';
import { renderVrmThumbnail } from '@/lib/vrmThumbnail';
import { DEFAULT_MODEL_ID } from '@/lib/defaultModel';
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

/** Set once the bundled model has been offered; a later delete is the player's business, not a gap to refill. */
const SEEDED_KEY = 'FORMAMORPH_defaultModelSeeded';

const isFlat = (record: unknown): record is FlatModelRecord =>
  !!record && typeof record === 'object' && !('data' in record) && 'blob' in record;

/**
 * Bring an embedded thumbnail down to card size and re-encode it to WebP.
 *
 * A VRM's own thumbnail is authored for a storefront, not a tile: real files carry multi-megabyte PNGs (one
 * sample ships a 1.6MB 2048px image), and base64 adds a third on top. Every one of those rides in
 * `ModelMetadata`, so the whole grid would load them all. The rendered fallback is already WebP; this puts the
 * embedded path on the same footing. `optimizeImageDataUrl` hands back the original if it can't do better, so
 * this is safe to apply unconditionally.
 */
const shrinkThumbnail = (thumbnail: string | undefined): Promise<string | undefined> =>
  thumbnail ? optimizeImageDataUrl(thumbnail, IMAGE_CAPS.thumbnail) : Promise.resolve(undefined);

/** Shared by the store's grid listing and the lookups that read raw records. */
const toMetadata = (record: StoredModelRecord): ModelMetadata => ({
  id: record.id,
  name: record.name,
  type: record.data?.type ?? '',
  size: record.data?.size ?? 0,
  thumbnail: record.data?.thumbnail,
  license: record.data?.license,
  createdAt: record.createdAt,
  lastAccessed: record.lastAccessed,
});

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
    toMetadata,
  });

  /** Runs once per session; later calls await the same pass rather than rescanning. */
  private migration: Promise<void> | null = null;

  /** Open the IndexedDB connection (idempotent). */
  initialize() {
    return this.store.initialize();
  }

  /** Every stored record, wrapper included — `LibraryStore` only exposes projected metadata or bare payloads. */
  private async allRecords(): Promise<StoredModelRecord[]> {
    await this.store.ensureInitialized();
    return promisifyRequest<StoredModelRecord[]>(
      this.store.db!.transaction(['models'], 'readonly').objectStore('models').getAll(),
    );
  }

  /**
   * Persist `data` onto an existing record, but only if the record is still there — a delete that lands while
   * a thumbnail is being computed must not be undone by the backfill writing the row back. The get and put
   * share one readwrite transaction, which IndexedDB serializes against a concurrent delete, so the check and
   * the write can't interleave.
   */
  private async updateDataIfPresent(id: string, data: VrmData): Promise<void> {
    await this.store.ensureInitialized();
    return new Promise<void>((resolve, reject) => {
      const store = this.store.db!.transaction(['models'], 'readwrite').objectStore('models');
      const get = store.get(id);
      get.onsuccess = () => {
        const existing = get.result as StoredModelRecord | undefined;
        if (!existing) return resolve(); // deleted meanwhile — leave it gone
        const put = store.put({ ...existing, data });
        put.onsuccess = () => resolve();
        put.onerror = () => reject(put.error);
      };
      get.onerror = () => reject(get.error);
    });
  }

  /** One stored record with its wrapper, or null. */
  private async getRecord(id: string): Promise<StoredModelRecord | null> {
    await this.store.ensureInitialized();
    const record = await promisifyRequest<StoredModelRecord | undefined>(
      this.store.db!.transaction(['models'], 'readonly').objectStore('models').get(id),
    );
    return record ?? null;
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

  /**
   * Store an uploaded VRM file and return its library record. Reads the file's own metadata up front — that's
   * cheap and pure — but leaves the thumbnail render to `ensureThumbnail`, since only files with no embedded
   * thumbnail need it and rendering costs a GPU context.
   */
  async addModel(file: File): Promise<StoredModelRecord> {
    await this.ensureMigrated();
    const [hash, { license, thumbnail }] = await Promise.all([blobHash(file), readVrmMeta(file)]);
    const record: StoredModelRecord = {
      id: randomUUID(),
      // Prefer the model's own title over the filename, which is often a export-tool default.
      name: license.title?.trim() || file.name.replace(/\.[^.]+$/, ''),
      data: {
        type: file.type || 'model/vrm',
        blob: file,
        size: file.size,
        hash,
        license,
        thumbnail: await shrinkThumbnail(thumbnail),
      },
    };
    await this.store.store(record);
    return record;
  }

  /**
   * Put the bundled model in the library, once ever. Fetches it only when it hasn't been seeded before, so a
   * normal launch costs a localStorage read rather than an 18MB read.
   *
   * Seeding is one-shot rather than a per-launch reconcile: once seeded, the copy is the player's, and
   * deleting it means it's gone. That's the whole point of it being an ordinary record — unlike the bundled
   * worlds, which re-seed on content change and so need tombstones to respect a delete.
   */
  async seedDefaultModel(url: string): Promise<void> {
    await this.ensureMigrated();
    try {
      if (localStorage.getItem(SEEDED_KEY)) return;
      // Already present (flag lost, or a prior run seeded then the flag was cleared): mark it and stop, no
      // needless re-fetch. The flag is only ever set once the record is known to exist — see below.
      if (await this.getRecord(DEFAULT_MODEL_ID)) {
        localStorage.setItem(SEEDED_KEY, '1');
        return;
      }

      const blob = await (await fetch(url)).blob();
      const [hash, { license, thumbnail }] = await Promise.all([blobHash(blob), readVrmMeta(blob)]);
      await this.store.store({
        id: DEFAULT_MODEL_ID,
        name: license.title?.trim() || 'Default Model',
        data: {
          type: blob.type || 'model/vrm',
          blob,
          size: blob.size,
          hash,
          license,
          thumbnail: await shrinkThumbnail(thumbnail),
        },
      });
      // Only mark seeded once the store has actually landed. A transient fetch/store failure leaves the flag
      // unset so the next launch retries, rather than locking the default out forever. The fetch is a bundled
      // same-origin file (browser-cached), so re-attempting on failure is cheap.
      localStorage.setItem(SEEDED_KEY, '1');
    } catch (error) {
      console.error('Failed to seed the default model:', error);
    }
  }

  /**
   * The stored model with the same bytes as `file`, if the library already holds one. Lets an import offer to
   * replace rather than silently keeping two copies of a multi-MB file.
   */
  async findDuplicate(file: Blob): Promise<ModelMetadata | null> {
    await this.ensureMigrated();
    const hash = await blobHash(file);
    const records = await this.allRecords();
    const match = records.find((record) => record.data?.hash === hash);
    return match ? toMetadata(match) : null;
  }

  /** List stored models as grid metadata, newest first. */
  async getModelMetadata(): Promise<ModelMetadata[]> {
    await this.ensureMigrated();
    const models = await this.store.getMetadata();
    return models.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }

  /**
   * Fill in whatever a record is missing — license, hash, and a thumbnail — and persist the result. Legacy
   * records predate all three, so this is the library's backfill: cards call it on first view rather than the
   * whole library paying for every model up front.
   *
   * Returns the thumbnail if there is one. A render that produces nothing is recorded, so a model that simply
   * can't be drawn isn't re-attempted on every view. Never throws: a card renders this, and a bad model must
   * cost that card its picture, not the whole grid.
   */
  async ensureThumbnail(id: string): Promise<string | undefined> {
    await this.ensureMigrated();
    const record = await this.getRecord(id);
    if (!record?.data?.blob) return undefined;
    const data = record.data;
    if (data.thumbnail) return data.thumbnail;
    if (data.thumbnailFailed) return undefined;

    try {
      const resolved: VrmData = { ...data };
      if (!resolved.license || !resolved.hash) {
        const [hash, meta] = await Promise.all([
          resolved.hash ? Promise.resolve(resolved.hash) : blobHash(data.blob),
          readVrmMeta(data.blob),
        ]);
        resolved.hash = hash;
        resolved.license ??= meta.license;
        resolved.thumbnail = await shrinkThumbnail(meta.thumbnail);
      }
      // Only render when the file carried no thumbnail of its own.
      resolved.thumbnail ??= await renderVrmThumbnail(data.blob, resolved.license?.metaVersion ?? null);
      if (!resolved.thumbnail) resolved.thumbnailFailed = true;

      // Persist only if the record still exists — the render can take a second, and a delete in that window
      // must not be undone by writing the row back.
      await this.updateDataIfPresent(id, resolved);
      return resolved.thumbnail;
    } catch {
      return undefined;
    }
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

  /**
   * Remove a model from the library by `id`, unless it's the only one left — the player must always have a
   * model to be. The rule is "at least one", not "keep the bundled default": once another model exists, the
   * default is as deletable as anything else.
   */
  async deleteModel(id: string): Promise<void> {
    await this.ensureMigrated();
    await this.store.ensureInitialized();
    // The count, the existence check, and the delete share one readwrite transaction. IndexedDB serializes
    // transactions over the store, so two concurrent deletes can't both see count > 1 and then both delete —
    // which a read-then-delete across separate transactions would allow, emptying the library.
    return new Promise<void>((resolve, reject) => {
      const store = this.store.db!.transaction(['models'], 'readwrite').objectStore('models');
      const countReq = store.count();
      countReq.onsuccess = () => {
        const total = countReq.result;
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          if (total <= 1 && getReq.result) {
            return reject(new Error('Cannot delete the last model: the library must always have at least one.'));
          }
          const del = store.delete(id);
          del.onsuccess = () => resolve();
          del.onerror = () => reject(del.error);
        };
        getReq.onerror = () => reject(getReq.error);
      };
      countReq.onerror = () => reject(countReq.error);
    });
  }
}

export default new ModelStorageService();
