import { KIND_LABELS, type CatalogKind } from '@/lib/catalogKinds';
import { isQuarantined } from '@/lib/quarantine';
import { parseServerDate } from '@/lib/serverDate';

/** Why a queue item waits: a new listing, an update to a live one, or a rejected listing sent back. */
export type ReviewItemType = 'new' | 'update' | 'resubmitted';

/** Where a listing stands in review, as its author and the staff read it. */
export type ModerationStatus = 'live' | 'pending' | 'updatePending' | 'rejected' | 'resubmitted';

/** One changed field in a pending update: what players see now, and what replaces it on approval. */
export interface PendingFieldChange {
  approved: unknown;
  pending: unknown;
}

/** A changelog entry as a held write carries it. */
export interface HeldChangelogEntry {
  id: string;
  title: string;
  body: string;
  date: string;
}

/** One held changelog write, in the order the author made it. */
export type PendingChangelogOp =
  | ({ op: 'create' | 'edit' } & HeldChangelogEntry)
  | { op: 'delete'; id: string };

/** The waiting edit to an approved listing, as the server sends it to the author and the staff. */
export interface PendingUpdate {
  fields?: Record<string, PendingFieldChange>;
  changelog?: PendingChangelogOp[];
  content_changed?: boolean;
  /** Where the held thumbnail is served, present only when the update changes it. */
  thumbnail_url?: string;
}

/** A catalog row's summary of its pending update, sent to staff and the author. */
export interface PendingPreview {
  name: string;
  thumbnail_url?: string;
  /** When the update joined the review queue. */
  queued_at?: string;
}

/** A listing as a view holds it. Every field is optional: a player and an old server get no review fields. */
interface ModeratedListing {
  moderation_state?: unknown;
  moderation_queued_at?: unknown;
  has_pending_update?: unknown;
  pending_update?: PendingUpdate | null;
  pending_preview?: PendingPreview | null;
  updated_at?: unknown;
  quarantined_at?: unknown;
  quarantine_expires_at?: unknown;
}

/**
 * A listing's display status.
 *
 * A pending listing that still carries its quarantine is a rejected one the author fixed. An approved
 * listing that staff quarantined reads `live` here: the quarantine marker covers it.
 */
export function moderationStatus(listing: ModeratedListing): ModerationStatus {
  switch (listing.moderation_state) {
    case 'pending':
      return isQuarantined(listing) ? 'resubmitted' : 'pending';
    case 'rejected':
      return 'rejected';
    default:
      return listing.has_pending_update === true || listing.pending_update ? 'updatePending' : 'live';
  }
}

/** The badge text for each status. `rejected` keeps the quarantine marker's own text. */
export const MODERATION_LABELS: Record<ModerationStatus, string> = {
  live: 'Live',
  pending: 'Pending Review',
  updatePending: 'Update Pending',
  rejected: 'Quarantined',
  resubmitted: 'Resubmitted',
};

/** The line under the Pending Review badge. */
export const PENDING_REVIEW_HINT = 'Players can see it after a mod approves it';

/** The line under the Update Pending badge. */
export const UPDATE_PENDING_HINT = 'Players see the live version until a mod approves the update';

/** Display order for the fields an update can change. Fields the server adds later sort after these. */
const FIELD_ORDER = [
  'name', 'description', 'tags', 'thumbnail', 'content', 'visibility', 'spoiler', 'required_dependencies',
  'compatible_worlds', 'model_license', 'models',
] as const;

/** The label for each known field. An unknown field shows its server name. */
export const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  tags: 'Tags',
  thumbnail: 'Thumbnail',
  content: 'Content',
  visibility: 'Visibility',
  spoiler: 'Spoiler',
  required_dependencies: 'Required Dependencies',
  compatible_worlds: 'Compatible Worlds',
  model_license: 'Model License',
  models: 'Models',
};

/**
 * The fields a pending update changes, in display order, empty when there is no update.
 *
 * Content and the thumbnail have no before-and-after values in `fields`, so their flags add them.
 */
