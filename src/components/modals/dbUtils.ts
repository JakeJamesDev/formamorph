import { randomUUID } from "@/lib/uuid";
import { openDatabase, promisifyRequest } from '@/lib/idb';
import type { SaveRecord } from '@/types';

export const DB_NAME = 'FORMAMORPH_DB';
/** Pre-folders store, keyed by save `name`. Read once during migration, then cleared. */
export const LEGACY_STORE = 'saves';
/** Current save store, keyed by a stable `id` so identical names can coexist across/within worlds. */
export const STORE_NAME = 'saveRecords';
/** Device-local ordering (folder order + per-folder save order); never part of an exported save. */
export const ORDER_STORE = 'saveOrder';
export const DB_VERSION = 2;

/** Open at v2, creating any missing store. The v1 DB only had `saves`; the upgrade adds the id-keyed
 *  record store and the ordering store (existing `saves` rows are migrated in `migrateLegacySaves`). */
export const initDB = (): Promise<IDBDatabase> =>
  openDatabase(DB_NAME, DB_VERSION, [
    { name: LEGACY_STORE, keyPath: 'name' },
    { name: STORE_NAME, keyPath: 'id' },
    { name: ORDER_STORE, keyPath: 'key' },
  ]);

const store = async (name: string, mode: IDBTransactionMode) =>
  (await initDB()).transaction([name], mode).objectStore(name);

export const putSaveRecord = async (record: SaveRecord) => {
  await promisifyRequest((await store(STORE_NAME, 'readwrite')).put(record));
};

export const getSaveRecord = async (id: string) =>
  promisifyRequest((await store(STORE_NAME, 'readonly')).get(id)) as Promise<SaveRecord | undefined>;

export const getAllSaveRecords = async () =>
  promisifyRequest((await store(STORE_NAME, 'readonly')).getAll()) as Promise<SaveRecord[]>;

export const deleteSaveRecord = async (id: string) => {
  await promisifyRequest((await store(STORE_NAME, 'readwrite')).delete(id));
};

/**
 * One-time migration of any pre-folders `saves` rows into the id-keyed store: mint a stable `id`, and
 * best-effort stamp `worldId` by matching the save's `worldName` against installed worlds (`nameToId`).
 * Unmatched saves keep no `worldId` and group by name. Idempotent — the legacy store is cleared after a
 * successful copy, so a second call is a no-op.
 */
export const migrateLegacySaves = async (
  nameToId: (worldName: string | null | undefined) => string | undefined,
): Promise<void> => {
  const legacy = (await promisifyRequest(
    (await store(LEGACY_STORE, 'readonly')).getAll(),
  )) as Array<Record<string, unknown>>;
  if (!legacy.length) return;

  const rw = await store(STORE_NAME, 'readwrite');
  for (const old of legacy) {
    const currentState = old.currentState as { worldName?: string | null } | undefined;
    const worldName = currentState?.worldName ?? (old.worldName as string | null | undefined) ?? null;
    const record = {
      ...old,
      id: (old.id as string | undefined) ?? randomUUID(),
      name: old.name as string,
      worldId: (old.worldId as string | undefined) ?? nameToId(worldName),
    } as unknown as SaveRecord;
    await promisifyRequest(rw.put(record));
  }
  await promisifyRequest((await store(LEGACY_STORE, 'readwrite')).clear());
};

// --- Ordering store (device-local) ---------------------------------------------------------------

interface OrderRow {
  key: string;
  ids: string[];
}

/** Read a stored order list by key (`__folders__` for folder order, or a worldId/name for a folder's
 *  saves). Returns `[]` when unset. */
export const getOrder = async (key: string): Promise<string[]> => {
  const row = (await promisifyRequest(
    (await store(ORDER_STORE, 'readonly')).get(key),
  )) as OrderRow | undefined;
  return row?.ids ?? [];
};

export const setOrder = async (key: string, ids: string[]) => {
  await promisifyRequest((await store(ORDER_STORE, 'readwrite')).put({ key, ids }));
};
