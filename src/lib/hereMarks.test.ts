import { describe, expect, it } from 'vitest';
import { startToShowFor } from '@/lib/hereMarks';
import type { Entity, EntityStart } from '@/types';
import { oneRoutine } from '@/test/routines';

const start = (id: string, place: string, rowPlace?: string): EntityStart => ({
  id, place, weight: 1,
  schedule: rowPlace ? [{ id: `${id}-row`, time: 'allDay', action: { kind: 'stay', place: rowPlace } }] : [],
});
const entity = (starts: EntityStart[]): Entity => ({ id: 'e', name: 'E', kind: 'unique', routines: oneRoutine(starts) } as Entity);

describe('startToShowFor', () => {
  const e = entity([start('a', 'yard'), start('b', 'yard', 'tavern'), start('c', 'tavern')]);

  it('shows the first Start that names the location, a row counting like a begin', () => {
    expect(startToShowFor(e, 'tavern', { routineId: null, startId: null })).toBe('b');
  });

  it('keeps the Start on show when it names the location', () => {
    expect(startToShowFor(e, 'tavern', { routineId: null, startId: 'c' })).toBe('c');
  });

  it('replaces an earlier choice that does not name the location', () => {
    expect(startToShowFor(e, 'tavern', { routineId: null, startId: 'a' })).toBe('b');
  });

  it('shows the first Start when none names the location', () => {
    expect(startToShowFor(e, 'cellar', { routineId: null, startId: 'c' })).toBe('a');
  });

  it('has no Start to show for an entity with none', () => {
    expect(startToShowFor(entity([]), 'tavern', { routineId: null, startId: null })).toBeNull();
  });
});

describe('startToShowFor with several Routines', () => {
  const e: Entity = {
    id: 'e', name: 'E', kind: 'unique',
    routines: [
      { id: 'day', name: 'Day', starts: [start('a', 'yard'), start('b', 'tavern')] },
      { id: 'night', name: 'Night', starts: [start('c', 'cellar'), start('d', 'tavern')] },
    ],
  } as Entity;

  it('looks first in the Routine on show', () => {
    expect(startToShowFor(e, 'tavern', { routineId: 'night', startId: null })).toBe('d');
  });

  it('finds a Start that names the location in another Routine', () => {
    expect(startToShowFor(e, 'cellar', { routineId: 'day', startId: null })).toBe('c');
  });
});
