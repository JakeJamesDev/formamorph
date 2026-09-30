import { describe, it, expect } from 'vitest';
import { likeCountOf, likeStateOf, likesForSort, optimisticLikeState } from './likeCount';

/**
 * What a like count shows to this reader.
 *
 * The server leaves a hidden contest count out and flags it, and flags a count that only the author and
 * staff see. These guard that every surface reads those flags the same way, and that a record with no
 * flags reads as a plain number.
 */

describe('likeCountOf', () => {
  it('reads a plain count as a public number', () => {
    expect(likeCountOf({ likes: 7 })).toEqual({ visibility: 'public', likes: 7 });
  });

  it('reads a missing count on an unflagged record as zero', () => {
    expect(likeCountOf({})).toEqual({ visibility: 'public', likes: 0 });
  });

  it('reads a count the author and staff see as private', () => {
    expect(likeCountOf({ likes: 12, likesPrivate: true })).toEqual({ visibility: 'private', likes: 12 });
  });

  it('reads a flagged count as hidden, with no number', () => {
    expect(likeCountOf({ likesHidden: true })).toEqual({ visibility: 'hidden' });
  });

  it('keeps a hidden count hidden even when a number rides along', () => {
    expect(likeCountOf({ likes: 40, likesHidden: true })).toEqual({ visibility: 'hidden' });
  });

  it('reads only a true flag, so a false one is a plain count', () => {
    expect(likeCountOf({ likes: 2, likesHidden: false, likesPrivate: false })).toEqual({ visibility: 'public', likes: 2 });
  });
});

describe('likesForSort', () => {
  it('sorts a hidden count as zero, so its place shows no rank', () => {
    expect(likesForSort({ likes: 40, likesHidden: true })).toBe(0);
  });

  it('sorts a private count by its number', () => {
    expect(likesForSort({ likes: 12, likesPrivate: true })).toBe(12);
  });
});

describe('optimisticLikeState', () => {
  it('moves a public count by one on a like', () => {
    expect(optimisticLikeState({ likes: 3 }, true)).toEqual({ liked: true, likes: 4 });
  });

  it('moves a public count down on an unlike, never below zero', () => {
    expect(optimisticLikeState({ likes: 0 }, false)).toEqual({ liked: false, likes: 0 });
  });

  it('keeps a private count private while it moves', () => {
    expect(optimisticLikeState({ likes: 3, likesPrivate: true }, true)).toEqual({ liked: true, likes: 4, likesPrivate: true });
  });

  it('shows no number on a hidden count, only the press', () => {
    expect(optimisticLikeState({ likes: 40, likesHidden: true }, true)).toEqual({ liked: true, likesHidden: true });
  });
});

describe('likeStateOf', () => {
  it('keeps the flags a record carries, so a refused press puts them back', () => {
    expect(likeStateOf({ liked: false, likesHidden: true })).toEqual({ liked: false, likes: undefined, likesHidden: true, likesPrivate: undefined });
  });

  it('writes an absent flag as undefined, so a patch clears a flag the new state drops', () => {
    expect(likeStateOf({ liked: true, likes: 21 })).toEqual({ liked: true, likes: 21, likesHidden: undefined, likesPrivate: undefined });
  });
});
