import { useCallback, useRef, useState } from 'react';

/** A tree's closed parent rows, and the selection whose parents it last opened. */
export type TreeCollapseState = { collapsed: Set<string>; revealed: string | null };

export const OPEN_TREE: TreeCollapseState = { collapsed: new Set(), revealed: null };

/** A tree's collapse state, held by its host so it outlives the tree. */
export type TreeCollapse = {
  value: TreeCollapseState;
  update: (next: (prev: TreeCollapseState) => TreeCollapseState) => void;
};

/** What a List Editor adapter offers its toolbar's Collapse All button. */
export type ListCollapse = {
  /** What the tree lists, plural: "locations" reads "Collapse all locations". */
  noun: string;
  /** Every parent row of the full tree, or null while no tree is shown. */
  parents: readonly string[] | null;
  state: TreeCollapse;
};

/** Every row that has a deeper row right below it, in a flat depth-ordered tree. */
export function treeParentIds(rows: readonly { id: string; depth: number }[]): string[] {
  return rows.filter((row, i) => (rows[i + 1]?.depth ?? -1) > row.depth).map((row) => row.id);
}

export type TreeCollapseStore = {
  stateFor: (key: string) => TreeCollapse;
  /** Asks the key's tree to open the groups above its selection again, as a navigation from outside it does. */
  requestReveal: (key: string) => void;
};

/** One collapse state per key, for as long as the host stays mounted. A key's `update` stays the same function. */
export function useTreeCollapseStore(): TreeCollapseStore {
  const [states, setStates] = useState<Partial<Record<string, TreeCollapseState>>>({});
  const updaters = useRef(new Map<string, TreeCollapse['update']>());
  const updaterFor = useCallback((key: string) => {
    let update = updaters.current.get(key);
    if (!update) {
      update = (next) => setStates((prev) => {
        const was = prev[key] ?? OPEN_TREE;
        const now = next(was);
        return now === was ? prev : { ...prev, [key]: now };
      });
      updaters.current.set(key, update);
    }
    return update;
  }, []);
  const stateFor = useCallback((key: string) => ({ value: states[key] ?? OPEN_TREE, update: updaterFor(key) }), [states, updaterFor]);
  // Forgetting the last reveal makes the tree reveal its selection again, even one it already revealed.
  const requestReveal = useCallback((key: string) => {
    updaterFor(key)((prev) => (prev.revealed === null ? prev : { ...prev, revealed: null }));
  }, [updaterFor]);
  return { stateFor, requestReveal };
}
