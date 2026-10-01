/** The parts of the Formaquestion window, in tab order. The dev router and the surface map read this list. */
export const FORMAQUESTION_TABS = [
  { value: 'search', label: 'Search' },
  { value: 'guide', label: 'Guide' },
] as const;

export type FormaquestionTab = (typeof FORMAQUESTION_TABS)[number]['value'];

/** What the window shows: the tab, the search text and the open docs section. It outlives a close. */
export interface GuideView {
  tab: FormaquestionTab;
  query: string;
  sectionId: string | null;
  /** The narrow Guide tab shows the open section. False shows the contents, with that section marked. */
  reading: boolean;
}

export const INITIAL_GUIDE_VIEW: GuideView = { tab: 'search', query: '', sectionId: null, reading: false };

/** A search runs from this many characters. */
export const MIN_QUERY_LENGTH = 2;
