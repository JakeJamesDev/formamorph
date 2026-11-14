import { describe, expect, it } from 'vitest';
import type { Entity } from '@/types';
import { castCourses } from './entityKind';
import { movementLabels, movementStates } from './movementTag';
import { oneRoutine } from '@/test/routines';

const shift = { id: 'shift', time: 'allDay' as const, strict: true, action: { kind: 'stay' as const, place: 'gate' } };
const guard: Entity = { id: 'guard', name: 'Guard', kind: 'unique', routines: oneRoutine([{ id: 's', place: 'gate', weight: 1, schedule: [shift] }]) };
// A Generic entity on the same Strict row: the row is ignored, and a Generic entity carries no tag.
const crows: Entity = { id: 'crows', name: 'Crows', kind: 'generic', routines: oneRoutine([{ id: 'c', place: 'gate', weight: 1, schedule: [shift] }]) };

describe('the Movement tag', () => {
  it('tags a Unique entity on a Strict row and never a Generic entity', () => {
    const states = movementStates(castCourses([guard, crows]), { guard: { startId: 's', lastRun: 0 } }, 600);
    expect(Object.keys(states)).toEqual(['guard']);
    expect(movementLabels(states, ['guard', 'crows'], [])).toEqual({ guard: 'stays here' });
  });

  it('tags a Unique entity still here as its Away row begins', () => {
    const gone = { id: 'gone', time: 'allDay' as const, action: { kind: 'away' as const } };
    const nell: Entity = { id: 'nell', name: 'Nell', kind: 'unique', routines: oneRoutine([{ id: 's', place: 'gate', weight: 1, schedule: [gone] }]) };
    const states = movementStates(castCourses([nell]), { nell: { startId: 's', lastRun: 0 } }, 600);
    expect(movementLabels(states, ['nell'], [])).toEqual({ nell: 'stays here' });
  });
});
