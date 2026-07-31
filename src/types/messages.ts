/** How loud an admin message is; each renders with its own icon and color. Describes the message,
 *  never an action — an `urgent` message does nothing to the account it is sent to. */
export type MessageSeverity = 'info' | 'warning' | 'urgent';

/** Whose name a message is signed with. `team` shows generic branding rather than naming the admin. */
export type MessageSenderMode = 'team' | 'username';

/**
 * How far a message reaches and whether it can be cleared — one escalating choice, because pinning
 * something always means everyone gets it.
 *
 * - `existing` — accounts that predate it; dismissible (the default)
 * - `new` — also accounts created later; dismissible (a welcome message)
 * - `pinned` — also accounts created later, and cannot be dismissed (rules, guidelines)
 *
 * A direct message has no audience to widen, so only `existing` and `pinned` mean anything for one.
 */
export type MessageScope = 'existing' | 'new' | 'pinned';

/** An admin message as its recipient sees it. */
export interface InboxMessage {
  id: string;
  subject: string;
  /** Markdown, authored by an admin. */
  body: string;
  severity: MessageSeverity;
  senderAs: MessageSenderMode;
  /** The sending admin's name, or null when the message is signed as the team. */
  senderName: string | null;
  /** Whether this went to everyone rather than to this user alone. */
  broadcast: boolean;
  scope: MessageScope;
  createdAt: string;
  /** When an admin last rewrote it; null if never edited. */
  editedAt: string | null;
  /** When this user first opened it; null while unread. */
  readAt: string | null;
}

/** The recipient of a 1:1 message, with their receipt. */
export interface SentMessageRecipient {
  id: string;
  username: string;
  readAt: string | null;
  /** Set once the user has cleared it from their inbox; the message itself survives. */
  dismissedAt: string | null;
}

/** A sent message as the admin sees it, carrying whichever receipt shape its audience implies. */
export interface SentMessage {
  id: string;
  subject: string;
  body: string;
  severity: MessageSeverity;
  senderAs: MessageSenderMode;
  senderName: string | null;
  broadcast: boolean;
  scope: MessageScope;
  createdAt: string;
  /** When an admin last rewrote it; null if never edited. */
  editedAt: string | null;
  /** Set once recalled — hidden from every inbox, kept here. */
  recalledAt: string | null;
  /** The single recipient of a 1:1 message; null for a broadcast. */
  recipient: SentMessageRecipient | null;
  /** Broadcasts only: how many eligible users have read it. */
  readCount: number | null;
  /** Broadcasts only: how many users were eligible to see it. */
  eligibleCount: number | null;
}

/** The fields an admin authors, shared by sending and editing. */
export interface MessageDraft {
  subject: string;
  body: string;
  severity: MessageSeverity;
  senderAs: MessageSenderMode;
  scope: MessageScope;
}

/** A send payload. Exactly one of `recipientIds` or `broadcast` applies. */
export interface ComposeMessageInput extends MessageDraft {
  recipientIds?: string[];
  broadcast?: boolean;
}

/** An edit payload. `renotify` re-badges every reader and resets the receipts. */
export interface EditMessageInput extends MessageDraft {
  renotify?: boolean;
}
