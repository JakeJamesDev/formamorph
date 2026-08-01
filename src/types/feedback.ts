/** The two branches of the feedback tree. Mirrors the server's `CHECK` constraint. */
export const FEEDBACK_TYPES = ['bug', 'suggestion'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/** What a bug report is about. Mirrors the server's per-type `CHECK`. */
export const BUG_CATEGORIES = ['crash', 'ai', 'editor', 'community', 'visuals', 'other'] as const;
export type BugCategory = (typeof BUG_CATEGORIES)[number];

/** What a suggestion is about. A separate list: 'crash' is not a thing to suggest. */
export const SUGGESTION_CATEGORIES = ['gameplay', 'writing', 'editor', 'community', 'interface', 'other'] as const;
export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];

export type FeedbackCategory = BugCategory | SuggestionCategory;

/** Where a bug sits in triage. Mirrors the server's per-type `CHECK`. */
export const BUG_STATUSES = ['open', 'need_info', 'confirmed', 'resolved', 'wontfix'] as const;
export type BugStatus = (typeof BUG_STATUSES)[number];

/** Where a suggestion sits. A bug is triaged towards a fix; a suggestion is weighed, then committed to
 *  or turned down, so 'confirmed' and 'planned' are different promises. */
export const SUGGESTION_STATUSES = ['open', 'considering', 'planned', 'declined', 'done'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export type FeedbackStatus = BugStatus | SuggestionStatus;

/** What the client reports about itself, shown to the reporter before it is sent. Bugs only. */
export interface BugDiagnostics {
  /** `APP_VERSION` at the time of filing. */
  version?: string;
  /** `desktop` for the Electron shell, `browser` otherwise. */
  platform?: string;
  /** OS and browser as the user agent reports them. */
  system?: string;
}

export interface FeedbackReporter {
  id: string | null;
  username: string | null;
  /** Their profile image, or null when they have none. Root-relative; see `avatarSrc`. */
  avatarUrl?: string | null;
}

/** One piece of feedback — a bug report or a suggestion — as any reader of it sees it. */
export interface FeedbackThread {
  id: string;
  type: FeedbackType;
  title: string;
  category: FeedbackCategory;
  body: string;
  status: FeedbackStatus;
  reporter: FeedbackReporter;
  /** Always empty on a suggestion: none is collected. */
  diagnostics: BugDiagnostics;
  /** Whether an admin has closed it to further replies. */
  locked: boolean;
  /** Suggestions only; a bug is never voted for. */
  votes: number;
  /** Whether the vote count includes this reader's. */
  voted: boolean;
  createdAt: string;
  updatedAt: string;
  /** Whether this reader has a comment on it they haven't seen. */
  unread: boolean;
}

export interface FeedbackComment {
  id: string;
  body: string;
  createdAt: string;
  /** Set once its author has rewritten it; null otherwise. */
  editedAt: string | null;
  author: {
    id: string | null;
    username: string | null;
    /** Their profile image, or null when they have none. Root-relative; see `avatarSrc`. */
    avatarUrl?: string | null;
    /** Drives how the thread styles it — a reply from the team reads differently from anyone else's. */
    isAdmin: boolean;
  };
}

/** A thread with its comments, as the detail view holds it. */
export interface FeedbackDetail {
  thread: FeedbackThread;
  comments: FeedbackComment[];
}

/** The fields somebody fills in to file one. */
export interface FeedbackDraft {
  type: FeedbackType;
  title: string;
  category: FeedbackCategory;
  body: string;
}
