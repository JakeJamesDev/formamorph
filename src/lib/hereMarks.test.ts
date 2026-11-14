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
    expect(startToShowFor(e, 'tavern', null)).toBe('b');
  });

  it('keeps the Start on show when it names the location', () => {
    expect(startToShowFor(e, 'tavern', 'c')).toBe('c');
  });

  it('replaces an earlier choice that does not name the location', () => {
    expect(startToShowFor(e, 'tavern', 'a')).toBe('b');
  });

  it('shows the first Start when none names the location', () => {
    expect(startToShowFor(e, 'cellar', 'c')).toBe('a');
  });

  it('has no Start to show for an entity with none', () => {
    expect(startToShowFor(entity([]), 'tavern', null)).toBeNull();
  });
});
