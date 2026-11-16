import { describe, expect, it } from 'vitest';
import { editDistance } from './editDistance';

describe('editDistance', () => {
  it('counts insertions, deletions and substitutions', () => {
    expect(editDistance('miensao', 'mienshao', 3)).toBe(1);
    expect(editDistance('mienshao', 'miensao', 3)).toBe(1);
    expect(editDistance('mia', 'max', 3)).toBe(2);
    expect(editDistance('same', 'same', 0)).toBe(0);
  });

  it('counts a swap of two neighbors as one edit', () => {
    expect(editDistance('zorvak', 'zrovak', 3)).toBe(1);
  });

  it('stops at max + 1 once the distance passes max', () => {
    expect(editDistance('tessaly', 'tes', 2)).toBe(3);
    expect(editDistance('abcdef', 'uvwxyz', 2)).toBe(3);
  });
});
