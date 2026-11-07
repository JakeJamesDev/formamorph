import type { SaveRecord } from '@/types';
import { groupSaves, mergeOrder, type SaveMeta, type WorldRef } from '@/lib/saveOrdering';

/**
 * The record to store for an AppData save. A new save lands as an ordinary save, outside the folder's
 * autosave pool; a replaced save keeps the folder copy's autosave flag.
 */
export function importedSave(record: SaveRecord, held: SaveRecord | null | undefined): SaveRecord {
  const { isAutosave: _theirs, ...rest } = record;
  return held?.isAutosave ? { ...rest, isAutosave: true } : rest;
}

/** One folder's new stored save order. */
export interface FolderOrder {
  key: string;
  ids: string[];
}

/**
 * The save orders that put imported saves after each folder's existing saves. Existing saves keep the order
 * the save list shows them in: the stored order, else newest first.
 *
 * @param saves - Every stored save, imported ones included
 * @param imported - Ids of the imported saves, in copy order
 * @param storedOrder - A folder's stored order by its key; `[]` when unset
 */
export async function appendedSaveOrders(
  saves: SaveMeta[],
  worlds: WorldRef[],
  imported: string[],
  storedOrder: (key: string) => Promise<string[]>,
): Promise<FolderOrder[]> {
  const importedIds = new Set(imported);
  const rank = new Map(imported.map((id, index) => [id, index] as const));
  const orders: FolderOrder[] = [];
  for (const folder of groupSaves(saves, worlds)) {
    if (!folder.saves.some((save) => importedIds.has(save.id))) continue;
    const existing = folder.saves.filter((save) => !importedIds.has(save.id));
    const shown = mergeOrder(existing, (s) => s.id, (s) => s.timestamp, await storedOrder(folder.key));
    const added = folder.saves
      .filter((save) => importedIds.has(save.id))
      .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    orders.push({ key: folder.key, ids: [...shown, ...added].map((save) => save.id) });
  }
  return orders;
}
