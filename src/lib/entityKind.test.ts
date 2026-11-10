import { describe, expect, it } from 'vitest';
import type { Entity, EntityStart } from '@/types';
import {
  canRemoveGroupStartsAt, castRoutines, toggleGroupStart, withGroupPlacesMapped, withGroupStart, withKind, withoutGroupStartsAt,
} from './entityKind';

let n = 0;
const newId = () => `new-${++n}`;

const night: EntityStart['schedule'][number] = { id: 'night', time: { start: 1200, end: 360 }, strict: true, action: { kind: 'stay', place: 'yard' } };
const starts: EntityStart[] = [
  { id: 'a', place: 'barn', weight: 3, schedule: [night] },
  { id: 'b', place: 'field', weight: 1, schedule: [] },
];
const herd: Entity = { id: 'herd', name: 'Herd', kind: 'group', locations: ['barn', 'yard', 'field'], starts };
const mare: Entity = { id: 'mare', name: 'Mare', kind: 'individual', locations: ['barn', 'yard', 'field'], starts, traversable: ['barn'] };

describe('the kind switch', () => {
  it('keeps every Start, row, weight, Strict flag and Traversable both ways', () => {
    const asGroup = withKind(mare, 'group', newId);
    expect(asGroup).toMatchObject({ kind: 'group', starts, traversable: ['barn'], locations: ['barn', 'yard', 'field'] });
    expect(withKind(asGroup, 'individual', newId)).toEqual(mare);
  });

  it('gives a kindless entity one Start per place as a Group, and one at its first place as an Individual', () => {
    const loose: Entity = { id: 'x', name: 'X', locations: ['barn', 'field'] };
    expect(withKind(loose, 'group', newId).starts?.map((s) => [s.place, s.schedule])).toEqual([['barn', []], ['field', []]]);
    expect(withKind(loose, 'individual', newId).starts?.map((s) => s.place)).toEqual(['barn']);
  });
});

describe("a Group's Starts", () => {
  it('adds a Start with no rows, even at a place a Start already begins at', () => {
    const next = withGroupStart(herd, 'barn', newId);
    expect(next.starts?.slice(2)).toEqual([expect.objectContaining({ place: 'barn', weight: 1, schedule: [] })]);
    expect(next.locations).toEqual(['barn', 'yard', 'field']);
  });

  it('removes every Start that begins at a place, rows and all, and rewrites its locations', () => {
    const twice = withGroupStart(herd, 'barn', newId);
    const next = withoutGroupStartsAt(twice, 'barn');
    expect(next.starts).toEqual([starts[1]]);
    expect(next.locations).toEqual(['field']);
  });

  it('keeps the last Start', () => {
    const one: Entity = { ...herd, starts: [starts[0]] };
    expect(canRemoveGroupStartsAt(one, 'barn')).toBe(false);
    expect(withoutGroupStartsAt(one, 'barn')).toBe(one);
  });

  it('toggles a place: adds a Start where none begins, removes the ones that do', () => {
    expect(toggleGroupStart(herd, 'yard', newId).starts?.map((s) => s.place)).toEqual(['barn', 'field', 'yard']);
    expect(toggleGroupStart(herd, 'field', newId).starts).toEqual([starts[0]]);
  });

  it('reads as a routine that runs every Start and ignores Traversable', () => {
    expect(castRoutines([{ ...herd, traversable: 'anywhere' }])).toEqual([{ id: 'herd', starts, traversable: [], group: true }]);
  });
});

describe('a Group carried into another world', () => {
  it('keeps the Starts whose place maps, with their rows renamed, and drops a row left with no place', () => {
    const next = withGroupPlacesMapped(herd, { barn: 'stable', field: 'meadow' }, newId);
    expect(next.starts).toEqual([
      { id: 'a', place: 'stable', weight: 3, schedule: [] },
      { id: 'b', place: 'meadow', weight: 1, schedule: [] },
    ]);
    const kept = withGroupPlacesMapped(herd, { barn: 'stable', yard: 'pen' }, newId);
    expect(kept.starts).toEqual([{ ...starts[0], place: 'stable', schedule: [{ ...night, action: { kind: 'stay', place: 'pen' } }] }]);
    expect(kept.locations).toEqual(['stable', 'pen']);
  });

  it('renames Wander places and Patrol stops, dropping the ones the world lacks', () => {
    const roam: EntityStart = { id: 'r', place: 'barn', weight: 1, schedule: [
      { id: 'w', time: 'allDay', action: { kind: 'wander', places: [{ place: 'yard', weight: 2 }, { place: 'moor', weight: 1 }], idle: 60 } },
      { id: 'p', time: { start: 60, end: 120 }, action: { kind: 'patrol', stops: [{ place: 'moor', idle: 5 }, { place: 'barn', idle: 9 }] } },
      { id: 'gone', time: { start: 200, end: 300 }, action: { kind: 'patrol', stops: [{ place: 'moor', idle: 5 }] } },
    ] };
    const next = withGroupPlacesMapped({ ...herd, starts: [roam] }, { barn: 'stable', yard: 'pen' }, newId);
    expect(next.starts?.[0].schedule.map((row) => row.action)).toEqual([
      { kind: 'wander', places: [{ place: 'pen', weight: 2 }], idle: 60 },
      { kind: 'patrol', stops: [{ place: 'stable', idle: 9 }] },
    ]);
  });

  it('takes one Start per mapped place when no Start survives', () => {
    const next = withGroupPlacesMapped(herd, { yard: 'pen' }, newId);
    expect(next.starts?.map((s) => [s.place, s.schedule])).toEqual([['pen', []]]);
  });
});
