import { AUDIT_ACTIONS, type AuditAction, type AuditEntry } from '@/types';
import { ROLE_LABELS, type Role } from '@/lib/roles';

/** How each action reads in the filter and on an entry. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  user_suspended: 'Suspended',
  user_unsuspended: 'Reinstated',
  terms_reset_user: 'Terms reset',
  terms_reset_all: 'Terms reset (everyone)',
  listing_deleted: 'Listing deleted',
  comment_deleted: 'Comment deleted',
  feedback_deleted: 'Feedback deleted',
  listing_quarantined: 'Quarantined',
  quarantine_updated: 'Quarantine updated',
  quarantine_released: 'Released',
  quarantine_expired: 'Quarantine expired',
  avatar_removed: 'Image removed',
  role_changed: 'Role changed',
  feedback_edited: 'Feedback edited',
  report_actioned: 'Report actioned',
  report_dismissed: 'Report dismissed',
};

/** The tint each action carries, so a scan down the list separates removals from the rest. */
export const AUDIT_ACTION_STYLES: Record<AuditAction, string> = {
  user_suspended: 'bg-destructive/10 text-destructive',
  user_unsuspended: 'bg-success/10 text-success',
  terms_reset_user: 'bg-warning/10 text-warning',
  terms_reset_all: 'bg-warning/10 text-warning',
  listing_deleted: 'bg-destructive/10 text-destructive',
  comment_deleted: 'bg-destructive/10 text-destructive',
  feedback_deleted: 'bg-destructive/10 text-destructive',
  listing_quarantined: 'bg-warning/10 text-warning',
  // The author answering the notice — the one hopeful thing that happens inside a quarantine.
  quarantine_updated: 'bg-info/10 text-info',
  quarantine_released: 'bg-success/10 text-success',
  quarantine_expired: 'bg-destructive/10 text-destructive',
  avatar_removed: 'bg-destructive/10 text-destructive',
  role_changed: 'bg-info/10 text-info',
  feedback_edited: 'bg-info/10 text-info',
  // A decision, not a removal: what was actually done to the content is logged by the act itself.
  report_actioned: 'bg-warning/10 text-warning',
  report_dismissed: 'bg-muted text-muted-foreground',
};

/** The filter's options, in the order the server declares them. */
export const AUDIT_ACTION_OPTIONS = AUDIT_ACTIONS.map((value) => ({
  value,
  label: AUDIT_ACTION_LABELS[value],
}));

/** The filter's "no filter" value. A `Select` cannot hold an empty string as an item value. */
export const ANY_ACTION = 'any';

/**
 * The action filter as the list wants it: a real action, or nothing at all.
 *
 * @param value - The dropdown's current value
 * @returns The action to filter by, or undefined for every action
 */
export const actionFilterValue = (value: AuditAction | typeof ANY_ACTION): AuditAction | undefined =>
  (value === ANY_ACTION ? undefined : value);

/** How each target kind reads when an entry names one. */
const KIND_NOUNS: Record<string, string> = {
  world: 'world',
  entity: 'entity',
  dictionary: 'dictionary',
  comment: 'comment on',
  account: 'account',
  bug: 'bug report',
  suggestion: 'suggestion',
};

/**
 * Who the line names as having done it, or null when nobody chose it — a deadline passing has no actor.
 *
 * Split from the sentence so the component can badge them: the role they held is a fact about the
 * person, and a badge inside a run of prose would read as part of what they did.
 *
 * @param entry - The recorded event
 * @returns The actor's name, or null
 */
export function auditActorName(entry: AuditEntry): string | null {
  return entry.action === 'quarantine_expired' ? null : entry.actor.username || 'Someone';
}

/**
 * What happened, with the actor's name left off the front for the caller to render.
 *
 * Built here rather than in the component because it is the entry's whole meaning: the log exists to be
 * read after its subject is gone, so the sentence has to stand on the snapshot alone.
 *
 * @param entry - The recorded event
 * @returns The rest of the sentence — what they did, and to what
 */
