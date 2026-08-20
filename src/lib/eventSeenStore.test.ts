import { describe, it, expect, beforeEach } from 'vitest';
import {
  isEventAcknowledged, isEventBannerDismissed, markEventAcknowledged, markEventBannerDismissed,
} from './eventSeenStore';

beforeEach(() => localStorage.clear());

describe('event acknowledgment', () => {
  it('remembers an acknowledgment for that event and phase alone', () => {
    markEventAcknowledged('e1', 'start');

    expect(isEventAcknowledged('e1', 'start')).toBe(true);
    // The ending is its own announcement — acknowledging the opening must not swallow it.
    expect(isEventAcknowledged('e1', 'end')).toBe(false);
    expect(isEventAcknowledged('e2', 'start')).toBe(false);
  });

  it('is idempotent', () => {
    markEventAcknowledged('e1', 'start');
    markEventAcknowledged('e1', 'start');
    expect(JSON.parse(localStorage.getItem('FORMAMORPH_eventAcknowledged') ?? '[]')).toEqual(['e1:start']);
  });
});

describe('banner dismissal', () => {
  it('is tracked apart from acknowledgment, per event and phase', () => {
    markEventBannerDismissed('e1', 'start');

    expect(isEventBannerDismissed('e1', 'start')).toBe(true);
    expect(isEventBannerDismissed('e1', 'end')).toBe(false);
    expect(isEventAcknowledged('e1', 'start')).toBe(false);
  });
});

describe('unreadable storage', () => {
  it('reads as nothing seen rather than throwing', () => {
    localStorage.setItem('FORMAMORPH_eventAcknowledged', '{not json');
    expect(isEventAcknowledged('e1', 'start')).toBe(false);
  });

  it('ignores entries that are not strings', () => {
    localStorage.setItem('FORMAMORPH_eventAcknowledged', JSON.stringify(['e1:start', 42, null]));
    expect(isEventAcknowledged('e1', 'start')).toBe(true);
  });
});
