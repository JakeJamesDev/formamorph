/**
 * Reordering a list of which only some rows were on screen.
 *
 * The whole list after a reorder of only the rows the author could see. `next` is what `onReorder` hands
 * back — the rendered items in their new order — and each is dealt into a slot the rendered set already
 * occupied, so an item a filter left out keeps its exact place. A filtered list is written back whole, so
 * without this the rows hidden at the time of the drag are simply gone. `prev` comes back untouched if the
 * list changed under the drag, and an unfiltered list comes back as `next` itself.
 */
export function reorderVisible<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const moved = new Set(next.map((it) => it.id));
  const slots = prev.flatMap((it, i) => (moved.has(it.id) ? [i] : []));
  if (slots.length !== next.length) return prev;
  const out = [...prev];
  slots.forEach((slot, i) => { out[slot] = next[i]; });
  return out;
}
