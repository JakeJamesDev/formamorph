/**
 * When the cached catalog no longer describes the server.
 *
 * The catalog response carries the server settings a reader's controls follow, such as whether the server
 * accepts a guest's like. An administrator write to one of those makes the cached copy wrong. Nothing else
 * asks for the catalog again: the reader is unchanged and no Claim has moved a mark.
 */

/** How many times the cached catalog has been marked out of date. */
let marks = 0;

/** Notified on each mark. */
const listeners = new Set<() => void>();

/** What a reader of the catalog needs from this. */
export interface StaleWatch {
  /** Subscribe to marks. Returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** The mark count, which changes when the cached catalog goes out of date. */
  marked: () => number;
}

/** Mark every cached catalog out of date. */
export function markCatalogStale(): void {
  marks += 1;
  listeners.forEach((listener) => listener());
}

/** The real one. Every reader but a test uses it. */
export const catalogStale: StaleWatch = {
  subscribe: (listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  marked: () => marks,
};

/** Reset the count and the listeners. For tests, whose module state persists across cases. */
export function resetCatalogStale(): void {
  marks = 0;
  listeners.clear();
}
