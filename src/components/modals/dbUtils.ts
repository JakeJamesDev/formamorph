import { randomUUID } from "@/lib/uuid";
import { cachedConnection, getAllReadable, promisifyRequest, transactionDone } from '@/lib/idb';
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
 *  record store and the ordering store (existing `saves` rows are migrated in `migrateLegacySaves`).
 *  The connection is cached — autosave issues several ops per turn, and a fresh connection each time
 *  leaks handles that would block a future `DB_VERSION` bump. */
export const initDB = cachedConnection(DB_NAME, DB_VERSION, [
  { name: LEGACY_STORE, keyPath: 'name' },
  { name: STORE_NAME, keyPath: 'id' },
  { name: ORDER_STORE, keyPath: 'key' },
]);

const store = async (name: string, mode: IDBTransactionMode) =>
  (await initDB()).transaction([name], mode).objectStore(name);

/** Resolves at commit: a full disk aborts the transaction after the put request succeeded. */
export const putSaveRecord = async (record: SaveRecord) => {
  const transaction = (await initDB()).transaction([STORE_NAME], 'readwrite');
  transaction.objectStore(STORE_NAME).put(record);
  await transactionDone(transaction);
};

export const getSaveRecord = async (id: string) =>
  promisifyRequest((await store(STORE_NAME, 'readonly')).get(id)) as Promise<SaveRecord | undefined>;

/** Keys of unreadable rows already warned about this session. */
const warnedUnreadable = new Set<IDBValidKey>();

/** Every save the browser can read. An unreadable row is skipped and left in place, since the stored bytes
 *  may still be recoverable. */
export const getAllSaveRecords = async (): Promise<SaveRecord[]> => {
  const readable = await getAllReadable<SaveRecord>(await initDB(), STORE_NAME);
  void warnUnreadable(readable);
  return readable;
};

/** Warns once per key for each stored row the read left out. */
async function warnUnreadable(readable: SaveRecord[]): Promise<void> {
  const keys = await promisifyRequest((await store(STORE_NAME, 'readonly')).getAllKeys());
  const ids = new Set<IDBValidKey>(readable.map((record) => record.id));
  for (const key of keys) {
    if (ids.has(key) || warnedUnreadable.has(key)) continue;
    warnedUnreadable.add(key);
    console.warn(`Skipped an unreadable save record (id ${String(key)})`);
  }
}

export const deleteSaveRecord = async (id: string) => {
  await promisifyRequest((await store(STORE_NAME, 'readwrite')).delete(id));
};

/**
 * One-time migration of any pre-folders `saves` rows into the id-keyed store: mint a stable `id`, and
 * best-effort stamp `worldId` by matching the save's `worldName` against installed worlds (`nameToId`).
 * Unmatched saves keep no `worldId` and group by name. Idempotent — each copied row leaves the legacy store
 * after a successful copy, so a second call is a no-op. An unreadable row stays there.
 */
export const migrateLegacySaves = async (
  nameToId: (worldName: string | null | undefined) => string | undefined,
): Promise<void> => {
  const legacy = await getAllReadable<Record<string, unknown>>(await initDB(), LEGACY_STORE);
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
  const copied = await store(LEGACY_STORE, 'readwrite');
  for (const old of legacy) copied.delete(old.name as string);
  await transactionDone(copied.transaction);
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
