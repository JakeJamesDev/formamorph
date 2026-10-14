import { remintPlaceholdersDeep } from '@/lib/placeholders';
import { randomUUID } from '@/lib/uuid';

/** Inserts `clone(source)` right after the item with `id`. Returns the list unchanged and a null copy when the id is missing. */
export function duplicateAfter<T extends { id: string }>(
  list: readonly T[],
  id: string,
  clone: (source: T) => T,
): { list: T[]; copy: T | null } {
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) return { list: list.slice(), copy: null };
  const copy = clone(list[index]);
  return { list: [...list.slice(0, index + 1), copy, ...list.slice(index + 1)], copy };
}

/** A named world item's duplicate: new id, " (Copy)" name, and fresh Unique-chip rolls in every string. */
export function copyWithFreshRolls<T extends { id: string; name: string }>(source: T): T {
  const copy = remintPlaceholdersDeep(structuredClone(source));
  return { ...copy, id: randomUUID(), name: `${copy.name} (Copy)` };
}
