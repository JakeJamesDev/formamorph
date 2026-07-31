import { BUG_CATEGORIES, BUG_STATUSES, type BugCategory, type BugStatus } from '@/types';

/** How each category reads in the dropdown and on a report. */
export const BUG_CATEGORY_LABELS: Record<BugCategory, string> = {
  crash: 'Crash or freeze',
  ai: 'AI output',
  editor: 'World Editor',
  community: 'Community & publishing',
  visuals: 'Visuals & layout',
  other: 'Something else',
};

/** How each triage state reads, and the badge that carries it. */
export const BUG_STATUS_STYLES: Record<BugStatus, { label: string; badge: string }> = {
  open: { label: 'Open', badge: 'bg-primary/10 text-primary' },
  need_info: { label: 'Need Info', badge: 'bg-warning/10 text-warning' },
  confirmed: { label: 'Confirmed', badge: 'bg-info/10 text-info' },
  resolved: { label: 'Resolved', badge: 'bg-success/10 text-success' },
  wontfix: { label: "Won't Fix", badge: 'bg-muted text-muted-foreground' },
};

/** The dropdown's options, in the order the server declares them. */
export const BUG_CATEGORY_OPTIONS = BUG_CATEGORIES.map((value) => ({
  value,
  label: BUG_CATEGORY_LABELS[value],
}));

/** The status filter's options, in triage order. */
export const BUG_STATUS_OPTIONS = BUG_STATUSES.map((value) => ({
  value,
  label: BUG_STATUS_STYLES[value].label,
}));

/** The status filter's "no filter" value. A `Select` cannot hold an empty string as an item value. */
export const ANY_STATUS = 'any';

/**
 * The status filter as the list wants it: a real status, or nothing at all.
 *
 * @param value - The dropdown's current value
 * @returns The status to filter by, or undefined for every status
 */
export const statusFilterValue = (value: BugStatus | typeof ANY_STATUS): BugStatus | undefined =>
  (value === ANY_STATUS ? undefined : value);

/** Which reports the profile's Bugs tab is showing. */
export const BUG_SCOPES = ['mine', 'all'] as const;
export type BugScope = (typeof BUG_SCOPES)[number];

/** The scope dropdown's labels. */
export const BUG_SCOPE_LABELS: Record<BugScope, string> = {
  mine: 'My Reports',
  all: 'All Reports',
};

/**
 * The scope as the list wants it: `all` asks the server for everyone's, and the caller's own is the
 * default it applies when nothing is passed.
 *
 * @param value - The dropdown's current value
 * @returns `'all'`, or undefined for the caller's own reports
 */
export const scopeFilterValue = (value: BugScope): 'all' | undefined => (value === 'all' ? 'all' : undefined);

// A report timestamp is a server timestamp like any other — see `lib/serverDate`.
export { formatServerDateTime as formatBugDate } from './serverDate';
