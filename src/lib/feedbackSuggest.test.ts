import { describe, expect, it } from 'vitest';
import { feedbackSuggestInsert, feedbackSuggestQuery } from './feedbackSuggest';

describe('feedbackSuggestQuery', () => {
  it.each([
    ['@', { kind: 'user', query: '', start: 0 }],
    ['hey @wr', { kind: 'user', query: 'wr', start: 4 }],
    ['(@wren_h', { kind: 'user', query: 'wren_h', start: 1 }],
    ['see #12', { kind: 'thread', query: '12', start: 4 }],
    ['like #dark mo', { kind: 'thread', query: 'dark mo', start: 5 }],
    ['`x` then @wr', { kind: 'user', query: 'wr', start: 9 }],
    ['```\ncode\n```\n@wr', { kind: 'user', query: 'wr', start: 13 }],
    ['an `open span\n\n@wr', { kind: 'user', query: 'wr', start: 15 }],
  ])('finds the run %j ends', (before, expected) => {
    expect(feedbackSuggestQuery(before)).toEqual(expected);
  });

  it.each([
    ['plain text'],
    ['mail a@wr'],
    ['C#'],
    ['#'],
    ['# heading'],
    ['#12 is done'],
    ['#0'],
    ['`@wr'],
    ['an `open span\n@wr'],
    ['```\n@wr'],
    ['@wren '],
  ])('offers nothing at the end of %j', (before) => {
    expect(feedbackSuggestQuery(before)).toBeNull();
  });
});

describe('feedbackSuggestInsert', () => {
  it('writes the link and one space', () => {
    expect(feedbackSuggestInsert('user', 'Wren_H')).toBe('@Wren_H ');
    expect(feedbackSuggestInsert('thread', 12)).toBe('#12 ');
    expect(feedbackSuggestInsert('user', 'Jake James')).toBe('@Jake_James ');
  });
});
