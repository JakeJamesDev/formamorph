/**
 * The like fields a listing record carries. The server leaves `likes` out and sets `likesHidden` on a
 * contest entry whose count this reader may not see, and sets `likesPrivate` when only the author and
 * staff see it.
 */
export interface LikeFields {
  likes?: unknown;
  likesHidden?: unknown;
  likesPrivate?: unknown;
}

/** What a like count shows to this reader. */
export type LikeCount =
  | { visibility: 'public'; likes: number }
  | { visibility: 'private'; likes: number }
  | { visibility: 'hidden' };

/** The like state a press or a reply leaves on a record. */
export interface LikeState {
  liked?: boolean;
  likes?: number;
  likesHidden?: boolean;
  likesPrivate?: boolean;
}

/** Read what a listing's like count shows. A record with no flags reads as a plain number. */
export function likeCountOf(record: LikeFields): LikeCount {
  if (record.likesHidden === true) return { visibility: 'hidden' };

  const likes = Number(record.likes ?? 0) || 0;
  return record.likesPrivate === true ? { visibility: 'private', likes } : { visibility: 'public', likes };
}

/** The number a likes sort compares. A hidden count sorts as 0, so its place shows no rank. */
export function likesForSort(record: LikeFields): number {
  const count = likeCountOf(record);
  return count.visibility === 'hidden' ? 0 : count.likes;
}

/** The state to show while a like press is in the air. A hidden count gets no guessed number. */
export function optimisticLikeState(record: LikeFields & { liked?: unknown }, liked: boolean): LikeState {
  const count = likeCountOf(record);
  if (count.visibility === 'hidden') return { liked, likesHidden: true };

  const likes = Math.max(0, count.likes + (liked ? 1 : -1));
  return count.visibility === 'private' ? { liked, likes, likesPrivate: true } : { liked, likes };
}
