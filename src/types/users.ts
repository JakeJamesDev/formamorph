import type { CatalogKind } from '@/lib/catalogKinds';

/**
 * The public face of an account: what a stranger sees when they click a name.
 *
 * Deliberately narrow. The email, the status and the account type belong to the admin table; this is
 * the subset the server will hand to anybody, signed in or not.
 */
export interface PublicProfile {
  id: string;
  username: string;
  /** Their profile image, or null when they have none. Root-relative; see `avatarSrc`. */
  avatarUrl: string | null;
  /** When the account was created, as a server timestamp — see `lib/serverDate`. */
  createdAt: string;
  /** Their staff role, or null for an ordinary account. Public: being on the team is not a private fact. */
  role?: string | null;
  /** How many accounts follow them. Public; who they are is not. */
  followers: number;
  /**
   * What their published work has earned, across every kind.
   *
   * Counted over the catalog rather than over what this reader may see, so an author's own profile says
   * the same thing as the one they hand somebody else — their quarantined work is listed to them below
   * with its own numbers, and sits out of these until it is back in the catalog.
   */
  likes: number;
  downloads: number;
  /**
   * Whether the signed-in reader follows them.
   *
   * Absent rather than false for a signed-out visitor: somebody with no account has not decided against
   * following anybody, and the button should be missing rather than offering to follow.
   */
  following?: boolean;
}

/**
 * One published listing, as somebody's profile lists it.
 *
 * A narrow read of the catalog row rather than the row itself: the profile shows a name, a picture and
 * two numbers, and carrying the description, tags and author of every listing to fill a popup list would
 * send far more than it draws.
 */
export interface ProfileCreation {
  id: string;
  name: string;
  kind: CatalogKind;
  /** The stored thumbnail's filename, or null when it has none. Cached by name; see `CachedThumbnail`. */
  thumbnailFile: string | null;
  downloads: number;
  commentCount: number;
  /** How many accounts have liked it. Never a control here — the profile lists work rather than rates it. */
  likes: number;
  /** When it last changed, as a server timestamp — also what the thumbnail cache is keyed against. */
  updatedAt: string;
  /** When it was published, as a server timestamp. The list is newest-first by this. */
  createdAt: string;
  /**
   * Whether it is currently hidden from the catalog.
   *
   * Only ever true for a reader who may see it anyway — its own author, or the staff. Everybody else is
   * not shown the listing at all, rather than shown it marked.
   */
  quarantined: boolean;
}

/** Somebody the reader follows, as the manage list shows them. */
export interface FollowedUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  /** Their staff role, or null for an ordinary account. */
  role?: string | null;
  /** When the follow started — also the point the feed counts from. */
  followedAt: string;
}

/** What happened to a listing, from a follower's point of view. */
export type FeedEvent = 'published' | 'updated';

/** One row of the notification feed: a listing somebody you follow has published or revised. */
export interface FeedItem {
  id: string;
  name: string;
  kind: string;
  event: FeedEvent;
  /** When it last changed, as a server timestamp. */
  at: string;
  author: {
    id: string;
    username: string;
    avatarUrl: string | null;
    /** Their staff role, or null for an ordinary account. */
    role?: string | null;
  };
}
