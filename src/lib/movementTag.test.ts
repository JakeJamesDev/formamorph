import { describe, expect, it } from 'vitest';
import type { Entity } from '@/types';
import { castRoutines } from './entityKind';
import { movementLabels, movementStates } from './movementTag';

const shift = { id: 'shift', time: 'allDay' as const, strict: true, action: { kind: 'stay' as const, place: 'gate' } };
const guard: Entity = { id: 'guard', name: 'Guard', kind: 'individual', starts: [{ id: 's', place: 'gate', weight: 1, schedule: [shift] }] };
// A Group on the same Strict row: the row is ignored, and a Group carries no tag.
const crows: Entity = { id: 'crows', name: 'Crows', kind: 'group', starts: [{ id: 'c', place: 'gate', weight: 1, schedule: [shift] }] };

describe('the Movement tag', () => {
  it('tags an Individual on a Strict row and never a Group', () => {
    const states = movementStates(castRoutines([guard, crows]), { guard: { startId: 's', lastRun: 0 } }, 600);
    expect(Object.keys(states)).toEqual(['guard']);
    expect(movementLabels(states, ['guard', 'crows'], [])).toEqual({ guard: 'stays here' });
  });
});
