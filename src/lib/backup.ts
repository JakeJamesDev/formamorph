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
import { indexBackupInWorker, restoreBackupInWorker, serializeJsonBlobSplit } from '@/lib/jsonFileWorkerUtils';
import { getAllSaveRecords } from '@/components/modals/dbUtils';
import { APP_VERSION } from '@/lib/version';
import {
  BACKUP_CATEGORIES,
  itemLabel,
  itemBreadcrumb,
  type BackupCategory,
  type BackupEntry,
  type BackupIndex,
  type IdRecord,
} from '@/lib/backupIndex';
import { STORE_TARGETS, applyBackup, optimizes, type CategoryPlan, type RestoreCounts, type RestoreRequest } from '@/lib/backupRestore';

/** Bumped only if the bundle's shape changes incompatibly; readers warn on a newer value but still try. */
export const BACKUP_FORMAT = 1;

// Re-exported so importers keep one `@/lib/backup` path; the worker-safe parts live in `backupIndex`
// and `backupRestore`.
export { BACKUP_CATEGORIES, itemLabel, applyBackup, optimizes };
export type { BackupCategory, BackupEntry, BackupIndex, IdRecord, CategoryPlan, RestoreCounts, RestoreRequest };

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
  breadcrumb?: string[];
}

/** List every store's items (id + display label) so the UI can offer per-item selection, grouped by category. */
export async function listBackupItems(): Promise<Record<BackupCategory, BackupItem[]>> {
  const out = { worlds: [], saves: [], entities: [], dictionaries: [] } as Record<BackupCategory, BackupItem[]>;
  await Promise.all(
    BACKUP_CATEGORIES.map(async (category) => {
      out[category] = (await readCategory(category)).map((r) => ({
        id: r.id,
        label: itemLabel(r),
        breadcrumb: itemBreadcrumb(category, r),
      }));
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

/** Restore the ticked records in the JSON file worker. `onProgress(done)` counts optimized images. */
export const restoreBackup = (request: RestoreRequest, onProgress?: (done: number) => void): Promise<RestoreCounts> =>
  restoreBackupInWorker(request, onProgress);

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
