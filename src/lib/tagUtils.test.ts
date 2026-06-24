import { describe, it, expect } from 'vitest';
import { sanitizeTag } from './tagUtils';

describe('sanitizeTag', () => {
  it('lowercases', () => {
    expect(sanitizeTag('Dragon')).toBe('dragon');
  });

  it('folds accents to their base letters', () => {
    expect(sanitizeTag('Café')).toBe('cafe');
    expect(sanitizeTag('jalapeño')).toBe('jalapeno');
  });

  it('collapses runs of punctuation/whitespace to a single space and trims', () => {
    expect(sanitizeTag('  Fire   Dragon!! ')).toBe('fire dragon');
  });

  it('keeps "/" and normalizes the spacing around it', () => {
    expect(sanitizeTag('a / b')).toBe('a/b');
    expect(sanitizeTag('a/b')).toBe('a/b');
    expect(sanitizeTag('a // b')).toBe('a/b');
  });

  it('returns "" for junk-only input', () => {
    expect(sanitizeTag('!!!')).toBe('');
  });

  it('handles null/undefined as empty string', () => {
    expect(sanitizeTag(null as unknown as string)).toBe('');
    expect(sanitizeTag(undefined as unknown as string)).toBe('');
  });
});
