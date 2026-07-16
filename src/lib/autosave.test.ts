import { describe, it, expect } from 'vitest';
import { findAutosaveId, AUTOSAVE_NAME } from './autosave';
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
