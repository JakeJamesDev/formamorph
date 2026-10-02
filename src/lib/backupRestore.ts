/**
 * Writing a backup's records back into storage. Free of the DOM and of other workers, so the JSON file
 * worker runs the whole restore: read, optimize, and write each record in turn.
 */
import type { Entity, SaveRecord, World } from '@/types';
import { openDatabase, promisifyRequest } from './idb';
import { putSaveRecord } from '@/components/modals/dbUtils';
import { readBackupRecord, type BackupCategory, type BackupEntry, type BackupIndex, type IdRecord } from './backupIndex';
import { applyEntityImagesOptimize, applyWorldOptimize, type ImageCodec, type OptimizeMode } from './imageOptimCore';
import { countWorldImages } from './imageSlots';
import { encodeImageDataUrl, measureImageDataUrl } from './imageEncode';

/** IndexedDB location of each id-keyed store (saves are handled via dbUtils, which owns the v2 schema). */
export const STORE_TARGETS: Record<Exclude<BackupCategory, 'saves'>, { db: string; store: string }> = {
  worlds: { db: 'worldsDB', store: 'worlds' },
  entities: { db: 'entitiesDB', store: 'entities' },
  dictionaries: { db: 'dictionariesDB', store: 'dictionaries' },
};

async function writeStore(target: { db: string; store: string }, records: IdRecord[]): Promise<void> {
  if (!records.length) return;
  const db = await openDatabase(target.db, 1, [{ name: target.store, keyPath: 'id' }]);
  try {
    const store = db.transaction([target.store], 'readwrite').objectStore(target.store);
    await Promise.all(records.map((r) => promisifyRequest(store.put(r))));
  } finally {
    db.close();
  }
}

/** Write records for one category back into its store (saves route through the dbUtils helper). */
async function restoreCategory(category: BackupCategory, records: IdRecord[]): Promise<void> {
  if (category === 'saves') {
    for (const rec of records) await putSaveRecord(rec as unknown as SaveRecord);
    return;
  }
  await writeStore(STORE_TARGETS[category], records);
}

/** Per-category split of a backup against what's already stored: `fresh` ids are new, `conflicts` collide. */
export interface CategoryPlan {
  category: BackupCategory;
  fresh: BackupEntry[];
  conflicts: BackupEntry[];
}

export type RestoreCounts = Record<BackupCategory, { added: number; overwritten: number; skipped: number }>;

/**
 * Apply the plans: always write `fresh` records; write `conflicts` only for categories the user chose to
 * overwrite. Each record is read, passed through `transform`, and written before the next is read, so
 * only one is held at a time. Returns per-category counts of what was written vs. skipped.
 */
export async function applyBackup(
  index: BackupIndex,
  plans: CategoryPlan[],
  overwrite: Record<BackupCategory, boolean>,
  transform: (category: BackupCategory, record: IdRecord) => Promise<IdRecord> = async (_, r) => r,
): Promise<RestoreCounts> {
  const result = {} as RestoreCounts;
  for (const plan of plans) {
    const conflictsToWrite = overwrite[plan.category] ? plan.conflicts : [];
    for (const entry of [...plan.fresh, ...conflictsToWrite]) {
      await restoreCategory(plan.category, [await transform(plan.category, await readBackupRecord(index, entry))]);
    }
    result[plan.category] = {
      added: plan.fresh.length,
      overwritten: conflictsToWrite.length,
      skipped: overwrite[plan.category] ? 0 : plan.conflicts.length,
    };
  }
  return result;
}

/** Everything a restore needs; structured-cloneable, so it crosses into the worker as is. */
export interface RestoreRequest {
  index: BackupIndex;
  /** Only the ticked entries. */
  plans: CategoryPlan[];
  overwrite: Record<BackupCategory, boolean>;
  worldMode: OptimizeMode;
  entityMode: OptimizeMode;
  /** Probed on the main thread, which has a DOM canvas to probe with. */
  webpSupported: boolean;
}

/**
 * Restore the ticked records, optimizing world and entity images on this thread per the chosen modes.
 * `onProgress(done)` counts images as they finish, across the whole restore.
 */
export async function restoreBackup(request: RestoreRequest, onProgress: (done: number) => void = () => {}): Promise<RestoreCounts> {
  const { worldMode, entityMode, webpSupported } = request;
  const codec: ImageCodec = {
    encode: (url, maxDim, lossless, allowGrow) => encodeImageDataUrl(url, maxDim, webpSupported, lossless, allowGrow),
    measure: measureImageDataUrl,
  };
  let done = 0;
  const transform = async (category: BackupCategory, rec: IdRecord): Promise<IdRecord> => {
    if (typeof rec.data !== 'object' || rec.data === null) return rec;
    if (category === 'worlds' && worldMode !== 'off') {
      const world = rec.data as World;
      const data = await applyWorldOptimize(codec, world, worldMode, (d) => onProgress(done + d));
      done += countWorldImages(world);
      return { ...rec, data, thumbnail: data.worldOverview?.thumbnail ?? rec.thumbnail };
    }
    if (category === 'entities' && entityMode !== 'off') {
      const data = await applyEntityImagesOptimize(codec, rec.data as Entity, entityMode, () => onProgress(++done));
      return { ...rec, data };
    }
    return rec;
  };
  return applyBackup(request.index, request.plans, request.overwrite, transform);
}
