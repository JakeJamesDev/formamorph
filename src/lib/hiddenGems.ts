import { isPinned, type PinnableListing } from '@/lib/pinning';

/** A catalog listing as the browser holds it. `hidden_gem` is set on the server's current picks. */
export interface HiddenGemListing extends PinnableListing {
  hidden_gem?: unknown;
}

/** Whether the catalog flags a listing as a Hidden Gem. A missing flag means no. */
export const isHiddenGem = (listing: HiddenGemListing): boolean => listing.hidden_gem === true;

/** Zero-based offsets of the gem slots after the pinned head: slots 3, 6 and 9 of page 1. */
const GEM_SLOT_OFFSETS = [2, 5, 8];

/**
 * Moves the flagged rows of a sorted list into the gem slots of page 1, in sorted order.
 *
 * Slots count from the first row after the leading pinned rows. A slot past the page or the list leaves
 * its gem in its sorted place, so the list keeps every row once and its length.
 */
export function placeHiddenGems<T extends HiddenGemListing>(sorted: T[], pageSize: number): { rows: T[]; placed: T[] } {
  let pinnedHead = 0;
  while (pinnedHead < sorted.length && isPinned(sorted[pinnedHead])) pinnedHead++;

  const gems = sorted.filter((row) => isHiddenGem(row) && !isPinned(row));
  const slots = GEM_SLOT_OFFSETS.map((offset) => pinnedHead + offset);
  const placed = gems.slice(0, slots.length).filter((_, i) => slots[i] < pageSize && slots[i] < sorted.length);
  if (!placed.length) return { rows: sorted, placed };

  const moved = new Set<T>(placed);
  const rows = sorted.filter((row) => !moved.has(row));
  placed.forEach((gem, i) => rows.splice(slots[i], 0, gem));
  return { rows, placed };
}
