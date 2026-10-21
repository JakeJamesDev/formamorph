import { describe, expect, it } from 'vitest';
import { advancedClock, mergeWorldWrites } from './worldWrites';

describe('advancedClock', () => {
  it('reads turn start plus every advance the turn made so far', () => {
    const before = { minutes: 60 };
    const onCall = { minutes: 480 };
    expect(advancedClock(10, before)).toBe(11);
    expect(advancedClock(10, mergeWorldWrites(before, onCall))).toBe(19);
  });

  it('reads nothing when the turn has not advanced the clock', () => {
    expect(advancedClock(10, undefined)).toBeUndefined();
    expect(advancedClock(10, { location: 'gate' })).toBeUndefined();
  });

  it('reads an advance of zero minutes as the turn start', () => {
    expect(advancedClock(10, { minutes: 0 })).toBe(10);
  });
});

describe('mergeWorldWrites', () => {
  it('joins entity writes in run order, the earlier batch first', () => {
    const before = { entities: [{ entity: 'wight', kind: 'move' as const, location: 'barrow' }] };
    const after = { entities: [{ entity: 'wight', kind: 'follow' as const }] };
    expect(mergeWorldWrites(before, after)?.entities).toEqual([...before.entities, ...after.entities]);
  });

  it('joins memory entry writes in run order, so the later script’s verdict lands last', () => {
    const first = { memoryWrites: [{ id: 't1', kind: 'pin' as const }] };
    const second = { memoryWrites: [{ id: 't1', kind: 'forget' as const }] };
    expect(mergeWorldWrites(first, second)?.memoryWrites).toEqual([...first.memoryWrites, ...second.memoryWrites]);
    expect(mergeWorldWrites(first, { location: 'gate' })?.memoryWrites).toEqual(first.memoryWrites);
  });
});
