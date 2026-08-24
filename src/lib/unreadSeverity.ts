/**
 * How loud each waiting thing is, and what color says so.
 *
 * One ladder across three channels that have nothing else in common: an admin message carries its own
 * severity, while a feedback reply and a follow carry none, so they sit below the quietest message.
 * Everything routine wears the theme's accent, whoever sent it; only a message loud enough to warn or
 * suspend gets its own color, which is the distinction worth one.
 *
 * The badge on the profile circle is one number over all three, so it takes the color of the loudest
 * thing in it. Ties need no tiebreak: two things of equal rank are the same color by definition, so
 * ordering them further could not change a pixel.
 */

/** Every kind of waiting thing, quietest first. Index is the rank. */
export const UNREAD_KINDS = ['follow', 'feedback', 'info', 'warning', 'urgent'] as const;
export type UnreadKind = (typeof UNREAD_KINDS)[number];

/** What the row and the badge are painted with. Tailwind classes, so they follow the theme. */
export const UNREAD_MARK_STYLES: Record<UnreadKind, { mark: string; badge: string }> = {
  follow: { mark: 'bg-primary', badge: 'bg-primary text-primary-foreground' },
  feedback: { mark: 'bg-primary', badge: 'bg-primary text-primary-foreground' },
  // Routine messages share the accent: only the ladder's rank, not its color, says "admin".
  info: { mark: 'bg-primary', badge: 'bg-primary text-primary-foreground' },
  warning: { mark: 'bg-warning', badge: 'bg-warning text-warning-foreground' },
  urgent: { mark: 'bg-destructive', badge: 'bg-destructive text-destructive-foreground' },
};

/** An admin message's severity as a kind. Anything unrecognized is the quietest a message can be. */
export function kindOfSeverity(severity: string | null | undefined): UnreadKind {
  return severity === 'urgent' || severity === 'warning' ? severity : 'info';
}

/**
 * The loudest of everything waiting, or null when nothing is.
 *
 * @param kinds - One entry per channel with something in it; absent channels are simply not passed
 * @returns The kind that should color the badge
 */
export function loudest(kinds: Array<UnreadKind | null | undefined>): UnreadKind | null {
  let winner: UnreadKind | null = null;
  for (const kind of kinds) {
    if (!kind) continue;
    if (!winner || UNREAD_KINDS.indexOf(kind) > UNREAD_KINDS.indexOf(winner)) winner = kind;
  }

  return winner;
}

/** What the three channels are each holding, as the main menu knows it. */
export interface UnreadTally {
  messages: number;
  /** The loudest unread message's severity. Ignored when `messages` is zero. */
  messageSeverity?: string | null;
  /** Omitted where feedback is badged elsewhere, which is not the same as a channel holding nothing. */
  feedback?: number;
  follows: number;
}

/**
 * What color the badge on the profile circle takes.
 *
 * A channel with nothing in it is not in the running, however loud it would be if it were — an empty
 * inbox must not paint the badge over somebody's bug replies.
 *
 * @param tally - What each channel is holding
 * @returns The kind to paint with, or null when nothing is waiting anywhere
 */
export function badgeKind(tally: UnreadTally): UnreadKind | null {
  return loudest([
    tally.messages > 0 ? kindOfSeverity(tally.messageSeverity) : null,
    tally.feedback && tally.feedback > 0 ? 'feedback' : null,
    tally.follows > 0 ? 'follow' : null,
  ]);
}
