/** What an audit entry records. Mirrors the server's `AuditLog.ACTIONS`. */
export const AUDIT_ACTIONS = [
  'user_suspended',
  'user_unsuspended',
  'terms_reset_user',
  'terms_reset_all',
  'listing_deleted',
  'comment_deleted',
  'feedback_deleted',
  'listing_quarantined',
  'quarantine_updated',
  'quarantine_released',
  'quarantine_expired',
  'avatar_removed',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Who did it, as they were at the time. */
export interface AuditActor {
  id: string | null;
  username: string | null;
  /** Whether they were an admin when they did it — an account demoted since still acted as one then. */
  wasAdmin: boolean;
}

/** One recorded event. Every name is a snapshot, so an entry reads after its subject is gone. */
export interface AuditEntry {
  id: number;
  action: AuditAction;
  actor: AuditActor;
  /** The account it was done to, when that is somebody other than the actor. */
  targetUser: { id: string | null; username: string | null } | null;
  /** What it was done to: a kind (`world`, `entity`, `dictionary`, `comment`, `account`, `bug`,
   *  `suggestion`) and its name. */
  target: { kind: string | null; name: string | null } | null;
  /** Enough of what was removed to know what it was; never the whole of it. */
  snippet: string | null;
  createdAt: string;
}
