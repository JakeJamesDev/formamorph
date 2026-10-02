import {
  BUG_CATEGORIES, BUG_STATUSES, SUGGESTION_CATEGORIES, SUGGESTION_STATUSES,
  type FeedbackCategory, type FeedbackStatus, type FeedbackType,
} from '@/types';

/** How each branch of the tree reads, wherever one has to be named. */
export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, { tab: string; one: string; many: string }> = {
  bug: { tab: 'Bug', one: 'Bug Report', many: 'Bugs' },
  suggestion: { tab: 'Suggestion', one: 'Suggestion', many: 'Suggestions' },
};

/** How each category reads in the dropdown and on a thread. Both branches, keyed by their own values. */
export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  // Bugs
  crash: 'Crash or freeze',
  ai: 'AI output',
  editor: 'World Editor',
  community: 'Community & publishing',
  visuals: 'Visuals & layout',
  other: 'Something else',
  // Suggestions — `editor`, `community` and `other` are shared with the list above.
  gameplay: 'Gameplay',
  writing: 'AI & writing',
  interface: 'Interface',
};

/** How each state reads, and the badge that carries it. */
export const FEEDBACK_STATUS_STYLES: Record<FeedbackStatus, { label: string; badge: string }> = {
  // Bugs
  open: { label: 'Open', badge: 'bg-primary/10 text-primary' },
  need_info: { label: 'Need Info', badge: 'bg-warning/10 text-warning' },
  confirmed: { label: 'Confirmed', badge: 'bg-info/10 text-info' },
  resolved: { label: 'Resolved', badge: 'bg-success/10 text-success' },
  wontfix: { label: "Won't Fix", badge: 'bg-muted text-muted-foreground' },
  // Suggestions — `open` is shared with the list above.
  considering: { label: 'Considering', badge: 'bg-warning/10 text-warning' },
  planned: { label: 'Planned', badge: 'bg-info/10 text-info' },
  done: { label: 'Done', badge: 'bg-success/10 text-success' },
  declined: { label: 'Declined', badge: 'bg-muted text-muted-foreground' },
};

/** The categories each branch offers, in the order the server declares them. */
export const CATEGORY_OPTIONS: Record<FeedbackType, { value: FeedbackCategory; label: string }[]> = {
  bug: BUG_CATEGORIES.map((value) => ({ value, label: FEEDBACK_CATEGORY_LABELS[value] })),
  suggestion: SUGGESTION_CATEGORIES.map((value) => ({ value, label: FEEDBACK_CATEGORY_LABELS[value] })),
};

/** The statuses each branch offers, in triage order. */
export const STATUS_OPTIONS: Record<FeedbackType, { value: FeedbackStatus; label: string }[]> = {
  bug: BUG_STATUSES.map((value) => ({ value, label: FEEDBACK_STATUS_STYLES[value].label })),
  suggestion: SUGGESTION_STATUSES.map((value) => ({ value, label: FEEDBACK_STATUS_STYLES[value].label })),
};

/** The category a blank draft of each kind starts on. */
export const DEFAULT_CATEGORY: Record<FeedbackType, FeedbackCategory> = {
  bug: 'crash',
  suggestion: 'gameplay',
};

/** The status filter's "no filter" value. A `Select` cannot hold an empty string as an item value. */
export const ANY_STATUS = 'any';

/** The status filter's "still needs looking at" value — every state that isn't a closed one. */
export const UNRESOLVED_STATUS = 'unresolved';

/**
 * The states that still want attention, per branch: everything a thread can sit in short of being
 * closed. A bug is closed by being fixed or turned down; a suggestion by being built or turned down.
 */
export const UNRESOLVED_STATUSES: Record<FeedbackType, FeedbackStatus[]> = {
  bug: BUG_STATUSES.filter((value) => value !== 'resolved' && value !== 'wontfix'),
  suggestion: SUGGESTION_STATUSES.filter((value) => value !== 'done' && value !== 'declined'),
};

/** How the unresolved filter reads over each branch — a suggestion is never "unresolved". */
export const UNRESOLVED_LABELS: Record<FeedbackType, string> = {
  bug: 'Unresolved',
  suggestion: 'Still Open',
};

/** Everything the status filter can hold: one state, every state, or every state still needing work. */
export type StatusFilter = FeedbackStatus | typeof ANY_STATUS | typeof UNRESOLVED_STATUS;

/** What a list says when its filters leave nothing to show. */
export const FILTERED_EMPTY_LABELS: Record<FeedbackType, string> = {
  bug: 'No reports match this filter.',
  suggestion: 'No suggestions match this filter.',
};

/** What every feedback list opens on: the threads that still need work. */
export const DEFAULT_STATUS_FILTER: Record<FeedbackType, StatusFilter> = {
  bug: UNRESOLVED_STATUS,
  suggestion: UNRESOLVED_STATUS,
};

/** The category filter's "no filter" value, for the same reason. */
export const ANY_CATEGORY = 'any';

