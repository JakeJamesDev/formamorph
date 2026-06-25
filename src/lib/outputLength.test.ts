import { describe, it, expect } from 'vitest';
import {
  paragraphsForTokens,
  lengthGuidance,
  trimToLastSentence,
} from './outputLength';

describe('paragraphsForTokens', () => {
  it('scales with the token budget', () => {
    const small = paragraphsForTokens(256);
    const large = paragraphsForTokens(1024);
    expect(large).toBeGreaterThan(small);
  });

  it('never returns less than 1', () => {
    expect(paragraphsForTokens(10)).toBe(1);
    expect(paragraphsForTokens(0)).toBe(1);
  });
});

describe('lengthGuidance', () => {
  it('returns empty for none', () => {
    expect(lengthGuidance('none', 1024)).toBe('');
  });

  it('returns a single-paragraph directive for single', () => {
    expect(lengthGuidance('single', 1024)).toBe('Write a single paragraph.');
  });

  it('returns an N-paragraph directive for auto with a generous budget', () => {
    expect(lengthGuidance('auto', 1024)).toMatch(/Write at most \d+ short paragraphs\./);
  });

  it('collapses auto to a single paragraph when the budget only allows one', () => {
    expect(lengthGuidance('auto', 40)).toBe('Write a single paragraph.');
  });
});

describe('trimToLastSentence', () => {
  it('trims a severed trailing sentence', () => {
    expect(trimToLastSentence('You enter the cave. A cold draft cu')).toBe('You enter the cave.');
  });

  it('keeps text that already ends on a sentence', () => {
    expect(trimToLastSentence('All is quiet.')).toBe('All is quiet.');
  });

  it('returns the trimmed whole text when there is no sentence boundary', () => {
    expect(trimToLastSentence('  a half thought  ')).toBe('a half thought');
  });

  it('does not split on a decimal point', () => {
    expect(trimToLastSentence('It costs 3.5 gold and you')).toBe('It costs 3.5 gold and you');
  });
});
