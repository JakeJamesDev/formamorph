import type { WorldRecord } from "@/components/WorldDetails";
import { kindOf } from "@/lib/catalogKinds";
import { moderationStatus } from "@/lib/listingModeration";
import type { ReviewOutcome, ReviewRejection, ReviewSubject } from "@/services/ReviewService";

/** A catalog row's listing id, whichever key the server filled. */
export const listingIdOf = (world: WorldRecord): string => String(world._id || world.id);

/** A catalog row as the review decision names it. */
export const reviewSubjectOf = (world: WorldRecord): ReviewSubject => {
  const status = moderationStatus(world);
  const author = world.author as { id?: unknown; username?: unknown; avatarUrl?: unknown; role?: unknown } | null | undefined;
  return {
    id: listingIdOf(world),
    kind: kindOf(world),
    name: String(world.name ?? ''),
    type: status === 'updatePending' ? 'update' : status === 'resubmitted' ? 'resubmitted' : 'new',
    author: author?.id ? {
      id: String(author.id),
      username: typeof author.username === 'string' ? author.username : null,
      avatarUrl: typeof author.avatarUrl === 'string' ? author.avatarUrl : null,
      role: typeof author.role === 'string' ? author.role : null,
    } : null,
  };
};

const NO_PENDING_UPDATE = { has_pending_update: false, pending_update: null, pending_preview: null };

/** A row as a settled decision leaves it, until the re-sync brings the server's copy. */
export const decidedRow = (
  world: WorldRecord, subject: ReviewSubject, outcome: Exclude<ReviewOutcome, 'kept' | 'dropped'>,
  rejection?: ReviewRejection,
): WorldRecord => {
  if (subject.type === 'update') {
    const preview = world.pending_preview as { name?: unknown } | null | undefined;
    return outcome === 'approved'
      ? { ...world, ...NO_PENDING_UPDATE, name: typeof preview?.name === 'string' ? preview.name : world.name }
      : { ...world, ...NO_PENDING_UPDATE };
  }
  // Approval ends any quarantine; a rejected resubmission keeps its own deadline.
  return outcome === 'approved'
    ? { ...world, moderation_state: 'approved', quarantined_at: null, quarantine_expires_at: null, quarantine_extended: 0 }
    : {
      ...world,
      moderation_state: 'rejected',
      quarantined_at: rejection?.quarantinedAt ?? world.quarantined_at,
      quarantine_expires_at: rejection?.quarantineExpiresAt ?? world.quarantine_expires_at,
      quarantine_extended: rejection?.quarantineExtended ? 1 : world.quarantine_extended,
    };
};