/** Everything the category filter can hold: one category, or every category. */
export type CategoryFilter = FeedbackCategory | typeof ANY_CATEGORY;

/**
 * The status filter as the list wants it: one real status, the set that is still open, or nothing at all.
 *
 * @param value - The dropdown's current value
 * @param type - Which branch is being filtered, which decides what counts as closed
 * @returns The status or statuses to filter by, or undefined for every status
 */
export const statusFilterValue = (
  value: StatusFilter,
  type: FeedbackType,
): FeedbackStatus | FeedbackStatus[] | undefined => {
  if (value === ANY_STATUS) return undefined;
  if (value === UNRESOLVED_STATUS) return UNRESOLVED_STATUSES[type];
  return value;
};

/**
 * The category filter as the list wants it: a real category, or nothing at all.
 *
 * @param value - The dropdown's current value
 * @returns The category to filter by, or undefined for every category
 */
export const categoryFilterValue = (value: CategoryFilter): FeedbackCategory | undefined =>
  (value === ANY_CATEGORY ? undefined : value);

/** Which threads a profile tab is showing. */
export const FEEDBACK_SCOPES = ['mine', 'all'] as const;
export type FeedbackScope = (typeof FEEDBACK_SCOPES)[number];

/** The scope dropdown's labels, per branch — "My Reports" reads wrong over a list of suggestions. */
export const SCOPE_LABELS: Record<FeedbackType, Record<FeedbackScope, string>> = {
  bug: { mine: 'My Reports', all: 'All Reports' },
  suggestion: { mine: 'Mine', all: 'Everyone’s' },
};

/**
 * The scope as the list wants it: `all` asks the server for everyone's, and the caller's own is the
 * default it applies when nothing is passed.
 *
 * @param value - The dropdown's current value
 * @returns `'all'`, or undefined for the caller's own
 */
export const scopeFilterValue = (value: FeedbackScope): 'all' | undefined => (value === 'all' ? 'all' : undefined);

/** The search bar's name and placeholder, per branch. */
export const SEARCH_LABELS: Record<FeedbackType, string> = {
  bug: 'Search Reports',
  suggestion: 'Search Suggestions',
};

/** Every way a feedback list may be ordered. */
export const FEEDBACK_SORTS = ['newest', 'oldest', 'active', 'votes'] as const;
export type FeedbackSort = (typeof FEEDBACK_SORTS)[number];

/** The sort dropdown's labels. */
export const SORT_LABELS: Record<FeedbackSort, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  active: 'Recently Active',
  votes: 'Most Voted',
};

/**
 * The sorts a branch offers, in dropdown order. Only suggestions carry votes, so only they rank by them.
 *
 * @param type - Which branch the list shows
 * @returns The offered sorts
 */
export const sortsFor = (type: FeedbackType): FeedbackSort[] =>
  (type === 'suggestion' ? [...FEEDBACK_SORTS] : FEEDBACK_SORTS.filter((value) => value !== 'votes'));

/** Which scope each profile tab opens on. */
export const DEFAULT_SCOPE: Record<FeedbackType, FeedbackScope> = {
  // Their own: this is where their replies are, and the badge counts their threads.
  bug: 'mine',
  // Everyone's: a board is for browsing and voting, and mine-first buries the point.
  suggestion: 'all',
};

/** The staff queue's filters. */
export type StaffFilterValues = { status: StatusFilter; category: CategoryFilter; sort: FeedbackSort };
/** A profile tab's filters: the staff set plus whose threads to show. */
export type UserFilterValues = StaffFilterValues & { scope: FeedbackScope };

/** The staff queue's filters behind the Filters button. */
export const STAFF_HIDDEN_FILTERS = ['category'] as const satisfies readonly (keyof StaffFilterValues)[];
/** A profile tab's filters behind the Filters button. */
export const USER_HIDDEN_FILTERS = ['status', 'category', 'sort'] as const satisfies readonly (keyof UserFilterValues)[];

/**
 * What the staff queue opens on and resets to. Staff triage suggestions by demand, so they open on votes.
 *
 * @param type - Which branch the queue shows
 * @returns The queue's default filters
 */
export const staffFilterDefaults = (type: FeedbackType): StaffFilterValues => ({
  status: DEFAULT_STATUS_FILTER[type],
  category: ANY_CATEGORY,
  sort: type === 'suggestion' ? 'votes' : 'newest',
});

/**
 * What a profile tab opens on and resets to. Users see the newest first, to find what is new to vote on.
 *
 * @param type - Which branch the tab shows
 * @returns The tab's default filters
 */
export const userFilterDefaults = (type: FeedbackType): UserFilterValues => ({
  status: DEFAULT_STATUS_FILTER[type],
  category: ANY_CATEGORY,
  sort: 'newest',
  scope: DEFAULT_SCOPE[type],
});

// A thread timestamp is a server timestamp like any other — see `lib/serverDate`.
export { formatServerDateTime as formatFeedbackDate } from './serverDate';
