/**
 * Pure reasoning about the staff side of a timed server event: which state it is in, which group of the
 * Events tab it belongs to, and which controls its row offers whom. No React, no network — the tab, its
 * dialogs and their tests all read the same answers from here.
 *
 * The state is derived rather than read off the row, the way the server derives it: the only stateful
 * stamp an event carries is its cancellation, and a list built from a `state` field would be stale the
 * moment a window closed between two reads.
 */
import { parseServerDate } from './serverDate';
import { PLACE_LABELS } from './placeLabels';
import { isContestEvent, placementsOf, resultsAnnounced } from './serverEvents';
import type { ServerEvent } from '@/types';

/**
 * Where an event stands, as staff see it.
 *
 * `judging` is a contest whose window has closed with its results still to come — the one state that asks
 * something of whoever is looking, which is why it is told apart from `ended` rather than folded into it.
 */
export type AdminEventState = 'active' | 'judging' | 'scheduled' | 'ended' | 'canceled';

/** How each state reads on its badge. */
export const ADMIN_EVENT_STATE_LABELS: Record<AdminEventState, string> = {
  active: 'Active',
  judging: 'Judging',
  scheduled: 'Scheduled',
  ended: 'Ended',
  canceled: 'Canceled',
};

/** The tint each state badge carries, so the five read apart at a glance. */
export const ADMIN_EVENT_STATE_STYLES: Record<AdminEventState, string> = {
  active: 'bg-success/10 text-success',
  judging: 'bg-warning/10 text-warning',
  scheduled: 'bg-info/10 text-info',
  ended: 'bg-muted text-muted-foreground',
  canceled: 'bg-destructive/10 text-destructive',
};

/**
 * Which of the five states an event is in.
 *
 * @param now - The instant to judge against; defaults to the current time
 */
export function adminEventState(event: ServerEvent, now: Date = new Date()): AdminEventState {
  if (event.cancelledAt) return 'canceled';

  const starts = parseServerDate(event.startsAt);
  const ends = parseServerDate(event.endsAt);

  // An unreadable window is shown as over rather than as running: a banner nobody can date is one
  // nothing should be posted about.
  if (!starts || !ends) return 'ended';

  if (now.getTime() < starts.getTime()) return 'scheduled';
  if (now.getTime() < ends.getTime()) return 'active';

  return isContestEvent(event) && !resultsAnnounced(event) ? 'judging' : 'ended';
}

/** The three groups the Events tab lists, in the order it lists them. */
export interface AdminEventGroups {
  /** Running now, and contests waiting on their results. */
  happeningNow: ServerEvent[];
  scheduled: ServerEvent[];
  past: ServerEvent[];
}

/**
 * Split events into the tab's three groups, newest window first within each.
 *
 * Canceled events are an administrator's business: a called-off event is a decision to explain, and a
 * moderator's read of the calendar is about what is happening rather than what was withdrawn.
 *
 * @param viewerIsAdmin - Whether the viewer may create and withdraw events
 * @param now - The instant to judge against; defaults to the current time
 */
export function groupAdminEvents(
  events: ServerEvent[],
  viewerIsAdmin: boolean,
  now: Date = new Date(),
): AdminEventGroups {
  const groups: AdminEventGroups = { happeningNow: [], scheduled: [], past: [] };

  for (const event of events) {
    const state = adminEventState(event, now);
    if (state === 'canceled' && !viewerIsAdmin) continue;

    if (state === 'active' || state === 'judging') groups.happeningNow.push(event);
    else if (state === 'scheduled') groups.scheduled.push(event);
    else groups.past.push(event);
  }

  const newestFirst = (a: ServerEvent, b: ServerEvent) =>
    (parseServerDate(b.startsAt)?.getTime() ?? 0) - (parseServerDate(a.startsAt)?.getTime() ?? 0);

  groups.happeningNow.sort(newestFirst);
  groups.scheduled.sort(newestFirst);
  groups.past.sort(newestFirst);

  return groups;
}

