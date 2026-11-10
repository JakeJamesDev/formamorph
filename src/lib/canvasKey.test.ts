import { describe, expect, it } from 'vitest';
import type { Entity, ScheduleAction, ScheduleRow, Traversable } from '@/types';
import { pickKeyEntries, routineKeyEntries } from './canvasKey';
import { routineView } from './canvasRoutine';

const graph = {
  locations: [...['smithy', 'inn', 'market', 'square', 'wall', 'gate'].map((id) => ({ id, parentId: null })), { id: 'island', parentId: null }],
  connections: [],
};
const timed = (id: string, from: number, to: number, action: ScheduleAction): ScheduleRow =>
  ({ id, time: { start: from * 60, end: to * 60 }, action });
const day: ScheduleRow[] = [
  timed('stay', 6, 10, { kind: 'stay', place: 'inn' }),
  timed('wander', 10, 14, { kind: 'wander', places: [{ place: 'market', weight: 3 }, { place: 'square', weight: 1 }], idle: 60 }),
  timed('patrol', 14, 18, { kind: 'patrol', stops: [{ place: 'wall', idle: 30 }, { place: 'gate', idle: 30 }] }),
];
const farrier = (schedule: ScheduleRow[], traversable: Traversable = ['island']): Entity => ({
  id: 'farrier', name: 'Farrier', playerDescription: '', aiDescription: '', kind: 'individual', traversable,
  starts: [{ id: 's1', place: 'smithy', weight: 1, schedule }],
} as Entity);
const key = (entity: Entity, rowId: string | null = null) =>
  routineKeyEntries(routineView(entity, { startId: null, rowId }, graph), entity.kind === 'group');

describe('the key of the Routine view', () => {
  it('lists each action on show, the free time, the day bar, the Start flag and the listed place, in a set order', () => {
    expect(key(farrier(day))).toEqual(['stay', 'wander', 'patrol', 'free', 'dayBar', 'start', 'reach']);
  });

  it('leaves out an action no row uses, and says nothing for a place the entity never reaches', () => {
    expect(key(farrier([day[0]], []))).toEqual(['stay', 'free', 'dayBar', 'start']);
  });

  it('names the neutral ring only when a place holds two actions', () => {
    const shared = farrier([day[0], timed('walk', 10, 14, { kind: 'wander', places: [{ place: 'inn', weight: 1 }, { place: 'market', weight: 1 }], idle: 60 })]);
    expect(key(shared)).toContain('mixed');
    expect(key(farrier(day))).not.toContain('mixed');
  });

  it('adds the chance badge for a selected Wander row and the stop number for a Patrol row, and drops the other actions', () => {
    expect(key(farrier(day), 'wander')).toEqual(['wander', 'dayBar', 'start', 'chance', 'reach']);
    expect(key(farrier(day), 'patrol')).toEqual(['patrol', 'dayBar', 'start', 'stop', 'reach']);
  });

  it('says only where a Group is', () => {
    const herd = { id: 'herd', name: 'Herd', kind: 'group', locations: ['inn'] } as Entity;
    expect(key(herd)).toEqual(['here']);
  });
});

it('lists the entity’s locations and Known In picks only when the map shows one', () => {
  expect(pickKeyEntries(new Map([['a', { kind: 'member', pick: false }], ['b', { kind: 'faded', pick: true }]]))).toEqual(['entityLocation', 'knownIn']);
  expect(pickKeyEntries(new Map([['a', { kind: 'faded', pick: false }]]))).toEqual([]);
});
