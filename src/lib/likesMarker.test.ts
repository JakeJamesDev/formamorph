import { describe, it, expect } from 'vitest';
import { describeLikesMarker, isLikesMarked, likesMarkerOf } from './likesMarker';

describe('likesMarkerOf', () => {
  it('returns the reasons in the server’s fixed order', () => {
    expect(likesMarkerOf({ likes_marker: ['flagged_share', 'burst'] })).toEqual(['burst', 'flagged_share']);
  });

  it('drops anything that is not a known reason', () => {
    expect(likesMarkerOf({ likes_marker: ['burst', 'other', 3] })).toEqual(['burst']);
  });

  it('reads a player’s row, an unmarked row and a missing row as unmarked', () => {
    expect(likesMarkerOf({})).toEqual([]);
    expect(likesMarkerOf({ likes_marker: [] })).toEqual([]);
    expect(likesMarkerOf({ likes_marker: 'burst' })).toEqual([]);
    expect(likesMarkerOf(null)).toEqual([]);
    expect(isLikesMarked({ likes_marker: [] })).toBe(false);
    expect(isLikesMarked({ likes_marker: ['burst'] })).toBe(true);
  });
});

describe('describeLikesMarker', () => {
  it('names one reason or both', () => {
    expect(describeLikesMarker(['burst'])).toBe('Burst');
    expect(describeLikesMarker(['flagged_share'])).toBe('Flagged share');
    expect(describeLikesMarker(['burst', 'flagged_share'])).toBe('Burst and Flagged share');
  });
});
