/**
 * Pure helpers for the save-folder UI: grouping saves into per-world folders and applying the
 * device-local manual order. Kept free of IndexedDB/React so they're unit-testable; the modal supplies
 * the raw records + stored order and renders the result.
 */
import { reorderVisible } from './sortableOrder';

export const formatSaveTimestamp = (ms: number) => (ms ? new Date(ms).toLocaleString() : '');

/** Preserve saves excluded from a filtered list while reordering the rows that remain visible. */
export const mergeVisibleSaveOrder = <T extends { id: string }>(allRows: T[], visibleRows: T[]) => (
  reorderVisible(allRows, visibleRows)
);

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

/** Installed world names that belong to exactly one world, mapped to its id. A shared name maps to nothing. */
export function uniqueNameToId(worlds: WorldRef[]): Map<string, string> {
  const map = new Map<string, string>();
  const shared = new Set<string>();
  for (const w of worlds) {
    if (map.has(w.name)) shared.add(w.name);
    else map.set(w.name, w.id);
  }
  for (const name of shared) map.delete(name);
  return map;
}

/** The installed world a save belongs to: its own `worldId` when installed, else the one world with its
 *  `worldName`. An imported or downloaded world gets a fresh id, so a save moved between devices needs the name. */
export function resolveWorldId(
  save: { worldId?: string; worldName: string | null },
  nameToId: Map<string, string>,
  idToName: Map<string, string>,
): string | undefined {
  if (save.worldId && idToName.has(save.worldId)) return save.worldId;
  return nameToId.get(save.worldName ?? '');
}

/** Resolve which folder a save belongs to, unifying legacy name-only saves with an installed world's id. */
export function folderRefFor(
  save: SaveMeta,
  nameToId: Map<string, string>,
  idToName: Map<string, string>,
): { key: string; worldId?: string; worldName: string } {
  const wn = save.worldName ?? '';
  const wid = resolveWorldId(save, nameToId, idToName);
  if (wid) return { key: wid, worldId: wid, worldName: idToName.get(wid) || wn || 'Unknown world' };
  if (save.worldId) return { key: save.worldId, worldId: save.worldId, worldName: wn || 'Unknown world' };
  return { key: `name:${wn}`, worldName: wn || 'Unknown world' };
}

/** Saves whose `worldId` names no installed world but whose world name does, rebound to that world. */
export function rebindOrphanedSaves<T extends { worldId?: string; currentState?: { worldName?: string | null } }>(
  records: T[],
  worlds: WorldRef[],
): T[] {
  const nameToId = uniqueNameToId(worlds);
  const idToName = new Map(worlds.map((w) => [w.id, w.name] as const));
  return records.flatMap((r) => {
    if (!r.worldId || idToName.has(r.worldId)) return [];
    const wid = resolveWorldId({ worldId: r.worldId, worldName: r.currentState?.worldName ?? null }, nameToId, idToName);
    return wid ? [{ ...r, worldId: wid }] : [];
  });
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
  const nameToId = uniqueNameToId(worlds);
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
