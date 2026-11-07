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
import { MergeHalt, reasonOf, type MergeCategory, type MergeItem } from './engine';
import type { ProfileMergeBridge, SourceSummary } from './bridge';
import { appendedSaveOrders, importedSave } from './saveOrder';
import { modelFolderCategory, settingsCategory } from './settings';

type LibraryKey = 'worlds' | 'entities' | 'dictionaries';

const LABELS: Record<LibraryKey | 'saves', string> = {
  worlds: 'Worlds',
  saves: 'Saves',
  entities: 'Entities',
  dictionaries: 'Dictionaries',
};

interface Stamped {
  id: string;
  name?: unknown;
  editedAt?: string;
  downloadedAt?: string;
  createdAt?: string;
}

const textOr = (value: unknown, fallback: string) => (typeof value === 'string' && value ? value : fallback);

const libraryItem = (record: Stamped): MergeItem => ({
  id: record.id,
  label: textOr(record.name, record.id),
  stamp: libraryRevision(record) || undefined,
  size: 0,
});

const saveTimestamp = (record: SaveRecord): string | undefined => record.currentState?.timestamp || undefined;

const sourceItems = async (bridge: ProfileMergeBridge, key: string, stampOf: (s: SourceSummary) => string | undefined) =>
  ((await bridge.summaries([key]))[key] ?? []).map((summary): MergeItem => ({
    id: summary.id,
    label: textOr(summary.name, summary.id),
    stamp: stampOf(summary),
    size: summary.size,
  }));

const librarySummaryStamp = (summary: SourceSummary) => libraryRevision(summary) || undefined;

async function readRecord(bridge: ProfileMergeBridge, key: string, id: string): Promise<IdRecord> {
  let record: unknown;
  try {
    record = await bridge.record(key, id);
  } catch (err) {
    throw new MergeHalt(`The other copy stopped answering (${reasonOf(err)})`);
  }
  if (!record || typeof record !== 'object' || (record as { id?: unknown }).id !== id) {
    throw new Error('The other copy no longer holds it.');
  }
  return record as IdRecord;
}

async function worldTargets(): Promise<MergeItem[]> {
  const db = await openWorldLibrary();
  try {
    return (await readAllWorldMeta(db)).meta.map(libraryItem);
  } finally {
    db.close();
  }
}

async function storeTargets(key: Exclude<LibraryKey, 'worlds'>): Promise<MergeItem[]> {
  const target = STORE_TARGETS[key];
  const db = await target.open();
  try {
    return (await getAllReadable<Stamped>(db, target.store)).filter((r) => typeof r.id === 'string').map(libraryItem);
  } finally {
    db.close();
  }
}

async function writeLibrary(key: LibraryKey, record: IdRecord): Promise<void> {
  const target = STORE_TARGETS[key];
  const db = await target.open();
  try {
    await target.write(db, [record]);
  } finally {
    db.close();
  }
}

function libraryCategory(bridge: ProfileMergeBridge, key: LibraryKey): MergeCategory {
  return {
    key,
    label: LABELS[key],
    stamped: true,
    unit: 'items',
    target: () => (key === 'worlds' ? worldTargets() : storeTargets(key)),
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
  const db = await openWorldLibrary();
  let worlds;
  try {
    worlds = (await readAllWorldMeta(db)).meta.map((meta) => ({ id: meta.id, name: meta.name }));
  } finally {
    db.close();
  }
  const orders = await appendedSaveOrders(saves, worlds, added.map((item) => item.id), getOrder);
  for (const order of orders) await setOrder(order.key, order.ids);
}

function savesCategory(bridge: ProfileMergeBridge): MergeCategory {
  return {
    key: 'saves',
    label: LABELS.saves,
    stamped: true,
    unit: 'items',
    target: async () => (await getAllSaveRecords()).map((record) => ({
      id: record.id,
      label: textOr(record.name, record.id),
      stamp: saveTimestamp(record),
      size: 0,
    })),
    source: () => sourceItems(bridge, 'saves', (summary) => summary.timestamp),
    copy: async (item) => {
      // The AppData profile wrote this record as a SaveRecord; the read boundary migrates its shape on load.
      const record = (await readRecord(bridge, 'saves', item.id)) as unknown as SaveRecord;
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
    libraryCategory(bridge, 'dictionaries'),
    libraryCategory(bridge, 'entities'),
    libraryCategory(bridge, 'worlds'),
    savesCategory(bridge),
  ];
}
