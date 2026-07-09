/**
 * Pure helpers for the save-folder UI: grouping saves into per-world folders and applying the
 * device-local manual order. Kept free of IndexedDB/React so they're unit-testable; the modal supplies
 * the raw records + stored order and renders the result.
 */

/** Minimal shape the ordering/grouping needs from a stored save. */
export interface SaveMeta {
  id: string;
  name: string;
  worldId?: string;
  worldName: string | null;
  /** Epoch millis of the save's snapshot; used for the newest-first default and a folder's "last played". */
  timestamp: number;
}

/** An installed world, for unifying name-only (legacy) saves with their world's stable id. */
export interface WorldRef {
  id: string;
  name: string;
}

export interface SaveFolder {
  /** Stable grouping key: the worldId when known, else `name:<worldName>` for orphaned name-only saves. */
  key: string;
  worldId?: string;
  worldName: string;
  saves: SaveMeta[];
  /** Newest save timestamp in the folder (0 when empty) — drives the default folder order + the label. */
  lastPlayed: number;
}

/** Reserved order-store key holding the folder (world) order. */
export const FOLDER_ORDER_KEY = '__folders__';

/**
 * Merge a stored explicit order with the live set: stored ids that still exist keep their order, and any
 * new/unlisted ids are prepended newest-first. So a freshly created save/folder lands on top even after a
 * manual reorder, and a manual order otherwise wins.
 */
export function mergeOrder<T>(
  items: T[],
  idOf: (t: T) => string,
  timeOf: (t: T) => number,
  storedOrder: string[],
): T[] {
  const byId = new Map(items.map((i) => [idOf(i), i] as const));
  const ordered: T[] = [];
  for (const id of storedOrder) {
    const it = byId.get(id);
    if (it) {
      ordered.push(it);
      byId.delete(id);
    }
  }
  const unlisted = [...byId.values()].sort((a, b) => timeOf(b) - timeOf(a));
  return [...unlisted, ...ordered];
}

/** Resolve which folder a save belongs to, unifying legacy name-only saves with an installed world's id. */
export function folderRefFor(
  save: SaveMeta,
  nameToId: Map<string, string>,
  idToName: Map<string, string>,
): { key: string; worldId?: string; worldName: string } {
  if (save.worldId) {
    return {
      key: save.worldId,
      worldId: save.worldId,
      worldName: idToName.get(save.worldId) ?? save.worldName ?? 'Unknown world',
    };
  }
  const wn = save.worldName ?? '';
  const wid = nameToId.get(wn);
  if (wid) return { key: wid, worldId: wid, worldName: wn || idToName.get(wid) || 'Unknown world' };
  return { key: `name:${wn}`, worldName: wn || 'Unknown world' };
}

/**
 * Group saves into per-world folders. When `current` is given (in-game), that world always gets a folder
 * even with no saves; every other world that has at least one save gets one too. When `current` is omitted
 * (main menu — no world loaded), only worlds that actually have saves get folders. Saves within a folder
 * are newest-first here — the caller applies any manual save order via {@link mergeOrder}.
 */
export function groupSaves(
  saves: SaveMeta[],
  worlds: WorldRef[],
  current?: { id: string; name: string },
): SaveFolder[] {
  const nameToId = new Map(worlds.map((w) => [w.name, w.id] as const));
  const idToName = new Map(worlds.map((w) => [w.id, w.name] as const));
  // Ensure the current world resolves even if it isn't in `worlds` yet.
  if (current) {
    if (!idToName.has(current.id)) idToName.set(current.id, current.name);
    if (!nameToId.has(current.name)) nameToId.set(current.name, current.id);
  }

  const folders = new Map<string, SaveFolder>();
  const ensure = (key: string, worldId: string | undefined, worldName: string): SaveFolder => {
    let f = folders.get(key);
    if (!f) {
      f = { key, worldId, worldName, saves: [], lastPlayed: 0 };
      folders.set(key, f);
    }
    return f;
  };

  // In-game, the current world's folder always exists and always uses its id as the key.
  if (current) ensure(current.id, current.id, current.name);

  for (const save of saves) {
    const ref = folderRefFor(save, nameToId, idToName);
    const f = ensure(ref.key, ref.worldId, ref.worldName);
    f.saves.push(save);
    if (save.timestamp > f.lastPlayed) f.lastPlayed = save.timestamp;
  }

  for (const f of folders.values()) f.saves.sort((a, b) => b.timestamp - a.timestamp);
  return [...folders.values()];
}
