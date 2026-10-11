import { createContext, useEffect, useMemo, useRef } from 'react';
import { currentEntry, type ReaderHistory } from '@/lib/formaquestion/readerHistory';

/** Where the reader sat in the history entry on show. A reader restores it on mount and reports each scroll. */
export interface ReaderScroll {
  /** The entry's id. A reader keyed by it starts over for each entry. */
  entryId: number;
  get: () => number;
  set: (top: number) => void;
}

/** Null where no history backs the reader, so it starts at the top and remembers nothing. */
export const ReaderScrollContext = createContext<ReaderScroll | null>(null);

/**
 * The scroll positions of a history's entries. They live outside the view state because a scroll event
 * must not render the window. An entry that leaves the history takes its position with it.
 */
export function useReaderScroll(history: ReaderHistory): ReaderScroll {
  const tops = useRef(new Map<number, number>());
  useEffect(() => {
    const live = new Set(history.entries.map((entry) => entry.id));
    tops.current.forEach((_top, id) => { if (!live.has(id)) tops.current.delete(id); });
  }, [history.entries]);
  const entryId = currentEntry(history).id;
  return useMemo(() => ({
    entryId,
    get: () => tops.current.get(entryId) ?? 0,
    set: (top) => { tops.current.set(entryId, top); },
  }), [entryId]);
}
