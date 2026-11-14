import { describe, expect, it } from 'vitest';
import type { Entity, EntityRoutine, EntityStart } from '@/types';
import { canRemoveStartsAt, withoutStartsAt } from './routineList';

const start = (id: string, place: string): EntityStart => ({ id, place, weight: 1, schedule: [] });
const herd = (routines: EntityRoutine[]): Entity => ({ id: 'herd', name: 'Herd', kind: 'generic', routines });

describe('removing a Generic entity from a location', () => {
  it('drops the Starts there from every Routine', () => {
    const e = herd([
      { id: 'a', name: 'A', starts: [start('a1', 'barn'), start('a2', 'field')] },
      { id: 'b', name: 'B', starts: [start('b1', 'field'), start('b2', 'barn')] },
    ]);
    expect(withoutStartsAt(e, 'barn').routines?.map((r) => r.starts.map((s) => s.id))).toEqual([['a2'], ['b1']]);
  });

  it('removes nothing when that would leave a Routine with no Start', () => {
    const e = herd([
      { id: 'a', name: 'A', starts: [start('a1', 'barn'), start('a2', 'field')] },
      { id: 'b', name: 'B', starts: [start('b1', 'barn')] },
    ]);
    expect(canRemoveStartsAt(e, 'barn')).toBe(false);
    expect(withoutStartsAt(e, 'barn')).toBe(e);
  });
});
