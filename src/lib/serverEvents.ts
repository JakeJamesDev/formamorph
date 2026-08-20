/**
 * Pure reasoning about a timed server event: which type it is, which half of its life a player is
 * looking at, and how long is left. No React, no storage — the banner, the modal and their tests all
 * read the same answers from here.
 */
import { parseServerDate } from './serverDate';
import type { ServerEvent, ServerEventPhase } from '@/types';

/** Whether this event unlocks the contest extras (entries, rules, the contest tab). */
export function isContestEvent(event: ServerEvent): boolean {
  return event.type === 'contest';
}

/**
 * Which phase to show for an event: its ending once the window has closed or a winner has been named,
 * its opening until then.
 *
 * @param now - The instant to judge against; defaults to the current time
 */
export function eventPhase(event: ServerEvent, now: Date = new Date()): ServerEventPhase {
  if (event.winnerMessageId || event.winnerName) return 'end';
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
  return Math.ceil(ms / 86_400_000);
}

/** The short "12d left" / "Winner" marker the dismissed chip carries; empty when there is nothing to say. */
export function eventChipMarker(event: ServerEvent, now: Date = new Date()): string {
  if (eventPhase(event, now) === 'end') return event.winnerName ? 'Winner' : 'Ended';
  const days = daysRemaining(event, now);
  return days === null ? '' : `${days}d`;
}
