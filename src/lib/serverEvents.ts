/**
 * Pure reasoning about a timed server event: which type it is, which half of its life a player is
 * looking at, and how long is left. No React, no storage — the banner, the modal and their tests all
 * read the same answers from here.
 */
import { DAY_MS, parseServerDate } from './serverDate';
import type { ServerEvent, ServerEventPhase } from '@/types';

/** Whether this event unlocks the contest extras (entries, rules, the contest tab). */
export function isContestEvent(event: ServerEvent): boolean {
  return event.type === 'contest';
}

/**
 * Whether a contest's winner has been picked.
 *
 * The pick stamps the world and the snapshot names in one write, so either answers it. The broadcast it
 * then posts is not part of the answer: the announcement can fail where the pick stood, and a contest
 * decided without a notice is still decided.
 */
export function hasWinner(event: ServerEvent): boolean {
  return Boolean(event.winnerWorldId || event.winnerName);
}

/**
 * Which phase to show for an event: its ending once the window has closed or a winner has been named,
 * its opening until then.
 *
 * @param now - The instant to judge against; defaults to the current time
 */
export function eventPhase(event: ServerEvent, now: Date = new Date()): ServerEventPhase {
  if (hasWinner(event)) return 'end';
  const ends = parseServerDate(event.endsAt);
  return ends && ends.getTime() <= now.getTime() ? 'end' : 'start';
}

/** The broadcast an acknowledgment of this phase should mark read; null when the event carries none. */
export function phaseMessageId(event: ServerEvent, phase: ServerEventPhase): string | null {
  if (phase === 'start') return event.startMessageId;
  return event.winnerMessageId ?? event.endMessageId;
}

/**
 * Whole days from now until the event closes.
 *
 * @returns The count, or null once the window has closed or the timestamp cannot be read
 */
export function daysRemaining(event: ServerEvent, now: Date = new Date()): number | null {
  const ends = parseServerDate(event.endsAt);
  if (!ends) return null;
  const ms = ends.getTime() - now.getTime();
  if (ms <= 0) return null;
  return Math.ceil(ms / DAY_MS);
}

/** The short "12d left" / "Winner" marker the dismissed chip carries; empty when there is nothing to say. */
export function eventChipMarker(event: ServerEvent, now: Date = new Date()): string {
  if (eventPhase(event, now) === 'end') return hasWinner(event) ? 'Winner' : 'Ended';
  const days = daysRemaining(event, now);
  return days === null ? '' : `${days}d`;
}
