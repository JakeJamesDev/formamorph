import { useRef } from 'react';

/** Whether two id lists hold the same ids in the same order. */
export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * The id array a sortable context is given, held at one reference for as long as the ids themselves do
 * not change.
 *
 * dnd-kit compares a sortable context's items by reference. A fresh array arriving on a mid-drag render
 * reads as a whole new set of items, which drops every displaced row's 200ms sort transition to 0ms — the
 * rows stop sliding and start snapping. Comparing by content rather than by the caller's array identity
 * means a list that rebuilds its array every render still gets a stable one here, so the trap cannot be
 * re-opened from a call site.
 */
export function useSortableIds<T>(items: readonly T[], getId: (item: T) => string): string[] {
  const held = useRef<string[]>([]);
  const next = items.map(getId);
  if (!sameIds(held.current, next)) held.current = next;
  return held.current;
}
