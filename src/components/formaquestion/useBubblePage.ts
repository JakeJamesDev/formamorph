import { useState } from 'react';
import type { HelpExchange } from './useHelpChat';

export interface BubblePage {
  /** The exchange on the page: the newest, until the player pages back. */
  exchange: HelpExchange | undefined;
  /** The page is the newest exchange. */
  newest: boolean;
  /** Absent on the first page. */
  previous?: () => void;
  /** Absent on the newest page. */
  next?: () => void;
  /** An answer streams while the player reads an earlier page. */
  waiting: boolean;
}

/**
 * The Bubble's page over the conversation (Q2, Q8). It is view state: a new question and Clear Conversation
 * return it to the newest page, and nothing stores it.
 */
export function useBubblePage(exchanges: readonly HelpExchange[]): BubblePage {
  const [pagedId, setPagedId] = useState<string | null>(null);
  const newestId = exchanges.at(-1)?.id ?? null;
  const [seenId, setSeenId] = useState(newestId);
  if (seenId !== newestId) {
    setSeenId(newestId);
    setPagedId(null);
  }

  const last = exchanges.length - 1;
  const at = pagedId === null ? -1 : exchanges.findIndex((entry) => entry.id === pagedId);
  const index = at === -1 ? last : at;
  const newest = index === last;
  return {
    exchange: exchanges[index],
    newest,
    previous: index > 0 ? () => setPagedId(exchanges[index - 1].id) : undefined,
    next: newest ? undefined : () => setPagedId(index + 1 === last ? null : exchanges[index + 1].id),
    waiting: !newest && exchanges[last].status === 'writing',
  };
}
