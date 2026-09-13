/**
 * The world author's add-on review: each offer's saved state, the decisions staged against it, and the
 * rows the chosen filter and order select.
 *
 * Filtering and ordering read the saved state. A staged decision changes the control's value and keeps
 * the row selected; it never reorders the list.
 */

import { parseServerDate } from '@/lib/serverDate';
import { kindOf, KIND_LABELS } from '@/lib/catalogKinds';
import { listingId, type AddonRow } from '@/lib/worldDependencies';
import type { ReviewState } from '@/lib/compatibleWorlds';

/** The three-way control, left to right. Unreviewed is centered between the two decisions. */
export const REVIEW_CHOICES = [
  { value: 'approved', label: 'Approved' },
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'declined', label: 'Declined' },
] as const satisfies readonly { value: ReviewState; label: string }[];

/** What Show offers. `attention` is the default: unreviewed rows and changed rows. */
export const SHOW_FILTERS = [
  { value: 'attention', label: 'Needs Attention' },
  { value: 'all', label: 'Everything' },
  { value: 'approved', label: 'Approved' },
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'declined', label: 'Declined' },
] as const;

export type ShowFilter = (typeof SHOW_FILTERS)[number]['value'];

/** What Sort offers. `oldestWaiting` is the default: the longest-waiting offer first. */
export const SORT_ORDERS = [
  { value: 'oldestWaiting', label: 'Oldest Waiting' },
  { value: 'newestWaiting', label: 'Newest Waiting' },
  { value: 'recentlyUpdated', label: 'Recently Updated' },
  { value: 'name', label: 'Name' },
  { value: 'author', label: 'Author' },
] as const;

export type SortOrder = (typeof SORT_ORDERS)[number]['value'];

/** The decisions Save Changes writes, by component listing id. An entry exists only where it changes
 *  something. The saved state again, on a row with no update to acknowledge, is not staged. */
export type PendingReviews = Readonly<Record<string, ReviewState>>;

/** One offer as the dialog draws it. */
export interface ReviewRow {
  /** The component listing's id, which is what a review is addressed to. */
  id: string;
  name: string;
  author: string;
  /** The listing's kind, for the row's second line. */
  kindLabel: string;
  /** What the server holds. */
  saved: ReviewState;
  /** The control's value: the staged decision where there is one, else the saved state. */
  state: ReviewState;
  /** True while this row carries a staged change. */
  pending: boolean;
  /** The source changed after the author answered, and the server still holds no acknowledgment. */
  updatedSinceReview: boolean;
  /** Whether to show the Updated since review badge. A staged decision acknowledges the update, so the
   *  badge clears and Pending change replaces it. */
  showUpdatedBadge: boolean;
  /** Unreviewed, or changed since the answer. The Needs Attention filter is exactly this. */
  needsAttention: boolean;
  /** When this row's current state began, in epoch milliseconds. Zero when no date could be read. */
  waitingSince: number;
  /** When the component last changed, in epoch milliseconds. Zero when no date could be read. */
  updatedAt: number;
}

/** A server timestamp as epoch milliseconds; zero when it is missing or unreadable. */
function instant(timestamp: unknown): number {
  return typeof timestamp === 'string' ? (parseServerDate(timestamp)?.getTime() ?? 0) : 0;
}

/**
 * When a row's current state began.
 *
 * A changed source waits from the change, not from the original offer. An unreviewed offer waits from
 * `offeredAt`. The listing's own dates cannot supply that: a republish overwrites them.
 */
function waitingSince(addon: AddonRow, saved: ReviewState, updated: boolean): number {
  if (updated) return instant(addon.updated_at);
  if (saved === 'unreviewed') return instant(addon.offeredAt) || instant(addon.created_at);
  return instant(addon.reviewedAt) || instant(addon.offeredAt);
}

/**
 * Build the review rows for one world's offers.
 *
 * @param addons - The world's add-on offerings, declined ones included
 * @param pending - The decisions staged so far
 * @returns One row per offering, in the order the server gave them
 */