export function auditPredicate(entry: AuditEntry): string {
  const target = entry.targetUser?.username;
  const name = entry.target?.name;
  const noun = entry.target?.kind ? KIND_NOUNS[entry.target.kind] ?? entry.target.kind : null;

  switch (entry.action) {
    case 'user_suspended':
      return `suspended ${target || 'an account'}`;
    case 'user_unsuspended':
      return `reinstated ${target || 'an account'}`;
    case 'terms_reset_user':
      return `asked ${target || 'an account'} to accept the terms again`;
    case 'terms_reset_all':
      return `asked everyone to accept the terms again`;
    // Whose it was reads as a trailing `by …` rather than a possessive: usernames routinely end in `s`,
    // and `tam_reads’s comment` is a stumble in the middle of every line it appears in.
    case 'listing_deleted':
      return target
        ? `deleted ${name ? `the ${noun ?? 'listing'} “${name}”` : `a ${noun ?? 'listing'}`} by ${target}`
        : `deleted their own ${noun ?? 'listing'}${name ? ` “${name}”` : ''}`;
    case 'comment_deleted':
      return target
        ? `deleted a comment by ${target}${name ? ` on “${name}”` : ''}`
        : `deleted their own comment${name ? ` on “${name}”` : ''}`;
    case 'feedback_deleted':
      return target
        ? `deleted ${name ? `the ${noun ?? 'thread'} “${name}”` : `a ${noun ?? 'thread'}`} by ${target}`
        : `deleted their own ${noun ?? 'thread'}${name ? ` “${name}”` : ''}`;
    case 'listing_quarantined':
      return target
        ? `quarantined ${name ? `the ${noun ?? 'listing'} “${name}”` : `a ${noun ?? 'listing'}`} by ${target}`
        : `quarantined their own ${noun ?? 'listing'}${name ? ` “${name}”` : ''}`;
    case 'quarantine_updated':
      // The actor here is the author, working on what they were asked to fix.
      return `updated their quarantined ${noun ?? 'listing'}${name ? ` “${name}”` : ''}`;
    case 'quarantine_released':
      return target
        ? `released ${name ? `the ${noun ?? 'listing'} “${name}”` : `a ${noun ?? 'listing'}`} by ${target}`
        : `released their own ${noun ?? 'listing'}${name ? ` “${name}”` : ''}`;
    // Nobody chose this in the moment, so nobody is named for it.
    case 'quarantine_expired':
      return target
        ? `The quarantine ran out on ${name ? `the ${noun ?? 'listing'} “${name}”` : `a ${noun ?? 'listing'}`} by ${target}, and it was deleted`
        : `The quarantine ran out on ${name ? `the ${noun ?? 'listing'} “${name}”` : `a ${noun ?? 'listing'}`}, and it was deleted`;
    case 'avatar_removed':
      return target
        ? `removed the profile image of ${target}`
        : `removed their own profile image`;
    // The snippet carries both ends as "from to", since "made a mod" reads differently depending on
    // what they were before.
    case 'role_changed': {
      const to = entry.snippet ? entry.snippet.split(' to ')[1] : null;
      const who = target || 'an account';
      if (!to) return `changed what ${who} is`;

      return to === 'normal'
        ? `returned ${who} to a normal account`
        : `made ${who} a ${ROLE_LABELS[to as Role]?.toLowerCase() ?? to}`;
    }
    // Only recorded when somebody other than the reporter changed it, so there is always a `by`.
    case 'feedback_edited':
      return target
        ? `edited the ${noun ?? 'thread'}${name ? ` “${name}”` : ''} by ${target}`
        : `edited a ${noun ?? 'thread'}${name ? ` “${name}”` : ''}`;
    default:
      return 'did something the app does not recognize';
  }
}

/**
 * One line saying what happened, in the reader's terms — the actor and the rest, joined.
 *
 * @param entry - The recorded event
 * @returns A sentence naming the actor, what they did, and to what
 */
export function describeAuditEntry(entry: AuditEntry): string {
  const actor = auditActorName(entry);

  return actor ? `${actor} ${auditPredicate(entry)}` : auditPredicate(entry);
}

// An entry timestamp is a server timestamp like any other — see `lib/serverDate`.
export { formatServerDateTime as formatAuditDate } from './serverDate';
