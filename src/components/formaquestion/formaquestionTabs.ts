import { useCallback, useState } from 'react';
import { INITIAL_HISTORY, pushEntry, stepTarget, type ReaderHistory } from '@/lib/formaquestion/readerHistory';

/** The parts of the Formaquestion window, in tab order. Guarded against the dev-router ledger by `devRouter.test.ts`. */
export const FORMAQUESTION_TABS = [
  { value: 'ask', label: 'Ask' },
  { value: 'search', label: 'Search' },
  { value: 'guide', label: 'Guide' },
] as const;

export type FormaquestionTab = (typeof FORMAQUESTION_TABS)[number]['value'];

/** What the window shows. It outlives a close, a tab change and a change of layout. */
export interface GuideView {
  /** The narrow layout's tab. In the wide layout, `ask` shows the conversation in place of the reader. */
  tab: FormaquestionTab;
  query: string;
  /** The question the player is typing. */
  draft: string;
  sectionId: string | null;
  /** The narrow Guide tab shows the open section. False shows the contents, with that section marked. */
  reading: boolean;
  /** The pages whose sections show in the contents list. */
  openPages: readonly string[];
  /** The reader's Back and Forward trail. It records in every layout. */
  history: ReaderHistory;
}

export const INITIAL_GUIDE_VIEW: GuideView = { tab: 'ask', query: '', draft: '', sectionId: null, reading: false, openPages: [], history: INITIAL_HISTORY };

/** The fields to change, or a function that reads the view and returns them. */
export type GuideViewChange = Partial<GuideView> | ((current: GuideView) => Partial<GuideView>);

/** The pages list with `page` open. */
function withPageOpen(openPages: readonly string[], page: string | undefined): readonly string[] {
  return page === undefined || openPages.includes(page) ? openPages : [...openPages, page];
}

/** Opens a section in the reader, on the Guide tab, as a new history entry. Its page opens in the contents list and stays open. */
export function openSectionChange(sectionId: string, page: string | undefined): GuideViewChange {
  return (current) => ({
    sectionId,
    tab: 'guide',
    reading: true,
    openPages: withPageOpen(current.openPages, page),
    history: pushEntry(current.history, sectionId),
  });
}

/** Wide View's Back to Conversation: shows the conversation in place of the reader, as a new history entry. */
export function conversationChange(): GuideViewChange {
  return (current) => ({ tab: 'ask', history: pushEntry(current.history, null) });
}

/**
 * Moves the history cursor one entry and shows that entry. The full screen passes over the entries it
 * cannot show (see `stepTarget`). Nothing changes at the end.
 */
export function stepChange(delta: -1 | 1, fullScreen: boolean, pageOf: (sectionId: string) => string | undefined): GuideViewChange {
  return (current) => {
    const cursor = stepTarget(current.history, delta, fullScreen ? { shown: current.sectionId } : undefined);
    if (cursor === null) return {};
    const history = { ...current.history, cursor };
    const { sectionId } = history.entries[cursor];
    if (sectionId === null) return { history, tab: 'ask' };
    return { history, sectionId, tab: 'guide', reading: true, openPages: withPageOpen(current.openPages, pageOf(sectionId)) };
  };
}

export function useGuideView(): [GuideView, (change: GuideViewChange) => void] {
  const [view, setView] = useState<GuideView>(INITIAL_GUIDE_VIEW);
  const changeView = useCallback((change: GuideViewChange) => setView((current) => ({
    ...current,
    ...(typeof change === 'function' ? change(current) : change),
  })), []);
  return [view, changeView];
}

/** A search runs from this many characters. */
const MIN_QUERY_LENGTH = 2;

/** True when the search text is long enough to search. */
export function isSearchable(query: string): boolean {
  return query.trim().length >= MIN_QUERY_LENGTH;
}
