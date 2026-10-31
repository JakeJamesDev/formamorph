import { describe, expect, it } from 'vitest';
import { linksKind, usedByText } from './usedByText';

describe('usedByText', () => {
  it('names one kind, without the number for a single reference', () => {
    expect(usedByText([linksKind(1)])).toBe('This also deletes its link.');
    expect(usedByText([linksKind(3)])).toBe('This also deletes its 3 links.');
  });

  it('joins several kinds with commas and "and"', () => {
    const pick = { one: 'pick', many: 'picks' };
    expect(usedByText([linksKind(2), { count: 1, ...pick }])).toBe('This also deletes its 2 links and 1 pick.');
    expect(usedByText([linksKind(1), { count: 3, ...pick }, { count: 1, one: 'slot', many: 'slots' }]))
      .toBe('This also deletes its 1 link, 3 picks and 1 slot.');
  });

  it('skips kinds with no uses', () => {
    expect(usedByText([linksKind(0), { count: 2, one: 'pick', many: 'picks' }])).toBe('This also deletes its 2 picks.');
  });

  it('returns null at zero uses, so no confirm opens', () => {
    expect(usedByText([])).toBeNull();
    expect(usedByText([linksKind(0), { count: 0, one: 'pick', many: 'picks' }])).toBeNull();
  });
});
