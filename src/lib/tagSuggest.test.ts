import { describe, it, expect } from 'vitest';
import { rankTagSuggestions, activeTagToken, replaceActiveTag } from './tagSuggest';

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

describe('activeTagToken', () => {
  it('bounds the tag the caret sits in, matching only on what is left of the caret', () => {
    const v = 'red ribbon, blue dress';
    // Caret inside "blue dress", after "blue d".
    expect(activeTagToken(v, 18)).toEqual({ start: 12, end: 22, token: 'blue d' });
  });

  it('skips the space after a comma, so the separator is not part of the tag', () => {
    expect(activeTagToken('1girl, solo', 8).start).toBe(7);
  });

  it('treats a newline as a separator too', () => {
    expect(activeTagToken('1girl\nsolo', 10)).toEqual({ start: 6, end: 10, token: 'solo' });
  });
});

describe('replaceActiveTag', () => {
  it('appends a separator when completing the last tag, so the next one can be typed', () => {
    expect(replaceActiveTag('1girl, blon', 11, 'blonde hair'))
      .toEqual({ value: '1girl, blonde hair, ', caret: 20 });
  });

  it('keeps the existing separator when completing a tag mid-list', () => {
    const { value, caret } = replaceActiveTag('1girl, blon, solo', 11, 'blonde hair');
    expect(value).toBe('1girl, blonde hair, solo');
    // Caret lands after the completion, not at the end of the field.
    expect(value.slice(0, caret)).toBe('1girl, blonde hair');
  });

  it('appends a separator at the end of a line, where none is waiting either', () => {
    // A tag line broken across rows ends each row the same way the value ends: with nothing after the tag.
    const { value, caret } = replaceActiveTag('1girl, blon\nsolo', 11, 'blonde hair');
    expect(value).toBe('1girl, blonde hair, \nsolo');
    expect(value.slice(0, caret)).toBe('1girl, blonde hair, ');
  });

  it('leaves a placeholder token elsewhere in the value untouched', () => {
    const token = '{{ph:hair:world:p1}}';
    const { value } = replaceActiveTag(`1girl, ${token}, blon`, `1girl, ${token}, blon`.length, 'blonde hair');
    expect(value).toBe(`1girl, ${token}, blonde hair, `);
  });
});
