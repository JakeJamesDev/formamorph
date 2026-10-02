import { describe, expect, it } from 'vitest';
import { mergeRanks, rankByVector } from './rankMerge';

describe('mergeRanks', () => {
  it('orders the sections by their places in every list', () => {
    expect(mergeRanks([['a', 'b', 'c'], ['b', 'd', 'a']])).toEqual(['b', 'a', 'd', 'c']);
  });

  it('keeps a section that only one list holds', () => {
    expect(mergeRanks([['a'], ['b']]).sort()).toEqual(['a', 'b']);
  });

  it('keeps the order of a single list', () => {
    expect(mergeRanks([['c', 'a', 'b'], []])).toEqual(['c', 'a', 'b']);
  });

  it('ranks a section two lists hold low above one a single list holds first', () => {
    expect(mergeRanks([['a', 'x', 'both'], ['b', 'y', 'both']])[0]).toBe('both');
  });
});

describe('rankByVector', () => {
  const v = (...values: number[]) => Float32Array.from(values);

  it('orders ids by the dot product with the query, best first', () => {
    const ranked = rankByVector(v(1, 0), [{ id: 'far', vector: v(0, 1) }, { id: 'near', vector: v(1, 0) }, { id: 'mid', vector: v(0.6, 0.8) }]);
    expect(ranked.map((r) => r.id)).toEqual(['near', 'mid', 'far']);
  });

  it('scores an id with several vectors by its best one, and lists it once', () => {
    const ranked = rankByVector(v(1, 0), [{ id: 'split', vector: v(0.8, 0.6) }, { id: 'one', vector: v(0.6, 0.8) }, { id: 'split', vector: v(0, 1) }]);
    expect(ranked.map((r) => r.id)).toEqual(['split', 'one']);
    expect(ranked[0].score).toBeCloseTo(0.8);
  });
});
