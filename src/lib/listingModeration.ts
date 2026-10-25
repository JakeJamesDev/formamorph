import { KIND_LABELS, type CatalogKind } from '@/lib/catalogKinds';
import { isQuarantined } from '@/lib/quarantine';

/** Where a listing stands in review, as its author and the staff read it. */
export type ModerationStatus = 'live' | 'pending' | 'updatePending' | 'rejected' | 'resubmitted';

/** One changed field in a pending update: what players see now, and what replaces it on approval. */
export interface PendingFieldChange {
  approved: unknown;
  pending: unknown;
}

/** The waiting edit to an approved listing, as the server sends it to the author and the staff. */
export interface PendingUpdate {
  fields?: Record<string, PendingFieldChange>;
  changelog?: unknown[];
  content_changed?: boolean;
  thumbnail_url?: string;
}

/** A listing as a view holds it. Every field is optional: a player and an old server get none of them. */
interface ModeratedListing {
  moderation_state?: unknown;
  has_pending_update?: unknown;
  pending_update?: PendingUpdate | null;
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

/** Display order for the fields an update can change. Fields the server adds later sort after these. */
const FIELD_ORDER = [
  'name', 'description', 'tags', 'thumbnail', 'content', 'visibility', 'spoiler', 'dependencies',
  'compatibility', 'model_license', 'models',
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
  dependencies: 'Dependencies',
  compatibility: 'Compatibility',
  model_license: 'Model License',
  models: 'Models',
};

/**
 * The fields a pending update changes, in display order, empty when there is no update.
 *
 * Content has no before-and-after values in `fields`, so its flag adds it.
 */
export function changedFields(update: PendingUpdate | null | undefined): string[] {
  if (!update) return [];

  const names = new Set(Object.keys(update.fields ?? {}));
  if (update.content_changed) names.add('content');

  const rank = (name: string) => {
    const at = (FIELD_ORDER as readonly string[]).indexOf(name);
    return at === -1 ? FIELD_ORDER.length : at;
  };

  return [...names].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** The label for a changed field. */
export const fieldLabel = (name: string): string => FIELD_LABELS[name] ?? name;

/** Whether a listing waits for a mod: a new or resubmitted listing, or an update. */
export const awaitsReview = (listing: ModeratedListing): boolean => {
  const status = moderationStatus(listing);
  return status === 'pending' || status === 'resubmitted' || status === 'updatePending';
};

/** The toast after a publish (`updated` false) or an update, read from the listing the server answered with. */
export function publishedMessage(kind: CatalogKind, updated: boolean, result: ModeratedListing | null | undefined): string {
  const noun = KIND_LABELS[kind].one;
  if (result && awaitsReview(result)) return `${noun} sent for review`;

  return `${noun} ${updated ? 'updated' : 'published'} successfully!`;
}