/**
 * The two role views the Events tab has, for the dev-router to land on either.
 *
 * Which one a real session gets follows its account; naming them is what lets the read-only half be
 * checked without a second account and a live server.
 */
export const EVENTS_TAB_ROLE_VIEWS = ['admin', 'staff'] as const;

/** Which controls an event's row offers. Everything false is a read-only row. */
export interface AdminEventActions {
  /** Open the podium dialog to assemble and publish a contest's results. */
  announceResults: boolean;
  /** Reopen the same dialog over a podium already announced, to correct it. */
  editPodium: boolean;
  edit: boolean;
  cancel: boolean;
  remove: boolean;
}

/**
 * The controls to show on an event's row.
 *
 * The whole podium is an administrator's, announcing and correcting alike. It ends a contest and speaks
 * to everyone at once, exactly as scheduling and withdrawing an event do — a tightening from the pick any
 * staff could once make, and the reason the moderation team reads this calendar rather than deciding on
 * it. What a viewer may not do is hidden rather than disabled: a control that only ever refuses is a
 * worse answer than no control.
 *
 * Deleting is offered only before a start. Once a notice has gone out there is something to explain,
 * and the honest record of that is a cancellation.
 *
 * @param viewerIsAdmin - Whether the viewer may create and withdraw events
 * @param now - The instant to judge against; defaults to the current time
 */
export function adminEventActions(
  event: ServerEvent,
  viewerIsAdmin: boolean,
  now: Date = new Date(),
): AdminEventActions {
  const state = adminEventState(event, now);
  const podium = viewerIsAdmin && isContestEvent(event) && !event.cancelledAt;

  return {
    announceResults: podium && state === 'judging',
    editPodium: podium && resultsAnnounced(event),
    edit: viewerIsAdmin && (state === 'active' || state === 'judging' || state === 'scheduled'),
    cancel: viewerIsAdmin && (state === 'active' || state === 'judging'),
    remove: viewerIsAdmin && state === 'scheduled',
  };
}

/**
 * The one line under an event's title saying where it stands.
 *
 * @param now - The instant to judge against; defaults to the current time
 */
export function adminEventSummary(event: ServerEvent, now: Date = new Date()): string {
  const state = adminEventState(event, now);

  if (state === 'canceled') return 'Canceled — entries released and notices recalled';
  if (state === 'scheduled') return 'Not started — staff only until it opens';
  if (state === 'judging') return 'Closed for entries — waiting on the results';
  if (state === 'active') return isContestEvent(event) ? 'Open for entries' : 'Banner live';

  const podium = placementsOf(event);
  if (isContestEvent(event) && podium.length > 0) {
    const [gold] = podium;
    const runnersUp = podium.length - 1;
    return `${PLACE_LABELS[1]}: ${gold.worldName} — ${gold.authorName}`
      + (runnersUp > 0 ? ` (+${runnersUp} more)` : '');
  }
  return 'Over';
}

/** Two digits, the way a `datetime-local` field wants every part of its value. */
const pad = (value: number) => String(value).padStart(2, '0');

/**
 * A server timestamp as a `datetime-local` field's value.
 *
 * The field speaks local wall-clock with no zone, so the instant is broken up in the viewer's own zone —
 * `toISOString` here would show an admin in Berlin a window two hours from the one they set.
 *
 * @returns The `YYYY-MM-DDTHH:mm` value, or empty when the timestamp cannot be read
 */
export function toLocalInputValue(timestamp: string | null | undefined): string {
  const date = timestamp ? parseServerDate(timestamp) : null;
  if (!date) return '';

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * A `datetime-local` value as the ISO instant the server compares against.
 *
 * @returns The instant, or null when the field is empty or holds something unreadable
 */
export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Why an entry cannot be given a place, or null when it can. Every place, not only gold. */
export function entryBlockReason(
  entry: { authorId: string | null; quarantined: boolean },
  judgeId: string | null,
): string | null {
  if (entry.quarantined) return 'Quarantined';
  if (judgeId && entry.authorId && entry.authorId === judgeId) return 'Your entry';
  return null;
}
