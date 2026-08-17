/**
 * The one shape every piece of Bench-local browser storage shares: a JSON value under a fixed key, usually a
 * record keyed by world id. Reads are parse-guarded — absent, corrupt, or blocked storage all read as nothing —
 * and writes swallow failure, since losing a convenience record costs a re-seed and never data.
 *
 * Consumers sanitize what they read: this module guarantees the record shape, not the entries' fields, so a
 * hand-edited entry is each store's own problem to reject.
 */

/** Which browser storage backs a store — its lifetime is the whole difference. */
export type StorageKind = 'local' | 'session';

const backing = (kind: StorageKind): Storage => (kind === 'local' ? localStorage : sessionStorage);

/** The whole JSON value under `key`, or `undefined` when it is absent, corrupt, or storage is blocked. */
export function readStorageJson(kind: StorageKind, key: string): unknown {
  try {
    const raw = backing(kind).getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}

/** Write `value` as JSON under `key`. A full or blocked storage costs the record a re-seed, nothing else. */
export function writeStorageJson(kind: StorageKind, key: string, value: unknown): void {
  try {
    backing(kind).setItem(key, JSON.stringify(value));
  } catch {
    // Swallowed by design: every store on this helper holds convenience state, never data.
  }
}

/** One stored record of per-id entries. `read` hands back whatever is stored — the store narrows it. */
export interface KeyedRecordStore {
  read(id: string): unknown;
  write(id: string, value: unknown): void;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** A store of one keyed record under `key` — per-id reads, and writes that merge over the other ids. */
export function createKeyedRecordStore(kind: StorageKind, key: string): KeyedRecordStore {
  const readAll = () => asRecord(readStorageJson(kind, key));
  return {
    read: (id) => readAll()[id],
    write: (id, value) => writeStorageJson(kind, key, { ...readAll(), [id]: value }),
  };
}
