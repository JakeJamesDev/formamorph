import { useState } from 'react';

/** A list this long or longer opens with every card collapsed. */
const COLLAPSE_FROM = 3;

const initialCollapsed = (ids: readonly string[]): ReadonlySet<string> =>
  new Set(ids.length >= COLLAPSE_FROM ? ids : []);

/**
 * Open state for a list of collapsible cards, keyed by row id. A list opens collapsed from three rows and
 * expanded below that. A row the state has never seen opens expanded. Nothing is stored anywhere: the state
 * lives as long as the list is mounted.
 */
export function useCardCollapse(ids: readonly string[]) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => initialCollapsed(ids));
  const anyOpen = ids.some((id) => !collapsed.has(id));
  return {
    isOpen: (id: string) => !collapsed.has(id),
    anyOpen,
    /** Collapses every row while one is open, else expands every row. */
    toggleAll: () => setCollapsed(anyOpen ? new Set(ids) : new Set<string>()),
    toggle: (id: string) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    /** Starts over on a fresh list of ids, by the open-on-mount rule. */
    reset: (next: readonly string[]) => setCollapsed(initialCollapsed(next)),
  };
}
