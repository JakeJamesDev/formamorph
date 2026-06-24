import { describe, it, expect } from 'vitest';
import { highlightSegments, type HighlightRule } from './highlightUtils';

describe('highlightSegments', () => {
  it('returns the whole text as one uncolored segment when there are no rules', () => {
    expect(highlightSegments('hello', [])).toEqual([{ text: 'hello' }]);
  });

  it('ignores blank / whitespace-only terms', () => {
    expect(highlightSegments('hello', [{ term: '   ', color: 'red' }])).toEqual([{ text: 'hello' }]);
  });

  it('marks matches with their color, case-insensitively', () => {
    expect(highlightSegments('Fire and FIRE', [{ term: 'fire', color: 'red' }])).toEqual([
      { text: 'Fire', color: 'red' },
      { text: ' and ' },
      { text: 'FIRE', color: 'red' },
    ]);
  });

  it('prefers the longest term on overlap', () => {
    const rules: HighlightRule[] = [
      { term: 'dragon', color: 'green' },
      { term: 'fire dragon', color: 'orange' },
    ];
    const segs = highlightSegments('a fire dragon', rules);
    expect(segs).toContainEqual({ text: 'fire dragon', color: 'orange' });
    expect(segs).not.toContainEqual({ text: 'dragon', color: 'green' });
  });

  it('escapes regex-special characters in terms', () => {
    const segs = highlightSegments('cost is $5 today', [{ term: '$5', color: 'gold' }]);
    expect(segs).toContainEqual({ text: '$5', color: 'gold' });
  });

  it('reconstructs the original text from its segments', () => {
    const text = 'The fire dragon breathes fire.';
    const segs = highlightSegments(text, [
      { term: 'fire', color: 'red' },
      { term: 'dragon', color: 'green' },
    ]);
    expect(segs.map((s) => s.text).join('')).toBe(text);
  });
});
