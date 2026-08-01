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
   * Whether the signed-in reader follows them.
   *
   * Absent rather than false for a signed-out visitor: somebody with no account has not decided against
   * following anybody, and the button should be missing rather than offering to follow.
   */
  following?: boolean;
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
