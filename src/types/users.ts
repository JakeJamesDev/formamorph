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
  /** Their profile image, or null when they have none. Root-relative; see `serverAssetSrc`. */
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

/**
 * One account that liked a listing, as the likers list shows it.
 *
 * Staff-only: the room sees a count, and who is behind it is the moderation surface's business alone.
 * Carries the signup and the like together so the list can say how old the account was at the moment —
 * a cluster of accounts made minutes before they liked is the whole thing this list exists to find.
 */
export interface LikerRow {
  id: string;
  username: string;
  /** Their profile image, or null when they have none. Root-relative; see `serverAssetSrc`. */
  avatarUrl: string | null;
  /** Their account status, in the same words the user table's pill uses. */
  status: string | null;
  /** When the account was created, as a server timestamp — see `lib/serverDate`. */
  createdAt: string;
  /** When they liked, as a server timestamp. The list is newest-first by this. */
  likedAt: string;
  /** The gap between the two, as the server counted it. Absent on a server that predates the field. */
  accountAgeAtLikeSeconds?: number;
  /**
   * Their staff role, when the server sends one.
   *
   * Absent today, so the client cannot mirror the staff ladder on a staff liker and the server's refusal
   * is what the reader sees instead. A one-line server follow-up closes that; until then a row with no
   * role is treated as an ordinary account.
   */
  role?: string | null;
}

/**
 * One liker with the Signals behind their like read across, as the audit shows them.
 *
 * The plain row already says how old the account was when it liked. These two fields say the other half:
 * whether this account acted from the same address as other likers, and whether it acted from the
 * author's. Evidence for a person to weigh — a household shares an address too.
 */
export interface LikerAuditRow extends LikerRow {
  /**
   * Which set of likers sharing an address this one belongs to, or null when it shares with nobody.
   *
   * A number rather than a name, and only meaningful within one response: it says which rows go
   * together, not which group this is across listings or across reads.
   */
  groupId: number | null;
  /** Whether this account acted from an address the listing's author also acted from. */
  linkedToAuthor: boolean;
}

/** One listing an account has liked, as the profile's Likes tab lists it. Staff-only, like `LikerRow`. */
export interface LikeGiven {
  id: string;
  name: string;
  authorId: string | null;
  authorUsername: string | null;
  /** Whether the listing is currently hidden from the catalog. A like on a hidden listing still counts. */
  quarantined: boolean;
  /** When they liked, as a server timestamp. The list is newest-first by this. */
  likedAt: string;
}

/** One recorded moment behind a link: what an account did, when, and from which browser family. */
export interface LinkedMoment {
  /** `signup`, `login`, `like`, `publish`, `comment` or `follow`. */
  event: string;
  /** When it happened, as a server timestamp — see `lib/serverDate`. */
  at: string;
  /** The coarse `Browser/OS` the request arrived with, or `Other/Other`. */
  browserFamily: string;
}

/** Another account that acted from one of a subject's network addresses, with both sides of the link.
 *  Staff-only, and evidence for a person rather than a verdict — nothing acts on it. */
export interface LinkedAccount {
  id: string;
  username: string;
  /** Their account status, in the same words the user table's pill uses. */
  status: string | null;
  /** When the account was created, as a server timestamp — see `lib/serverDate`. */
  createdAt: string;
  /** What they did from the shared address, newest first. Capped by the server. */
  events: LinkedMoment[];
  /** How many moments are on their side in all, so a capped list can say what it left out. */
  eventsTotal: number;
  /** What the subject did from the same address, newest first. Capped the same way. */
  subjectEvents: LinkedMoment[];
  /** How many moments are on the subject's side in all. */
  subjectEventsTotal: number;
}
