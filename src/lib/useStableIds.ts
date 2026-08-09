import { useRef } from 'react';

/**
 * Give each item in a list an id that travels with the item as the list is reordered.
 *
 * A sortable list keyed by position looks broken on drop: React sees the same keys in the same order and
 * rewrites each element's contents rather than moving any node, so the dragged item snaps back to where it
 * started and the new order appears a frame later as a swap. Ids that follow the item let React move the
 * nodes, which is what the drag animation is animating.
 *
 * Values are matched by equality and consumed as they match, so a list holding the same value twice keeps
 * two distinct ids rather than collapsing them into one.
 */
export function useStableIds(items: string[]): string[] {
  const held = useRef<{ item: string; id: string }[]>([]);
  const next = useRef(0);

  const pool = [...held.current];
  const pairs = items.map((item) => {
    const at = pool.findIndex((p) => p.item === item);
    // Re-running this render must not mint new ids, so a match is taken from what the last render held.
    return at === -1 ? { item, id: `item-${next.current++}` } : pool.splice(at, 1)[0];
  });
  held.current = pairs;

  return pairs.map((p) => p.id);
}
