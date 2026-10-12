import { describe, it, expect } from 'vitest';
import { autosaveName, autosavesToTrim, findAutosaveId, AUTOSAVE_NAME } from './autosave';
import type { SaveRecord } from '@/types';

const rec = (over: Partial<SaveRecord>): SaveRecord =>
  ({ id: 'x', name: 'n', currentState: {}, messageHistory: [], stateHistory: [], version: '2.0.0', ...over } as unknown as SaveRecord);

describe('findAutosaveId', () => {
  it('matches the autosave slot by worldId', () => {
    const records = [
      rec({ id: 'manual', worldId: 'w1' }),
      rec({ id: 'auto-w1', worldId: 'w1', isAutosave: true }),
      rec({ id: 'auto-w2', worldId: 'w2', isAutosave: true }),
    ];
    expect(findAutosaveId(records, 'Any', 'w1')).toBe('auto-w1');
    expect(findAutosaveId(records, 'Any', 'w2')).toBe('auto-w2');
  });

  it('falls back to worldName when the world has no id', () => {
    const records = [
      rec({ id: 'auto-a', isAutosave: true, currentState: { worldName: 'Alpha' } as never }),
    ];
    expect(findAutosaveId(records, 'Alpha')).toBe('auto-a');
    expect(findAutosaveId(records, 'Beta')).toBeUndefined();
  });

  it('never matches a manual save, even one named "Autosave"', () => {
    const records = [rec({ id: 'manual-named', name: AUTOSAVE_NAME, worldId: 'w1' })];
    expect(findAutosaveId(records, 'Any', 'w1')).toBeUndefined();
  });

  it('returns undefined when there is no autosave yet', () => {
    expect(findAutosaveId([], 'Any', 'w1')).toBeUndefined();
  });
});

describe('rolling autosaves', () => {
  const at = (id: string, minute: number, over: Partial<SaveRecord> = {}) =>
    rec({ id, worldId: 'w1', isAutosave: true, currentState: { timestamp: new Date(Date.UTC(2026, 8, 29, 12, minute)).toISOString() } as never, ...over });
  const turns = (n: number) => ({ messageHistory: Array.from({ length: n * 2 }, () => ({})) } as never);

  it('keeps one autosave by default, the old one deleted each turn', () => {
    expect(autosavesToTrim([], 'Any', 'w1')).toEqual([]);
    expect(autosavesToTrim([at('a', 1)], 'Any', 'w1')).toEqual(['a']);
  });

  it('deletes nothing until the world has as many as it keeps, then the oldest', () => {
    const four = [at('a', 4), at('b', 1), at('c', 3), at('d', 2)];
    expect(autosavesToTrim(four, 'Any', 'w1', 5)).toEqual([]);
    const five = [...four, at('e', 5)];
    expect(autosavesToTrim(five, 'Any', 'w1', 5)).toEqual(['b']);
  });

  it('deletes the oldest extras once the setting is lowered', () => {
    const five = [at('a', 4), at('b', 1), at('c', 3), at('d', 2), at('e', 5)];
    // Oldest first: b, d, c, a, e. Keeping two leaves e and the new save.
    expect(autosavesToTrim(five, 'Any', 'w1', 2)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('replaces the newest autosave on a regenerate of its turn, using no slot', () => {
    const three = [at('a', 1, turns(10)), at('b', 2, turns(11)), at('c', 3, turns(12))];
    expect(autosavesToTrim(three, 'Any', 'w1', 3, 12)).toEqual(['c']);
    expect(autosavesToTrim(three, 'Any', 'w1', 3, 13)).toEqual(['a']);
  });

  it('keeps an older save of the same turn, from a rewound branch', () => {
    const branch = [at('a', 1, turns(9)), at('b', 2, turns(10)), at('c', 3, turns(12))];
    expect(autosavesToTrim(branch, 'Any', 'w1', 5, 9)).toEqual([]);
  });

  it('counts only this world\'s autosaves, never a manual save', () => {
    const records = [at('a', 1), at('b', 2), at('c', 3), at('d', 4), at('x', 0, { worldId: 'w2' }), at('m', 0, { isAutosave: false })];
    expect(autosavesToTrim(records, 'Any', 'w1', 5)).toEqual([]);
    expect(autosavesToTrim(records, 'Any', 'w1', 4)).toEqual(['a']);
  });

  it('names an autosave by its turn', () => {
    expect(autosaveName(12)).toBe('Autosave · Turn 12');
    expect(autosaveName(undefined)).toBe('Autosave');
  });
});
