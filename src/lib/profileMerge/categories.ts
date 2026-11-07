/**
 * The merge categories for worlds, saves, entities and dictionaries: the folder's snapshot from its own
 * stores, the AppData snapshot and records through the desktop bridge, and the writes through the Backup &
 * Restore store targets.
 */
import type { SaveRecord } from '@/types';
import { getAllReadable } from '@/lib/idb';
import { libraryRevision } from '@/lib/linkedContent';
import { STORE_TARGETS } from '@/lib/backupRestore';
import { getAllSaveRecords, getOrder, getSaveRecord, putSaveRecord, setOrder } from '@/components/modals/dbUtils';
import { openWorldLibrary, readAllWorldMeta } from '@/lib/worldLibrary';
import type { IdRecord } from '@/lib/backupIndex';
import type { SaveMeta } from '@/lib/saveOrdering';
import type { MergeCategory, MergeItem } from './engine';
import type { ProfileMergeBridge, SourceSummary } from './bridge';
import { appendedSaveOrders, importedSave } from './saveOrder';
import { modelFolderCategory, settingsCategory } from './settings';
import { readRecord, sourceItems, textOr } from './sourceRead';
import { localStoreCategories } from './localCategories';
import { modelsCategory } from './modelsCategory';
import { MERGE_KEYS } from './keys';

type LibraryKey = typeof MERGE_KEYS.worlds | typeof MERGE_KEYS.entities | typeof MERGE_KEYS.dictionaries;

const LABELS: Record<LibraryKey | typeof MERGE_KEYS.saves, string> = {
  [MERGE_KEYS.worlds]: 'Worlds',
  [MERGE_KEYS.saves]: 'Saves',
  [MERGE_KEYS.entities]: 'Entities',
  [MERGE_KEYS.dictionaries]: 'Dictionaries',
};

interface Stamped {
  id: string;
  name?: unknown;
  editedAt?: string;
  downloadedAt?: string;
  createdAt?: string;
}

const libraryItem = (record: Stamped): MergeItem => ({
  id: record.id,
  label: textOr(record.name, record.id),
  stamp: libraryRevision(record) || undefined,
  size: 0,
});

const saveTimestamp = (record: SaveRecord): string | undefined => record.currentState?.timestamp || undefined;

const librarySummaryStamp = (summary: SourceSummary) => libraryRevision(summary) || undefined;

/** Open a database, run `task` on it, and close it whatever happens. */
async function withDb<T>(open: () => Promise<IDBDatabase>, task: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await open();
  try {
    return await task(db);
  } finally {
    db.close();
  }
}

const worldTargets = () => withDb(openWorldLibrary, async (db) => (await readAllWorldMeta(db)).meta.map(libraryItem));

const storeTargets = (key: Exclude<LibraryKey, typeof MERGE_KEYS.worlds>) => withDb(STORE_TARGETS[key].open, async (db) =>
  (await getAllReadable<Stamped>(db, STORE_TARGETS[key].store)).filter((r) => typeof r.id === 'string').map(libraryItem));

const writeLibrary = (key: LibraryKey, record: IdRecord) => withDb(STORE_TARGETS[key].open, (db) => STORE_TARGETS[key].write(db, [record]));

function libraryCategory(bridge: ProfileMergeBridge, key: LibraryKey): MergeCategory {
  return {
    key,
    label: LABELS[key],
    stamped: true,
    unit: 'items',
    target: () => (key === MERGE_KEYS.worlds ? worldTargets() : storeTargets(key)),
    source: () => sourceItems(bridge, key, librarySummaryStamp),
    copy: async (item) => writeLibrary(key, await readRecord(bridge, key, item.id)),
  };
}

const saveMeta = (record: SaveRecord): SaveMeta => ({
  id: record.id,
  name: record.name,
  worldId: record.worldId,
  worldName: record.currentState?.worldName ?? null,
  timestamp: record.currentState?.timestamp ? Date.parse(record.currentState.timestamp) : 0,
});

async function appendImportedSaves(added: MergeItem[]): Promise<void> {
  const saves = (await getAllSaveRecords()).map(saveMeta);
  const worlds = await withDb(openWorldLibrary, async (db) => (await readAllWorldMeta(db)).meta.map((meta) => ({ id: meta.id, name: meta.name })));
  const orders = await appendedSaveOrders(saves, worlds, added.map((item) => item.id), getOrder);
  for (const order of orders) await setOrder(order.key, order.ids);
}

function savesCategory(bridge: ProfileMergeBridge): MergeCategory {
  return {
    key: MERGE_KEYS.saves,
    label: LABELS.saves,
    stamped: true,
    unit: 'items',
    target: async () => (await getAllSaveRecords()).map((record) => ({
      id: record.id,
      label: textOr(record.name, record.id),
      stamp: saveTimestamp(record),
      size: 0,
    })),
    source: () => sourceItems(bridge, MERGE_KEYS.saves, (summary) => summary.timestamp),
    copy: async (item) => {
      // The AppData profile wrote this record as a SaveRecord; the read boundary migrates its shape on load.
      const record = (await readRecord(bridge, MERGE_KEYS.saves, item.id)) as unknown as SaveRecord;
      await putSaveRecord(importedSave(record, await getSaveRecord(item.id)));
    },
    finish: appendImportedSaves,
  };
}

/** The categories this build merges. */
export function mergeCategories(bridge: ProfileMergeBridge): MergeCategory[] {
  return [
    settingsCategory(bridge),
    modelFolderCategory(bridge),
    libraryCategory(bridge, MERGE_KEYS.dictionaries),
    libraryCategory(bridge, MERGE_KEYS.entities),
    libraryCategory(bridge, MERGE_KEYS.worlds),
    savesCategory(bridge),
    ...localStoreCategories(bridge),
    modelsCategory(bridge),
  ];
}
