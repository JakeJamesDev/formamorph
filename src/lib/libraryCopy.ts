import { copyWithFreshRolls } from '@/lib/duplicateAfter';
import type { StoredRecord } from '@/services/LibraryStore';
import type { LibraryDetails } from '@/types';

/** A library item's duplicate record: fresh id and rolls, " (Copy)" name, the same details, and no community link. */
export function libraryCopy<T extends { id: string; name: string }>(
  data: T,
  libraryDetails?: LibraryDetails,
): StoredRecord<T> {
  const copy = copyWithFreshRolls(data);
  return { id: copy.id, name: copy.name, data: copy, ...(libraryDetails ? { libraryDetails: structuredClone(libraryDetails) } : {}) };
}
