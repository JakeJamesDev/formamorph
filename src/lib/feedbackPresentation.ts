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

/**
 * The status filter as the list wants it: a real status, or nothing at all.
 *
 * @param value - The dropdown's current value
 * @returns The status to filter by, or undefined for every status
 */
export const statusFilterValue = (value: FeedbackStatus | typeof ANY_STATUS): FeedbackStatus | undefined =>
  (value === ANY_STATUS ? undefined : value);

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

/** How a suggestion board may be ordered. */
export const FEEDBACK_SORTS = ['newest', 'votes'] as const;
export type FeedbackSort = (typeof FEEDBACK_SORTS)[number];

/** The sort dropdown's labels. */
export const SORT_LABELS: Record<FeedbackSort, string> = {
  newest: 'Newest',
  votes: 'Most voted',
};

// A thread timestamp is a server timestamp like any other — see `lib/serverDate`.
export { formatServerDateTime as formatFeedbackDate } from './serverDate';
