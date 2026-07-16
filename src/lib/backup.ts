/**
 * Full-library backup bundle: export every world, save, library character (entity), and library
 * dictionary into one self-contained `.json`, and restore it later. Images are already base64-embedded
 * in these records, so the bundle is offline-safe and portable across origins — the fix for itch/web
 * users whose origin-scoped IndexedDB is orphaned when a hosted build updates.
 *
 * Settings, downloaded models, and caches are intentionally excluded: they're either device-local or
 * re-derivable, not irreplaceable authored content.
 */
import { openDatabase, promisifyRequest } from '@/lib/idb';
import { getAllSaveRecords, putSaveRecord } from '@/components/modals/dbUtils';
import { APP_VERSION } from '@/lib/version';
import type { SaveRecord } from '@/types';

/** Bumped only if the bundle's shape changes incompatibly; readers warn on a newer value but still try. */
export const BACKUP_FORMAT = 1;

/** The category keys, in a stable display order. */
export const BACKUP_CATEGORIES = ['worlds', 'saves', 'entities', 'dictionaries'] as const;
export type BackupCategory = (typeof BACKUP_CATEGORIES)[number];

/** Any stored record carrying a string `id` primary key (all four stores use `keyPath: 'id'`). */
interface IdRecord {
  id: string;
  [key: string]: unknown;
}

export interface BackupBundle {
  formamorphBackup: number;
  appVersion: string;
  exportedAt: string;
  data: Record<BackupCategory, IdRecord[]>;
}

export const CATEGORY_LABELS: Record<BackupCategory, string> = {
  worlds: 'Worlds',
  saves: 'Saves',
  entities: 'Characters',
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

/** A human label for a stored record — its `name`, falling back to the raw id. */
export function itemLabel(record: IdRecord): string {
  return typeof record.name === 'string' && record.name ? record.name : record.id;
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

/** Validate and parse bundle text, normalizing missing category arrays to `[]`. Throws on a non-bundle. */
export function parseBackup(text: string): BackupBundle {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Not a valid JSON file.');
  }
  const obj = raw as Partial<BackupBundle> & { data?: Partial<Record<BackupCategory, unknown>> };
  if (!obj || typeof obj.formamorphBackup !== 'number' || !obj.data) {
    throw new Error('This file is not a Formamorph backup.');
  }
  const data = {} as Record<BackupCategory, IdRecord[]>;
  for (const cat of BACKUP_CATEGORIES) {
    const arr = obj.data[cat];
    data[cat] = Array.isArray(arr) ? (arr as IdRecord[]).filter((r) => r && typeof r.id === 'string') : [];
  }
  return {
    formamorphBackup: obj.formamorphBackup,
    appVersion: typeof obj.appVersion === 'string' ? obj.appVersion : 'unknown',
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
    data,
  };
}

/** Per-category split of a bundle against what's already stored: `fresh` ids are new, `conflicts` collide. */
export interface CategoryPlan {
  category: BackupCategory;
  fresh: IdRecord[];
  conflicts: IdRecord[];
}

/** Pure conflict split — separates incoming records into new vs. already-present by id. */
export function splitByConflict(incoming: IdRecord[], existingIds: Set<string>): Omit<CategoryPlan, 'category'> {
  const fresh: IdRecord[] = [];
  const conflicts: IdRecord[] = [];
  for (const rec of incoming) (existingIds.has(rec.id) ? conflicts : fresh).push(rec);
  return { fresh, conflicts };
}

async function existingIdsFor(category: BackupCategory): Promise<Set<string>> {
  return new Set((await readCategory(category)).map((r) => r.id));
}

/** Compare a bundle against current storage, yielding one plan per category (for the import summary). */
export async function analyzeBackup(bundle: BackupBundle): Promise<CategoryPlan[]> {
  return Promise.all(
    BACKUP_CATEGORIES.map(async (category) => ({
      category,
      ...splitByConflict(bundle.data[category], await existingIdsFor(category)),
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
 * overwrite. Returns per-category counts of what was written vs. skipped.
 */
export async function applyBackup(
  plans: CategoryPlan[],
  overwrite: Record<BackupCategory, boolean>,
): Promise<Record<BackupCategory, { added: number; overwritten: number; skipped: number }>> {
  const result = {} as Record<BackupCategory, { added: number; overwritten: number; skipped: number }>;
  for (const plan of plans) {
    const conflictsToWrite = overwrite[plan.category] ? plan.conflicts : [];
    await restoreCategory(plan.category, [...plan.fresh, ...conflictsToWrite]);
    result[plan.category] = {
      added: plan.fresh.length,
      overwritten: conflictsToWrite.length,
      skipped: overwrite[plan.category] ? 0 : plan.conflicts.length,
    };
  }
  return result;
}

/** The `.json` filename a backup downloads/saves under, dated from the bundle. */
function backupFilename(bundle: BackupBundle): string {
  return `formamorph-backup-${(bundle.exportedAt || new Date().toISOString()).slice(0, 10)}.json`;
}

/** Serialize + trigger a download of the bundle to the browser's default download location. */
export function downloadBackup(bundle: BackupBundle): void {
  const blob = new Blob([JSON.stringify(bundle)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFilename(bundle);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Save the backup to a file. Uses a plain download rather than the File System Access save picker: that
 * API's write is blocked in embedded contexts (the itch app's HTML wrapper), where it both errored on
 * overwrite and, via the failed-write fallback, popped a second save dialog. A download is one dialog (or
 * none) and works everywhere.
 */
export async function saveBackup(bundle: BackupBundle): Promise<'saved'> {
  downloadBackup(bundle);
  return 'saved';
}
