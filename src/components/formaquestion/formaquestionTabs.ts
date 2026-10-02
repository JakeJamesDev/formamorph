import { useCallback, useState } from 'react';

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
}

export const INITIAL_GUIDE_VIEW: GuideView = { tab: 'ask', query: '', draft: '', sectionId: null, reading: false, openPages: [] };

/** The fields to change, or a function that reads the view and returns them. */
export type GuideViewChange = Partial<GuideView> | ((current: GuideView) => Partial<GuideView>);

/** Opens a section in the reader, on the Guide tab. Its page opens in the contents list and stays open. */
export function openSectionChange(sectionId: string, page: string | undefined): GuideViewChange {
  return (current) => ({
    sectionId,
    tab: 'guide',
    reading: true,
    openPages: page === undefined || current.openPages.includes(page) ? current.openPages : [...current.openPages, page],
  });
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
