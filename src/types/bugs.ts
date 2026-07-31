/** What area of the app a report is about. Mirrors the server's `CHECK` constraint. */
export const BUG_CATEGORIES = ['crash', 'ai', 'editor', 'community', 'visuals', 'other'] as const;
export type BugCategory = (typeof BUG_CATEGORIES)[number];

/** Where a report sits in triage. Mirrors the server's `CHECK` constraint. */
export const BUG_STATUSES = ['open', 'need_info', 'confirmed', 'resolved', 'wontfix'] as const;
export type BugStatus = (typeof BUG_STATUSES)[number];

/** What the client reports about itself, shown to the reporter before it is sent. */
export interface BugDiagnostics {
  /** `APP_VERSION` at the time of filing. */
  version?: string;
  /** `desktop` for the Electron shell, `browser` otherwise. */
  platform?: string;
  /** OS and browser as the user agent reports them. */
  system?: string;
}

export interface BugReporter {
  id: string;
  username: string | null;
}

export interface BugReport {
  id: string;
  title: string;
  category: BugCategory;
  body: string;
  status: BugStatus;
  reporter: BugReporter;
  diagnostics: BugDiagnostics;
  createdAt: string;
  updatedAt: string;
  /** Whether this reader has a comment on it they haven't seen. */
  unread: boolean;
}

export interface BugComment {
  id: string;
  body: string;
  createdAt: string;
  /** Set once its author has rewritten it; null otherwise. */
  editedAt: string | null;
  author: {
    id: string;
    username: string | null;
    /** Drives how the thread styles it — a reply from the team reads differently from the reporter's own. */
    isAdmin: boolean;
  };
}

/** A report with its thread, as the detail view holds it. */
export interface BugThread {
  report: BugReport;
  comments: BugComment[];
}

/** The fields a reporter fills in. */
export interface BugDraft {
  title: string;
  category: BugCategory;
  body: string;
}
