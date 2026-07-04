import { describe, it, expect } from 'vitest';
import { rankTagSuggestions } from './tagSuggest';

// Options in popularity order (most-used first), as the shipped list is.
const OPTIONS = ['long hair', 'blush', 'blonde hair', 'blue eyes', 'black hair', 'long sleeves'];

describe('rankTagSuggestions', () => {
  it('preserves input (popularity) order among matches', () => {
    // All contain "l"; startsWith("l") ones come first, each group keeping input order.
    expect(rankTagSuggestions(OPTIONS, 'l', 10)).toEqual([
      'long hair', 'long sleeves', // startsWith "l", in input order
      'blush', 'blonde hair', 'blue eyes', 'black hair', // substring "l", in input order
    ]);
  });

  it('puts prefix matches before substring matches', () => {
    // "bl": "blush/blonde/blue/black" start with it; "long hair" has no "bl".
    expect(rankTagSuggestions(OPTIONS, 'bl', 10)).toEqual(['blush', 'blonde hair', 'blue eyes', 'black hair']);
  });

  it('honors the limit', () => {
    expect(rankTagSuggestions(OPTIONS, 'l', 2)).toEqual(['long hair', 'long sleeves']);
  });

  it('returns nothing when no option matches', () => {
    expect(rankTagSuggestions(OPTIONS, 'zzz', 10)).toEqual([]);
  });
});