export function reviewRows(addons: readonly AddonRow[], pending: PendingReviews = {}): ReviewRow[] {
  return addons.map((addon) => {
    const id = listingId(addon);
    const saved: ReviewState = addon.reviewState ?? 'unreviewed';
    const staged = pending[id];
    const updated = Boolean(addon.updatedSinceReview);
    return {
      id,
      name: addon.name || 'Untitled',
      author: addon.author?.username || 'Another author',
      kindLabel: KIND_LABELS[kindOf(addon)].one,
      saved,
      state: staged ?? saved,
      pending: staged !== undefined,
      updatedSinceReview: updated,
      showUpdatedBadge: updated && staged === undefined,
      needsAttention: saved === 'unreviewed' || updated,
      waitingSince: waitingSince(addon, saved, updated),
      updatedAt: instant(addon.updated_at),
    };
  });
}

/** Whether the saved row belongs under this filter. A staged row is shown whatever this answers. */
function matchesFilter(row: ReviewRow, filter: ShowFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'attention') return row.needsAttention;
  return row.saved === filter;
}

const byName = (a: ReviewRow, b: ReviewRow) => a.name.localeCompare(b.name);

const COMPARATORS: Record<SortOrder, (a: ReviewRow, b: ReviewRow) => number> = {
  oldestWaiting: (a, b) => a.waitingSince - b.waitingSince || byName(a, b),
  newestWaiting: (a, b) => b.waitingSince - a.waitingSince || byName(a, b),
  recentlyUpdated: (a, b) => b.updatedAt - a.updatedAt || byName(a, b),
  name: byName,
  author: (a, b) => a.author.localeCompare(b.author) || byName(a, b),
};

/**
 * The rows this Show and this Sort select.
 *
 * A staged row is selected whatever the filter answers. Removing it would also remove its Discard.
 *
 * @param rows - Every row, from `reviewRows`
 * @param filter - The chosen Show
 * @param sort - The chosen Sort
 * @returns The rows to draw, in order
 */
export function visibleRows(rows: readonly ReviewRow[], filter: ShowFilter, sort: SortOrder): ReviewRow[] {
  return rows.filter((row) => row.pending || matchesFilter(row, filter)).sort(COMPARATORS[sort]);
}

/** The stage without this row's entry. */
function withoutRow(pending: PendingReviews, id: string): PendingReviews {
  if (pending[id] === undefined) return pending;
  const next = { ...pending };
  delete next[id];
  return next;
}

/**
 * Stage a decision.
 *
 * The saved state again clears the entry. The exception is a source that changed since that answer: the
 * same state is then the acknowledgment, which is a change to save.
 *
 * @param pending - The stage so far
 * @param row - The row being answered
 * @param next - The chosen state
 * @returns The new stage
 */
export function stageDecision(pending: PendingReviews, row: ReviewRow, next: ReviewState): PendingReviews {
  if (next === row.saved && !row.updatedSinceReview) return withoutRow(pending, row.id);
  return { ...pending, [row.id]: next };
}

/**
 * Stage an acknowledgment. The decision persists and the reviewed revision is set to the source's current
 * one.
 *
 * @param pending - The stage so far
 * @param row - The row being acknowledged
 * @returns The new stage
 */
export function stageAcknowledgment(pending: PendingReviews, row: ReviewRow): PendingReviews {
  return { ...pending, [row.id]: row.state };
}

/** How many rows carry a staged change. */
export const pendingCount = (pending: PendingReviews): number => Object.keys(pending).length;

const DAY_MS = 86_400_000;

/**
 * A span as a readable phrase.
 *
 * @param ms - The span, in milliseconds
 * @returns A phrase that reads after both `Waiting` and before `ago`
 */
export function durationLabel(ms: number): string {
  const days = Math.floor(Math.max(ms, 0) / DAY_MS);
  if (days < 1) return 'less than a day';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  const months = Math.round(days / 30);
  return months === 1 ? '1 month' : `${months} months`;
}

/**
 * The row's second line, after the author: how long it has waited, or when it was reviewed.
 *
 * @param row - The row being drawn
 * @param now - The present moment, in epoch milliseconds
 * @returns The phrase to show, or an empty string when the row carries no readable date
 */
export function waitingLabel(row: ReviewRow, now: number): string {
  if (!row.waitingSince) return '';
  const span = durationLabel(now - row.waitingSince);
  return row.needsAttention ? `Waiting ${span}` : `Reviewed ${span} ago`;
}
