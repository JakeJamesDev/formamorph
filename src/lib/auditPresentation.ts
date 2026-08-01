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
  entity: 'character',
  dictionary: 'dictionary',
  comment: 'comment on',
  account: 'account',
  bug: 'bug report',
  suggestion: 'suggestion',
};

/**
 * One line saying what happened, in the reader's terms.
 *
 * Built here rather than in the component because it is the entry's whole meaning: the log exists to be
 * read after its subject is gone, so the sentence has to stand on the snapshot alone.
 *
 * @param entry - The recorded event
 * @returns A sentence naming the actor, what they did, and to what
 */
export function describeAuditEntry(entry: AuditEntry): string {
  const actor = entry.actor.username || 'Someone';
  const target = entry.targetUser?.username;
  const name = entry.target?.name;
  const noun = entry.target?.kind ? KIND_NOUNS[entry.target.kind] ?? entry.target.kind : null;

  switch (entry.action) {
    case 'user_suspended':
      return `${actor} suspended ${target || 'an account'}`;
    case 'user_unsuspended':
      return `${actor} reinstated ${target || 'an account'}`;
    case 'terms_reset_user':
      return `${actor} asked ${target || 'an account'} to accept the terms again`;
    case 'terms_reset_all':
      return `${actor} asked everyone to accept the terms again`;
    // Whose it was reads as a trailing `by …` rather than a possessive: usernames routinely end in `s`,
    // and `tam_reads’s comment` is a stumble in the middle of every line it appears in.
    case 'listing_deleted':
      return target
        ? `${actor} deleted ${name ? `the ${noun ?? 'listing'} “${name}”` : `a ${noun ?? 'listing'}`} by ${target}`
        : `${actor} deleted their own ${noun ?? 'listing'}${name ? ` “${name}”` : ''}`;
    case 'comment_deleted':
      return target
        ? `${actor} deleted a comment by ${target}${name ? ` on “${name}”` : ''}`
        : `${actor} deleted their own comment${name ? ` on “${name}”` : ''}`;
    case 'feedback_deleted':
      return target
        ? `${actor} deleted ${name ? `the ${noun ?? 'thread'} “${name}”` : `a ${noun ?? 'thread'}`} by ${target}`
        : `${actor} deleted their own ${noun ?? 'thread'}${name ? ` “${name}”` : ''}`;
    case 'listing_quarantined':
      return target
        ? `${actor} quarantined ${name ? `the ${noun ?? 'listing'} “${name}”` : `a ${noun ?? 'listing'}`} by ${target}`
        : `${actor} quarantined their own ${noun ?? 'listing'}${name ? ` “${name}”` : ''}`;
    case 'quarantine_updated':
      // The actor here is the author, working on what they were asked to fix.
      return `${actor} updated their quarantined ${noun ?? 'listing'}${name ? ` “${name}”` : ''}`;
    case 'quarantine_released':
      return target
        ? `${actor} released ${name ? `the ${noun ?? 'listing'} “${name}”` : `a ${noun ?? 'listing'}`} by ${target}`
        : `${actor} released their own ${noun ?? 'listing'}${name ? ` “${name}”` : ''}`;
    // Nobody chose this in the moment, so nobody is named for it.
    case 'quarantine_expired':
      return target
        ? `The quarantine ran out on ${name ? `the ${noun ?? 'listing'} “${name}”` : `a ${noun ?? 'listing'}`} by ${target}, and it was deleted`
        : `The quarantine ran out on ${name ? `the ${noun ?? 'listing'} “${name}”` : `a ${noun ?? 'listing'}`}, and it was deleted`;
    case 'avatar_removed':
      return target
        ? `${actor} removed the profile image of ${target}`
        : `${actor} removed their own profile image`;
    // The snippet carries both ends as "from to", since "made a mod" reads differently depending on
    // what they were before.
    case 'role_changed': {
      const to = entry.snippet ? entry.snippet.split(' to ')[1] : null;
      const who = target || 'an account';
      if (!to) return `${actor} changed what ${who} is`;

      return to === 'normal'
        ? `${actor} returned ${who} to a normal account`
        : `${actor} made ${who} a ${ROLE_LABELS[to as Role]?.toLowerCase() ?? to}`;
    }
    // Only recorded when somebody other than the reporter changed it, so there is always a `by`.
    case 'feedback_edited':
      return target
        ? `${actor} edited the ${noun ?? 'thread'}${name ? ` “${name}”` : ''} by ${target}`
        : `${actor} edited a ${noun ?? 'thread'}${name ? ` “${name}”` : ''}`;
    default:
      return `${actor} did something the app does not recognize`;
  }
}

// An entry timestamp is a server timestamp like any other — see `lib/serverDate`.
export { formatServerDateTime as formatAuditDate } from './serverDate';
