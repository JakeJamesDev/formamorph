import { describe, it, expect } from 'vitest';
import { daysRemaining, eventChipMarker, eventPhase, hasWinner, isContestEvent, phaseMessageId } from './serverEvents';
import { daysFrom, serverEvent } from '@/test/serverEvents';
import type { ServerEvent } from '@/types';

const NOW = new Date('2026-08-20T12:00:00Z');
const at = (offsetDays: number) => daysFrom(offsetDays, NOW);

const event = (over: Partial<ServerEvent> = {}): ServerEvent =>
  serverEvent({ startsAt: at(-4), endsAt: at(12), ...over });

describe('isContestEvent', () => {
  it('is true only for the contest type — an unknown future type is not one', () => {
    expect(isContestEvent(event())).toBe(true);
    expect(isContestEvent(event({ type: 'announcement' }))).toBe(false);
    expect(isContestEvent(event({ type: 'tournament' }))).toBe(false);
  });
});

describe('hasWinner', () => {
  it('reads either half of what the pick stamps', () => {
    expect(hasWinner(event({ winnerWorldId: 'w1' }))).toBe(true);
    expect(hasWinner(event({ winnerName: 'The Long Thaw' }))).toBe(true);
    expect(hasWinner(event())).toBe(false);
  });

  it('is not answered by the broadcast, which is posted after the pick and can fail', () => {
    expect(hasWinner(event({ winnerMessageId: 'm-win' }))).toBe(false);
  });
});

describe('eventPhase', () => {
  it('is the opening while the window is still open', () => {
    expect(eventPhase(event(), NOW)).toBe('start');
  });

  it('is the ending once the window has closed', () => {
    expect(eventPhase(event({ endsAt: at(-1) }), NOW)).toBe('end');
  });

  it('is the ending as soon as a winner is named, even mid-window', () => {
    expect(eventPhase(event({ winnerName: 'The Long Thaw' }), NOW)).toBe('end');
    expect(eventPhase(event({ winnerWorldId: 'w1' }), NOW)).toBe('end');
  });

  it('treats an unreadable end timestamp as still open rather than instantly over', () => {
    expect(eventPhase(event({ endsAt: 'not a date' }), NOW)).toBe('start');
  });
});

describe('phaseMessageId', () => {
  it('points at the opening broadcast for the opening', () => {
    expect(phaseMessageId(event(), 'start')).toBe('m-start');
  });

  it('prefers the winner broadcast over the end broadcast for the ending', () => {
    const ended = event({ endMessageId: 'm-end', winnerMessageId: 'm-win' });
    expect(phaseMessageId(ended, 'end')).toBe('m-win');
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
    expect(eventChipMarker(event({ winnerName: 'The Long Thaw' }), NOW)).toBe('Winner');
    expect(eventChipMarker(event({ endsAt: at(-1) }), NOW)).toBe('Ended');
  });
});
