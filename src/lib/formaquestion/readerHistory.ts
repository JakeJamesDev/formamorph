/** The most entries the history holds. A new entry past it drops the oldest. */
export const HISTORY_LIMIT = 50;

/** One stop of the reader: a Guide section, or null for the conversation. */
export interface HistoryEntry {
  /** Names the entry across a drop, so its scroll position stays its own. */
  id: number;
  sectionId: string | null;
}

/** The reader's view history, as in a browser: entries in order and a cursor on the one on show. */
export interface ReaderHistory {
  entries: readonly HistoryEntry[];
  cursor: number;
  /** The id the next entry takes. */
  nextId: number;
}

/** A new history sits on the conversation, so Back from the first section returns to it. */
export const INITIAL_HISTORY: ReaderHistory = { entries: [{ id: 0, sectionId: null }], cursor: 0, nextId: 1 };

export function currentEntry(history: ReaderHistory): HistoryEntry {
  return history.entries[history.cursor];
}

/** Adds an entry after the cursor and drops the forward entries. The entry on show is not added twice. */
export function pushEntry(history: ReaderHistory, sectionId: string | null): ReaderHistory {
  if (currentEntry(history).sectionId === sectionId) return history;
  const kept = [...history.entries.slice(0, history.cursor + 1), { id: history.nextId, sectionId }];
  const entries = kept.slice(-HISTORY_LIMIT);
  return { entries, cursor: entries.length - 1, nextId: history.nextId + 1 };
}

/** What the full screen shows. It has no conversation, and only one section at a time. */
export interface FullScreenView {
  /** The section on show, or null before one opens. */
  shown: string | null;
}

/**
 * The index a step of `delta` lands on, or null at the end. The full screen passes over the conversation
 * and over the section it already shows, so a step there always changes what is on screen.
 */
export function stepTarget(history: ReaderHistory, delta: -1 | 1, fullScreen?: FullScreenView): number | null {
  for (let index = history.cursor + delta; index >= 0 && index < history.entries.length; index += delta) {
    const { sectionId } = history.entries[index];
    if (!fullScreen || (sectionId !== null && sectionId !== fullScreen.shown)) return index;
  }
  return null;
}

export function canStep(history: ReaderHistory, delta: -1 | 1, fullScreen?: FullScreenView): boolean {
  return stepTarget(history, delta, fullScreen) !== null;
}