export function changedFields(update: PendingUpdate | null | undefined): string[] {
  if (!update) return [];

  const names = new Set(Object.keys(update.fields ?? {}));
  if (update.content_changed) names.add('content');
  if (update.thumbnail_url) names.add('thumbnail');

  const rank = (name: string) => {
    const at = (FIELD_ORDER as readonly string[]).indexOf(name);
    return at === -1 ? FIELD_ORDER.length : at;
  };

  return [...names].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** The label for a changed field. */
export const fieldLabel = (name: string): string => FIELD_LABELS[name] ?? name;

/** Whether a listing waits for a mod: a new or resubmitted listing, or an update. */
export const awaitsReview = (listing: ModeratedListing): boolean =>
  awaitsFirstReview(listing) || moderationStatus(listing) === 'updatePending';

/** The pending preview a pinned update card shows in place of its live face, null for any other card. */
export const pendingFaceOf = (listing: ModeratedListing, inReviewGroup: boolean): PendingPreview | null =>
  inReviewGroup && moderationStatus(listing) === 'updatePending' ? listing.pending_preview ?? null : null;

/**
 * When a listing joined the review queue, in epoch ms, 0 when unknown: an update's own queue time, else its
 * last edit; a new or resubmitted listing's submission.
 */
export function reviewQueuedTime(listing: ModeratedListing): number {
  const at = moderationStatus(listing) === 'updatePending'
    ? listing.pending_preview?.queued_at ?? listing.updated_at
    : listing.moderation_queued_at;

  return typeof at === 'string' ? parseServerDate(at)?.getTime() ?? 0 : 0;
}

/** Whether a listing waits for its first approval: a new or resubmitted listing, not an update. */
export const awaitsFirstReview = (listing: ModeratedListing): boolean => {
  const status = moderationStatus(listing);
  return status === 'pending' || status === 'resubmitted';
};

/** How a queue row names why the item waits. */
export const REVIEW_TYPE_LABELS: Record<ReviewItemType, string> = {
  new: 'New',
  update: 'Update',
  resubmitted: 'Resubmitted',
};

/** How long an item has waited, in the largest whole unit: "under an hour", "5 hours", "3 days". */
export function waitedFor(queuedAt: string, now: Date = new Date()): string {
  const since = parseServerDate(queuedAt);
  if (!since) return 'unknown';

  const hours = Math.floor((now.getTime() - since.getTime()) / 3_600_000);
  if (hours < 1) return 'under an hour';
  if (hours < 24) return hours === 1 ? '1 hour' : `${hours} hours`;

  const days = Math.floor(hours / 24);

  return days === 1 ? '1 day' : `${days} days`;
}

/**
 * The toast after a publish (`updated` false) or an update, read from the listing the server answered with.
 * `entryHeld` says the changelog entry posted after the update joined it.
 */
export function publishedMessage(
  kind: CatalogKind, updated: boolean, result: ModeratedListing | null | undefined, entryHeld = false,
): string {
  const noun = KIND_LABELS[kind].one;
  if (entryHeld) return `${noun} sent for review with its changelog entry`;
  if (result && awaitsReview(result)) return `${noun} sent for review`;

  return `${noun} ${updated ? 'updated' : 'published'} successfully!`;
}


/**
 * The entries an update adds, as they stand after its later ops: an edit rewrites a held create and a
 * delete drops it. Edits and deletes of approved entries show only in the compare view.
 */
export function heldChangelogEntries(update: PendingUpdate | null | undefined): HeldChangelogEntry[] {
  const held = new Map<string, HeldChangelogEntry>();
  for (const op of update?.changelog ?? []) {
    if (op.op === 'delete') held.delete(op.id);
    else if (op.op === 'create' || held.has(op.id)) held.set(op.id, { id: op.id, title: op.title, body: op.body, date: op.date });
  }

  return [...held.values()];
}

/** How many entries the changelog holds once the update applies: the live ones, plus held creates, minus held deletes. */
export function changelogCountAfter(liveIds: readonly string[], update: PendingUpdate | null | undefined): number {
  const ids = new Set(liveIds);
  for (const op of update?.changelog ?? []) {
    if (op.op === 'create') ids.add(op.id);
    else if (op.op === 'delete') ids.delete(op.id);
  }

  return ids.size;
}

/** The update after a held create the server answered with only the entry. */
export function withHeldCreate(update: PendingUpdate | null | undefined, entry: HeldChangelogEntry): PendingUpdate {
  return {
    fields: {},
    content_changed: false,
    ...update,
    changelog: [...(update?.changelog ?? []), { op: 'create', ...entry }],
  };
}

/** The toast when an edit or delete of a live changelog entry joined the pending update. */
export const HELD_CHANGE_TOAST = 'Your change shows after a mod approves the update';

/** The toast when an update's approval must wait for its contest's results. */
export const JUDGING_APPROVAL_TOAST = "This update waits for the contest results. Approve it after they're announced.";

/**
 * The message the composer opens with after a mod rejects an update.
 *
 * @param target - What was rejected
 */
export function rejectedUpdateTemplate(target: { kind: CatalogKind; name: string }): { subject: string; body: string } {
  const noun = KIND_LABELS[target.kind].one.toLowerCase();

  return {
    subject: `Your update to the ${noun} "${target.name}" was not approved`,
    body: `Your update to **"${target.name}"** was not approved, so players still see the live version.`
      + ' You can send a new update at any time.\n\n**What needs to change:** ',
  };
}
