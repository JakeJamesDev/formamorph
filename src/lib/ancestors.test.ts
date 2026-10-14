import { describe, expect, it } from 'vitest';
import { ancestors, parentLookup } from './ancestors';

const lookup = (edges: Record<string, string | null>) => (id: string) => edges[id];

describe('ancestors', () => {
  it('lists a plain chain nearest first', () => {
    expect(ancestors('c', lookup({ a: null, b: 'a', c: 'b' }))).toEqual(['b', 'a']);
  });

  it('is empty for a root', () => {
    expect(ancestors('a', lookup({ a: null }))).toEqual([]);
  });

  it('names a dangling parent and stops there', () => {
    expect(ancestors('b', lookup({ b: 'ghost' }))).toEqual(['ghost']);
  });

  it('stops at a cycle before any id repeats', () => {
    expect(ancestors('a', lookup({ a: 'b', b: 'c', c: 'a' }))).toEqual(['b', 'c']);
  });

  it('stops at a self-parent', () => {
    expect(ancestors('a', lookup({ a: 'a' }))).toEqual([]);
  });
});

describe('parentLookup', () => {
  it('reads each row through the key and returns undefined for an unknown id', () => {
    const parentOf = parentLookup([{ id: 'a', parentId: null }, { id: 'b', parentId: 'a' }], (r) => r.parentId);
    expect(parentOf('b')).toBe('a');
    expect(parentOf('a')).toBeNull();
    expect(parentOf('zzz')).toBeUndefined();
  });
});
