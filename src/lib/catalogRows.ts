import type { WorldRecord } from '@/components/WorldDetails';
import { listingId } from '@/lib/worldDependencies';

/** Whether two JSON values hold the same data, in any key order. */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameJson(item, b[index]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && sameJson(left[key], right[key]));
}

/**
 * The fresh rows, with each row that matches its held copy swapped for that copy.
 *
 * A kept object lets a memoized card skip its render. When every row is kept in the same order, the held
 * list itself comes back, so nothing downstream sees a change.
 */
export function reuseRows(held: WorldRecord[], fresh: WorldRecord[]): WorldRecord[] {
  if (held.length === 0) return fresh;
  const byId = new Map(held.map((row) => [listingId(row), row]));
  let allKept = held.length === fresh.length;
  const rows = fresh.map((row, index) => {
    const prior = byId.get(listingId(row));
    const kept = prior && sameJson(prior, row) ? prior : row;
    if (kept !== held[index]) allKept = false;
    return kept;
  });
  return allKept ? held : rows;
}
