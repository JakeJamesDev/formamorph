// Pure layout for the turn pager. The visible page numbers change as you flip (first, last, a window
// around the current page, with ellipses for the gaps), so the strip's item count — and therefore its
// width — varied, which reflowed the Previous/Next buttons. This reserves a constant number of slots
// (`min(totalPages, 7)`, the most the window ever needs) and pads the remainder, so the strip is always
// its widest and the buttons never move. Kept React-free so the slot math is unit-testable.

/** One cell of the pager: a real page, an ellipsis gap, or an invisible spacer that holds the width. */
export type PageSlot =
  | { kind: 'page'; page: number }
  | { kind: 'ellipsis' }
  | { kind: 'pad'; id: number };

/** The most slots the window can ever occupy: page 1, the last page, the ±1 window around current, and
 *  the two ellipsis gaps — capped by how many pages actually exist. */
export function maxPaginationSlots(totalPages: number): number {
  return Math.max(0, Math.min(totalPages, 7));
}

/**
 * The `size` page numbers closest to `currentPage`, clamped to the ends — no ellipsis, no first/last
 * anchors, no padding. A centered window (`current ±1` for size 3) that slides but never runs past 1 or
 * `totalPages`, and shrinks when there aren't `size` pages. Used by the compact mobile pager.
 */
export function pageWindow(currentPage: number, totalPages: number, size = 3): number[] {
  if (totalPages <= 0) return [];
  const count = Math.min(size, totalPages);
  const start = Math.max(1, Math.min(currentPage - Math.floor(size / 2), totalPages - count + 1));
  return Array.from({ length: count }, (_, i) => start + i);
}

/**
 * Build the pager cells for `currentPage`, padded to a constant length so Previous/Next stay put.
 *
 * Layout: low pages hug the left, high pages anchor to the right, and a lone (near-edge) ellipsis sits
 * centered — the padding spacers fill the gaps around it rather than bunching at one end. The deep-middle
 * case (two ellipses) already spans the full width, so it's returned as-is.
 */
export function paginationSlots(currentPage: number, totalPages: number): PageSlot[] {
  const content: PageSlot[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      content.push({ kind: 'page', page: i });
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      content.push({ kind: 'ellipsis' });
    }
  }

  const target = maxPaginationSlots(totalPages);
  if (content.length >= target) return content; // full-width (0 or 2 ellipses): nothing to distribute

  const ellipsisIdx = content.findIndex((s) => s.kind === 'ellipsis');
  if (ellipsisIdx === -1) {
    // No ellipsis but short (shouldn't happen) — pad the tail as a safe fallback.
    const out = [...content];
    while (out.length < target) out.push({ kind: 'pad', id: out.length });
    return out;
  }

  // Single ellipsis: place low pages at the left, high pages at the right, the ellipsis centered, and let
  // the remaining slots be spacers.
  const low = content.slice(0, ellipsisIdx);
  const high = content.slice(ellipsisIdx + 1);
  const slots: PageSlot[] = Array.from({ length: target }, (_, i): PageSlot => ({ kind: 'pad', id: i }));
  low.forEach((s, i) => (slots[i] = s));
  high.forEach((s, i) => (slots[target - high.length + i] = s));
  // Center the ellipsis within the gap between the two groups (not the whole strip).
  const gapStart = low.length;
  const gapEnd = target - high.length - 1;
  slots[Math.floor((gapStart + gapEnd) / 2)] = { kind: 'ellipsis' };
  return slots;
}
