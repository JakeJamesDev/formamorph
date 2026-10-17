import { rehydrationCooldownBlocked } from './semanticRehydration';

/** The memories one history trim picked, which a re-render of the same turn's history keeps. */
export interface HistoryPicks {
  semanticRehydrate: string[] | null;
  stickyIds: ReadonlySet<string>;
}

/** What semantic recall remembers between turns: the turn it last ran for, and when each turn last came back. */
export interface RecallBook {
  lastRecallTurn: number | null;
  lastFired: Map<string, number>;
}

/**
 * The memories a trim recalls. A live trim records its picks in `book`; a preview reads the book without
 * writing it. `picks` re-renders a turn's history with the memories its first trim chose (Q52).
 */
export function pickHistoryRecall({ picks, live, turnCount, book, sticky, select }: {
  picks?: HistoryPicks;
  live: boolean;
  turnCount: number;
  book: RecallBook;
  sticky: ReadonlySet<string>;
  /** Ranks the old scenes worth rehydrating, minus the blocked ones. Null when semantic recall is off. */
  select: ((blocked: ReadonlySet<string>) => string[]) | null;
}): HistoryPicks {
  if (picks) return picks;
  if (!select) return { semanticRehydrate: null, stickyIds: sticky };
  const recallTurn = live ? turnCount : book.lastRecallTurn ?? turnCount;
  const semanticRehydrate = select(rehydrationCooldownBlocked(book.lastFired, recallTurn));
  if (live) {
    book.lastRecallTurn = recallTurn;
    for (const id of semanticRehydrate) book.lastFired.set(id, recallTurn);
  }
  return { semanticRehydrate, stickyIds: sticky };
}
