import { useState } from 'react';

/** A list this long or longer opens with every card collapsed. */
export const COLLAPSE_FROM = 3;

const initialCollapsed = (ids: readonly string[]): ReadonlySet<string> =>
  new Set(ids.length >= COLLAPSE_FROM ? ids : []);

/**
 * Open state for a list of collapsible cards, keyed by row id. A list opens collapsed from three rows and
 * expanded below that. A row the state has never seen opens expanded. Nothing is stored anywhere: the state
 * lives as long as the list is mounted.
 */
export function useCardCollapse(ids: readonly string[]) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => initialCollapsed(ids));
  return {
    isOpen: (id: string) => !collapsed.has(id),
    anyOpen: ids.some((id) => !collapsed.has(id)),
    toggle: (id: string) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    /** Expands every row, or collapses every row. */
    setAll: (open: boolean) => setCollapsed(open ? new Set<string>() : new Set(ids)),
    /** Starts over on a fresh list of ids, by the open-on-mount rule. */
    reset: (next: readonly string[]) => setCollapsed(initialCollapsed(next)),
  };
}
