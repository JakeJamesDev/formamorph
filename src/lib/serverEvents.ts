/**
 * Pure reasoning about a timed server event: which type it is, which half of its life a player is
 * looking at, and how long is left. No React, no storage — the banner, the modal and their tests all
 * read the same answers from here.
 */
import { DAY_MS, parseServerDate } from './serverDate';
import type { ContestPlace, EventPlacement, ServerEvent, ServerEventPhase } from '@/types';

/** Whether this event unlocks the contest extras (entries, rules, the contest tab). */
export function isContestEvent(event: ServerEvent): boolean {
  return event.type === 'contest';
}

/**
 * Whether a contest has announced its results.
 *
 * The stamp answers it, not the podium: a place assigned is not a place published, and announcing is the
 * one act that decides the contest, lifts the entry lock and tells everyone at once. An announced podium
 * stays editable afterwards, and reading the stamp is what keeps a correction from un-deciding a contest
 * for as long as it takes to save.
 */
export function resultsAnnounced(event: ServerEvent): boolean {
  return Boolean(event.resultsAnnouncedAt);
}

/**
 * A contest's podium, gold first.
 *
 * Guarded rather than read straight off the event: a slim archive row from a server that predates the
 * podium carries no list at all, and an archive nobody can read is better empty than thrown.
 */
export function placementsOf(event: ServerEvent): EventPlacement[] {
  return event.placements ?? [];
}

/**
 * Which place a world took in one contest, if any.
 *
 * @returns The place, or null when this world is not on that podium
 */
export function placeOf(event: ServerEvent, worldId: string | null | undefined): ContestPlace | null {
  if (!worldId) return null;
  return placementsOf(event).find((placement) => placement.worldId === worldId)?.place ?? null;
}

/**
 * The worlds that took 1st place — one on an ordinary podium, several when the place is shared.
 *
 * The one answer every surface that names a winner reads. Four of them are a single line each and none
 * can list a whole podium, so each falls back to a count when this returns more than one; sharing the
 * lookup is what keeps the four from drifting into four different accounts of the same result.
 *
 * Filtered by place rather than taken off the front of the list, so a podium whose order is not the
 * server's own still answers with the worlds that actually won.
 */
export function firstPlaceOf(event: ServerEvent): EventPlacement[] {
  return placementsOf(event).filter((placement) => placement.place === 1);
}

/**
 * Which phase to show for an event: its ending once the window has closed or its results are out, its
 * opening until then.
 *
 * @param now - The instant to judge against; defaults to the current time
 */
export function eventPhase(event: ServerEvent, now: Date = new Date()): ServerEventPhase {
  if (resultsAnnounced(event)) return 'end';
  const ends = parseServerDate(event.endsAt);
  return ends && ends.getTime() <= now.getTime() ? 'end' : 'start';
}

/** The broadcast an acknowledgment of this phase should mark read; null when the event carries none. */
export function phaseMessageId(event: ServerEvent, phase: ServerEventPhase): string | null {
  if (phase === 'start') return event.startMessageId;
  return event.resultsMessageId ?? event.endMessageId;
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

/** The short "12d left" / "Results" marker the dismissed chip carries; empty when there is nothing to say. */
export function eventChipMarker(event: ServerEvent, now: Date = new Date()): string {
  if (eventPhase(event, now) === 'end') return resultsAnnounced(event) ? 'Results' : 'Ended';
  const days = daysRemaining(event, now);
  return days === null ? '' : `${days}d`;
}
