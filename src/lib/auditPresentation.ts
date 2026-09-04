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
  event_created: 'Event scheduled',
  event_edited: 'Event edited',
  event_cancelled: 'Event canceled',
  event_deleted: 'Event deleted',
  results_announced: 'Results announced',
  podium_edited: 'Podium edited',
  entry_withdrawn: 'Entry withdrawn',
  report_actioned: 'Report actioned',
  report_dismissed: 'Report dismissed',
  like_removed: 'Like removed',
  likes_cleared: 'Likes cleared',
  signals_viewed: 'Linked accounts viewed',
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
  event_created: 'bg-info/10 text-info',
  event_edited: 'bg-info/10 text-info',
  event_cancelled: 'bg-warning/10 text-warning',
  event_deleted: 'bg-destructive/10 text-destructive',
  results_announced: 'bg-success/10 text-success',
  podium_edited: 'bg-info/10 text-info',
  entry_withdrawn: 'bg-muted text-muted-foreground',
  // A decision, not a removal: what was actually done to the content is logged by the act itself.
  report_actioned: 'bg-warning/10 text-warning',
  report_dismissed: 'bg-muted text-muted-foreground',
  like_removed: 'bg-destructive/10 text-destructive',
  likes_cleared: 'bg-destructive/10 text-destructive',
  // Nothing was done to anybody — somebody looked. Tinted as the neutral entry it is.
  signals_viewed: 'bg-muted text-muted-foreground',
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
    case 'event_created':
      return `scheduled the event${name ? ` “${name}”` : ''}`;
    case 'event_edited':
      return `edited the event${name ? ` “${name}”` : ''}`;
    case 'event_cancelled':
      return `canceled the event${name ? ` “${name}”` : ''}`;
    case 'event_deleted':
      return `deleted the event${name ? ` “${name}”` : ''}`;
    // The podium itself is the snippet, so the sentence only says which contest.
    case 'results_announced':
      return `announced the results of${name ? ` “${name}”` : ' a contest'}`;
    case 'podium_edited':
      return `corrected the podium of${name ? ` “${name}”` : ' a contest'}`;
    // The contest it left is the snippet; the sentence names what was pulled.
    case 'entry_withdrawn':
      return target
        ? `withdrew ${name ? `the ${noun ?? 'listing'} “${name}”` : `a ${noun ?? 'listing'}`} by ${target} from a contest`
        : `withdrew their own ${noun ?? 'listing'}${name ? ` “${name}”` : ''} from a contest`;
    // Closed a whole report group; the staff note, if any, is the snippet.
    case 'report_actioned':
      return `acted on the reports${name ? ` about “${name}”` : ''}${target ? ` by ${target}` : ''}`;
    case 'report_dismissed':
      return `dismissed the reports${name ? ` about “${name}”` : ''}${target ? ` by ${target}` : ''}`;
    // Whose like it was, and on what. The listing is the target, so the account it came from is the
    // target user — the reverse of a deletion, where the account owns the thing that went.
    case 'like_removed':
      return target
        ? `removed a like by ${target} on ${name ? `“${name}”` : `a ${noun ?? 'listing'}`}`
        : `removed a like on ${name ? `“${name}”` : `a ${noun ?? 'listing'}`}`;
    // How many went is the whole size of the action, and the snippet is where the server puts it.
    case 'likes_cleared': {
      const count = entry.snippet ? Number(entry.snippet.match(/\d+/)?.[0]) : Number.NaN;
      const many = Number.isFinite(count) ? `${count} ${count === 1 ? 'like' : 'likes'}` : 'every like';

      return `cleared ${many} given by ${target || 'an account'}`;
    }
    // A look, not an act. It is logged because linkage data is the one record that says where a person
    // was, so reading it is accountable too.
    case 'signals_viewed': {
      // Two reads share the action: the accounts linked to one account, and the likes on one listing.
      // What was looked at is what separates them, so the target's kind is what the sentence turns on.
      const kind = entry.target?.kind;
      if (kind && kind !== 'account') {
        return `audited the likes on ${name ? `“${name}”` : `a ${KIND_NOUNS[kind] ?? kind}`}${target ? ` by ${target}` : ''}`;
      }

      return target
        ? `viewed the accounts linked to ${target}`
        : 'viewed the accounts linked to their own account';
    }
    // Unreachable while the switch covers `AuditAction`; kept for a server newer than this build.
    default: {
      const unhandled: never = entry.action;
      void unhandled;
      return 'did something the app does not recognize';
    }
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
