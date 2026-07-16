import { describe, it, expect } from 'vitest';
import { contentHash } from './contentHash';

describe('contentHash', () => {
  it('is deterministic for the same input', () => {
    expect(contentHash('the drone world')).toBe(contentHash('the drone world'));
  });

  it('changes when the content changes, even by one character', () => {
    expect(contentHash('{"a":1}')).not.toBe(contentHash('{"a":2}'));
    expect(contentHash('abc')).not.toBe(contentHash('abd'));
  });

  it('distinguishes reordered content', () => {
    expect(contentHash('ab')).not.toBe(contentHash('ba'));
  });

  it('handles empty and large strings', () => {
    expect(typeof contentHash('')).toBe('string');
    const big = 'x'.repeat(100_000);
    expect(contentHash(big)).toBe(contentHash(big));
    expect(contentHash(big)).not.toBe(contentHash(`${big}y`));
  });
});
