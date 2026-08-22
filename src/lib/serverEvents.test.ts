import { describe, it, expect } from 'vitest';
import {
  daysRemaining, eventChipMarker, eventPhase, isContestEvent, phaseMessageId, placeOf, placementsOf,
  resultsAnnounced,
} from './serverEvents';
import { daysFrom, serverEvent } from '@/test/serverEvents';
import type { ServerEvent } from '@/types';

const NOW = new Date('2026-08-20T12:00:00Z');
const at = (offsetDays: number) => daysFrom(offsetDays, NOW);

const event = (over: Partial<ServerEvent> = {}): ServerEvent =>
  serverEvent({ startsAt: at(-4), endsAt: at(12), ...over });

/** A contest whose results are out, with a gold placement to go with the stamp. */
const decided = (over: Partial<ServerEvent> = {}): ServerEvent => event({
  resultsAnnouncedAt: at(0),
  placements: [{ place: 1, worldId: 'w1', worldName: 'The Long Thaw', authorName: 'sedgewright' }],
  ...over,
});

describe('isContestEvent', () => {
  it('is true only for the contest type — an unknown future type is not one', () => {
    expect(isContestEvent(event())).toBe(true);
    expect(isContestEvent(event({ type: 'announcement' }))).toBe(false);
    expect(isContestEvent(event({ type: 'tournament' }))).toBe(false);
  });
});

describe('resultsAnnounced', () => {
  it('reads the announcement stamp', () => {
    expect(resultsAnnounced(decided())).toBe(true);
    expect(resultsAnnounced(event())).toBe(false);
  });

  it('is not answered by a stored place, which is assigned before it is published', () => {
    // Assigning is not announcing. A podium held without the stamp is a contest still being judged.
    expect(resultsAnnounced(event({
      placements: [{ place: 1, worldId: 'w1', worldName: 'The Long Thaw', authorName: 'sedgewright' }],
    }))).toBe(false);
  });

  it('is not answered by the broadcast, which is posted after the stamp and can fail', () => {
    expect(resultsAnnounced(event({ winnerMessageId: 'm-results' }))).toBe(false);
  });
});

describe('placementsOf', () => {
  it('hands back the podium as it stands', () => {
    expect(placementsOf(decided()).map((p) => p.place)).toEqual([1]);
  });

  it('answers empty for a row from a server that has never heard of a podium', () => {
    // A slim archive row can arrive without the list at all; an archive nobody can read is better empty
    // than thrown.
    const older = { ...event() } as Partial<ServerEvent>;
    delete older.placements;

    expect(placementsOf(older as ServerEvent)).toEqual([]);
  });
});

describe('placeOf', () => {
  const podium = event({
    resultsAnnouncedAt: at(0),
    placements: [
      { place: 1, worldId: 'w1', worldName: 'Gold', authorName: 'a' },
      { place: 2, worldId: 'w2', worldName: 'Silver', authorName: 'b' },
      { place: 3, worldId: null, worldName: 'Deleted Bronze', authorName: 'c' },
    ],
  });

  it('names which step a world is on', () => {
    expect(placeOf(podium, 'w1')).toBe(1);
    expect(placeOf(podium, 'w2')).toBe(2);
  });

  it('is null for a world that placed nowhere', () => {
    expect(placeOf(podium, 'w9')).toBeNull();
    expect(placeOf(event(), 'w1')).toBeNull();
  });

  it('never matches a deleted listing, whose id is gone rather than blank', () => {
    // The snapshot keeps the name; the id does not survive, and a null must not answer to a null.
    expect(placeOf(podium, null)).toBeNull();
    expect(placeOf(podium, undefined)).toBeNull();
  });
});

describe('eventPhase', () => {
  it('is the opening while the window is still open', () => {
    expect(eventPhase(event(), NOW)).toBe('start');
  });

  it('is the ending once the window has closed', () => {
    expect(eventPhase(event({ endsAt: at(-1) }), NOW)).toBe('end');
  });

  it('is the ending as soon as the results are out, even mid-window', () => {
    expect(eventPhase(decided(), NOW)).toBe('end');
  });

  it('treats an unreadable end timestamp as still open rather than instantly over', () => {
    expect(eventPhase(event({ endsAt: 'not a date' }), NOW)).toBe('start');
  });
});

describe('phaseMessageId', () => {
  it('points at the opening broadcast for the opening', () => {
    expect(phaseMessageId(event(), 'start')).toBe('m-start');
  });

  it('prefers the results broadcast over the end broadcast for the ending', () => {
    const ended = event({ endMessageId: 'm-end', winnerMessageId: 'm-results' });
    expect(phaseMessageId(ended, 'end')).toBe('m-results');
    expect(phaseMessageId(event({ endMessageId: 'm-end' }), 'end')).toBe('m-end');
  });

  it('is null when the event carries no broadcast for that phase', () => {
    expect(phaseMessageId(event({ startMessageId: null }), 'start')).toBeNull();
    expect(phaseMessageId(event(), 'end')).toBeNull();
  });
});

describe('daysRemaining', () => {
  it('rounds a part-day up, so the last day still reads as a day', () => {
    expect(daysRemaining(event({ endsAt: at(11.2) }), NOW)).toBe(12);
    expect(daysRemaining(event({ endsAt: at(0.1) }), NOW)).toBe(1);
  });

  it('is null once the window has closed or the timestamp cannot be read', () => {
    expect(daysRemaining(event({ endsAt: at(-1) }), NOW)).toBeNull();
    expect(daysRemaining(event({ endsAt: 'not a date' }), NOW)).toBeNull();
  });
});

describe('eventChipMarker', () => {
  it('counts the days left while the event runs', () => {
    expect(eventChipMarker(event({ endsAt: at(12) }), NOW)).toBe('12d');
  });

  it('names the outcome once it has one', () => {
    expect(eventChipMarker(decided(), NOW)).toBe('Results');
    expect(eventChipMarker(event({ endsAt: at(-1) }), NOW)).toBe('Ended');
  });
});
