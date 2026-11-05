import type { LikesMarkerReason } from '@/types';

interface MarkedLike {
  likes_marker?: unknown;
}

const REASONS: readonly LikesMarkerReason[] = ['burst', 'flagged_share'];

/** What each reason reads as, on the marker and in the audit. Lowercase, so two can join in one phrase. */
const LIKES_MARKER_LABELS: Record<LikesMarkerReason, string> = {
  burst: 'burst of likes',
  flagged_share: 'many flagged likes',
};

/** The reasons a staff row carries, in the server's fixed order. Empty for a player's row or an unmarked one. */
export function likesMarkerOf(listing: MarkedLike | null | undefined): LikesMarkerReason[] {
  const raw = listing?.likes_marker;
  if (!Array.isArray(raw)) return [];

  return REASONS.filter((reason) => raw.includes(reason));
}

/** Whether the row carries at least one reason. */
export const isLikesMarked = (listing: MarkedLike | null | undefined): boolean => likesMarkerOf(listing).length > 0;

/** "Burst of likes", "Many flagged likes" or "Burst of likes and many flagged likes". */
export const describeLikesMarker = (reasons: readonly LikesMarkerReason[]): string => {
  const phrase = reasons.map((reason) => LIKES_MARKER_LABELS[reason]).join(' and ');
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
};
