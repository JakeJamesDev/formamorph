/**
 * When the catalog this app holds stops describing the server.
 *
 * The catalog response carries more than rows: it carries the server settings a reader's controls follow,
 * such as whether a guest's like is taken. An administrator who changes one of those has made what is held
 * wrong, and nothing else would ask for the catalog again — the reader has not changed, and no Claim has
 * moved a mark. This is how they say so.
 */

/** How many times the catalog in hand has been called out of date. */
let marks = 0;

/** Told when it happens. */
const listeners = new Set<() => void>();

/** What a reader of the catalog needs from this. */
export interface StaleWatch {
  /** Listen for a mark. Returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** How many marks there have been, which changes when the catalog in hand goes out of date. */
  marked: () => number;
}

/** Say that what every reader holds no longer describes the server. */
export function markCatalogStale(): void {
  marks += 1;
  listeners.forEach((listener) => listener());
}

/** The real one, which every reader but a test takes. */
export const catalogStale: StaleWatch = {
  subscribe: (listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  marked: () => marks,
};

/** Forget everything, listeners included. For tests, whose module state would otherwise carry over. */
export function resetCatalogStale(): void {
  marks = 0;
  listeners.clear();
}
