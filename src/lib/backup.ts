/**
 * Full-library backup bundle: export every world, save, library entity, and library
 * dictionary into one self-contained `.json`, and restore it later. Images are already base64-embedded
 * in these records, so the bundle is offline-safe and portable across origins — the fix for itch/web
 * users whose origin-scoped IndexedDB is orphaned when a hosted build updates.
 *
 * Settings, downloaded models, and caches are intentionally excluded: they're either device-local or
 * re-derivable, not irreplaceable authored content.
 */
import { openDatabase, promisifyRequest } from '@/lib/idb';
import { downloadBlob } from '@/lib/downloadBlob';
import { indexBackupInWorker, serializeJsonBlobSplit } from '@/lib/jsonFileWorkerUtils';
import { getAllSaveRecords, putSaveRecord } from '@/components/modals/dbUtils';
import { APP_VERSION } from '@/lib/version';
import {
  BACKUP_CATEGORIES,
  itemLabel,
  readBackupRecord,
  type BackupCategory,
  type BackupEntry,
  type BackupIndex,
  type IdRecord,
} from '@/lib/backupIndex';
import type { SaveRecord } from '@/types';

/** Bumped only if the bundle's shape changes incompatibly; readers warn on a newer value but still try. */
export const BACKUP_FORMAT = 1;

// Re-exported so importers keep one `@/lib/backup` path; the worker-safe part lives in `backupIndex`.
export { BACKUP_CATEGORIES, itemLabel, readBackupRecord };
export type { BackupCategory, BackupEntry, BackupIndex, IdRecord };

export interface BackupBundle {
  formamorphBackup: number;
  appVersion: string;
  exportedAt: string;
  data: Record<BackupCategory, IdRecord[]>;
}

export const CATEGORY_LABELS: Record<BackupCategory, string> = {
  worlds: 'Worlds',
  saves: 'Saves',
  entities: 'Entities',
  dictionaries: 'Dictionaries',
};

/** IndexedDB location of each id-keyed store (saves are handled via dbUtils, which owns the v2 schema). */
const STORE_TARGETS: Record<Exclude<BackupCategory, 'saves'>, { db: string; store: string }> = {
  worlds: { db: 'worldsDB', store: 'worlds' },
  entities: { db: 'entitiesDB', store: 'entities' },
  dictionaries: { db: 'dictionariesDB', store: 'dictionaries' },
};

async function readStore(target: { db: string; store: string }): Promise<IdRecord[]> {
  const db = await openDatabase(target.db, 1, [{ name: target.store, keyPath: 'id' }]);
  try {
    return await promisifyRequest<IdRecord[]>(
      db.transaction([target.store], 'readonly').objectStore(target.store).getAll(),
    );
  } finally {
    db.close();
  }
}

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

/** Read one category's records (saves route through the dbUtils helper that owns their v2 schema). */
async function readCategory(category: BackupCategory): Promise<IdRecord[]> {
  return category === 'saves'
    ? ((await getAllSaveRecords()) as unknown as IdRecord[])
    : readStore(STORE_TARGETS[category]);
}

/** One selectable line in the backup/restore checklist. */
export interface BackupItem {
  id: string;
  label: string;
}

/** List every store's items (id + display label) so the UI can offer per-item selection, grouped by category. */
export async function listBackupItems(): Promise<Record<BackupCategory, BackupItem[]>> {
  const out = { worlds: [], saves: [], entities: [], dictionaries: [] } as Record<BackupCategory, BackupItem[]>;
  await Promise.all(
    BACKUP_CATEGORIES.map(async (category) => {
      out[category] = (await readCategory(category)).map((r) => ({ id: r.id, label: itemLabel(r) }));
    }),
  );
  return out;
}

/** Per-category sets of the record ids to include. A missing or empty set means "none from that category". */
export type BackupSelection = Partial<Record<BackupCategory, Set<string>>>;

/** Read the selected records into one bundle stamped with the current app version and time. Each category
 *  keeps only the ids in its selection set; unselected categories come back as empty arrays. */
export async function buildBackup(selection: BackupSelection): Promise<BackupBundle> {
  const data: Record<BackupCategory, IdRecord[]> = { worlds: [], saves: [], entities: [], dictionaries: [] };
  await Promise.all(
    BACKUP_CATEGORIES.map(async (category) => {
      const ids = selection[category];
      if (!ids || ids.size === 0) return;
      data[category] = (await readCategory(category)).filter((r) => ids.has(r.id));
    }),
  );
  return {
    formamorphBackup: BACKUP_FORMAT,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/** Index a backup file for restore in the JSON file worker. Throws on a file that is not a backup. */
export const readBackupIndex = (file: Blob): Promise<BackupIndex> => indexBackupInWorker(file);

/** Per-category split of a backup against what's already stored: `fresh` ids are new, `conflicts` collide. */
export interface CategoryPlan {
  category: BackupCategory;
  fresh: BackupEntry[];
  conflicts: BackupEntry[];
}

/** Pure conflict split — separates incoming items into new vs. already-present by id. */
export function splitByConflict<T extends { id: string }>(
  incoming: T[],
  existingIds: Set<string>,
): { fresh: T[]; conflicts: T[] } {
  const fresh: T[] = [];
  const conflicts: T[] = [];
  for (const rec of incoming) (existingIds.has(rec.id) ? conflicts : fresh).push(rec);
  return { fresh, conflicts };
}

async function existingIdsFor(category: BackupCategory): Promise<Set<string>> {
  return new Set((await readCategory(category)).map((r) => r.id));
}

/** Compare a backup against current storage, yielding one plan per category (for the import summary). */
export async function analyzeBackup(index: BackupIndex): Promise<CategoryPlan[]> {
  return Promise.all(
    BACKUP_CATEGORIES.map(async (category) => ({
      category,
      ...splitByConflict(index.data[category], await existingIdsFor(category)),
    })),
  );
}

/** Write records for one category back into its store (saves route through the dbUtils helper). */
async function restoreCategory(category: BackupCategory, records: IdRecord[]): Promise<void> {
  if (category === 'saves') {
    for (const rec of records) await putSaveRecord(rec as unknown as SaveRecord);
    return;
  }
  await writeStore(STORE_TARGETS[category], records);
}

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
): Promise<Record<BackupCategory, { added: number; overwritten: number; skipped: number }>> {
  const result = {} as Record<BackupCategory, { added: number; overwritten: number; skipped: number }>;
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

/** The `.json` filename a backup saves under, dated from the bundle. */
function backupFilename(bundle: BackupBundle): string {
  return `formamorph-backup-${(bundle.exportedAt || new Date().toISOString()).slice(0, 10)}.json`;
}

/**
 * Save the backup to a file. A plain download rather than the File System Access save picker: that API's
 * write is blocked in embedded contexts (the itch app's HTML wrapper), where it both errored on overwrite
 * and, via the failed-write fallback, popped a second save dialog. A download is one dialog (or none) and
 * works everywhere.
 */
export async function saveBackup(bundle: BackupBundle): Promise<void> {
  // Off-thread: a bundle is every selected world and save, the largest payload the app ever serializes.
  // Depth 3 (bundle → data → category → record) writes each record as its own part.
  downloadBlob(await serializeJsonBlobSplit(bundle, 3), backupFilename(bundle));
}
