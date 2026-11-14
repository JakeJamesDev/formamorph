import { describe, expect, it } from 'vitest';
import { PLAYER_START, type Entity, type EntityStart } from '@/types';
import {
  canRemoveGenericStartsAt, castCourses, FIRST_ROUTINE_ID, toggleGenericStart, withRoutineMapped, withGenericStart, withKind, withoutGenericStart,
  withoutGenericStartsAt, withStartPlace,
} from './entityKind';
import { startsOf, applyingRoutine, withFirstStarts, withFirstTraversable } from '@/lib/entityKind';
import { oneRoutine } from '@/test/routines';

let n = 0;
const newId = () => `new-${++n}`;

const night: EntityStart['schedule'][number] = { id: 'night', time: { start: 1200, end: 360 }, strict: true, action: { kind: 'stay', place: 'yard' } };
const starts: EntityStart[] = [
  { id: 'a', place: 'barn', weight: 3, schedule: [night] },
  { id: 'b', place: 'field', weight: 1, schedule: [] },
];
const herd: Entity = { id: 'herd', name: 'Herd', kind: 'generic', routines: oneRoutine(starts) };
const mare: Entity = { id: 'mare', name: 'Mare', kind: 'unique', routines: oneRoutine(starts, ['barn']) };

describe('the kind switch', () => {
  it('keeps every Start, row, weight, Strict flag and Traversable both ways', () => {
    const asGeneric = withKind(mare, 'generic', newId);
    expect(asGeneric).toMatchObject({ kind: 'generic', routines: oneRoutine(starts, ['barn']) });
    expect(asGeneric).not.toHaveProperty('locations');
    expect(withKind(asGeneric, 'unique', newId)).toEqual(mare);
  });

  it('gives a kindless entity one Start per place as a Generic entity, and one at its first place as a Unique entity', () => {
    const loose: Entity = { id: 'x', name: 'X', locations: ['barn', 'field'] };
    expect(startsOf(withKind(loose, 'generic', newId)).map((s) => [s.place, s.schedule])).toEqual([['barn', []], ['field', []]]);
    expect(startsOf(withKind(loose, 'unique', newId)).map((s) => s.place)).toEqual(['barn']);
    expect(withKind(loose, 'generic', newId)).not.toHaveProperty('locations');
    expect(withKind(loose, 'unique', newId)).not.toHaveProperty('locations');
  });
});

describe("a Generic entity's Starts", () => {
  it('adds a Start with no rows, even at a place a Start already begins at', () => {
    const next = withGenericStart(herd, 'barn', newId);
    expect(startsOf(next).slice(2)).toEqual([expect.objectContaining({ place: 'barn', weight: 1, schedule: [] })]);
    expect(next).not.toHaveProperty('locations');
  });

  it('removes every Start that begins at a place, rows and all, and stores no list', () => {
    const twice = withGenericStart(herd, 'barn', newId);
    const next = withoutGenericStartsAt(twice, 'barn');
    expect(startsOf(next)).toEqual([starts[1]]);
    expect(next).not.toHaveProperty('locations');
  });

  it('keeps the last Start', () => {
    const one: Entity = withFirstStarts(herd, [starts[0]]);
    expect(canRemoveGenericStartsAt(one, 'barn')).toBe(false);
    expect(withoutGenericStartsAt(one, 'barn')).toBe(one);
  });

  it('removes one Start by id, leaving another at the same place, and keeps the last one', () => {
    const twice = withGenericStart(herd, 'barn', newId);
    const added = startsOf(twice)[2];
    expect(startsOf(withoutGenericStart(twice, 'a'))).toEqual([starts[1], added]);
    expect(withoutGenericStart(twice, 'a')).not.toHaveProperty('locations');
    const one: Entity = withFirstStarts(herd, [starts[0]]);
    expect(withoutGenericStart(one, 'a')).toBe(one);
    expect(withoutGenericStart(herd, 'missing')).toBe(herd);
  });

  it('toggles a place: adds a Start where none begins, removes the ones that do', () => {
    expect(startsOf(toggleGenericStart(herd, 'yard', newId)).map((s) => s.place)).toEqual(['barn', 'field', 'yard']);
    expect(startsOf(toggleGenericStart(herd, 'field', newId))).toEqual([starts[0]]);
  });

  it('reads as a routine that runs every Start and ignores Traversable', () => {
    expect(castCourses([withFirstTraversable(herd, 'anywhere')])).toEqual([
      { id: 'herd', routines: [{ id: FIRST_ROUTINE_ID, starts, traversable: [] }], applying: FIRST_ROUTINE_ID, generic: true },
    ]);
  });
});

describe('a Generic entity carried into another world', () => {
  it('keeps the Starts whose place maps, with their rows renamed, and drops a row left with no place', () => {
    const next = withRoutineMapped(herd, { barn: 'stable', field: 'meadow' }, newId);
    expect(startsOf(next)).toEqual([
      { id: 'a', place: 'stable', weight: 3, schedule: [] },
      { id: 'b', place: 'meadow', weight: 1, schedule: [] },
    ]);
    const kept = withRoutineMapped(herd, { barn: 'stable', yard: 'pen' }, newId);
    expect(startsOf(kept)).toEqual([{ ...starts[0], place: 'stable', schedule: [{ ...night, action: { kind: 'stay', place: 'pen' } }] }]);
    expect(kept).not.toHaveProperty('locations');
  });

  it('renames Wander places and Patrol stops, dropping the ones the world lacks', () => {
    const roam: EntityStart = { id: 'r', place: 'barn', weight: 1, schedule: [
      { id: 'w', time: 'allDay', action: { kind: 'wander', places: [{ place: 'yard', weight: 2 }, { place: 'moor', weight: 1 }], idle: 60 } },
      { id: 'p', time: { start: 60, end: 120 }, action: { kind: 'patrol', stops: [{ place: 'moor', idle: 5 }, { place: 'barn', idle: 9 }] } },
      { id: 'gone', time: { start: 200, end: 300 }, action: { kind: 'patrol', stops: [{ place: 'moor', idle: 5 }] } },
    ] };
    const next = withRoutineMapped(withFirstStarts(herd, [roam]), { barn: 'stable', yard: 'pen' }, newId);
    expect(startsOf(next)[0].schedule.map((row) => row.action)).toEqual([
      { kind: 'wander', places: [{ place: 'pen', weight: 2 }], idle: 60 },
      { kind: 'patrol', stops: [{ place: 'stable', idle: 9 }] },
    ]);
  });

  it('takes one Start per mapped place when no Start survives', () => {
    const next = withRoutineMapped(herd, { yard: 'pen' }, newId);
    expect(startsOf(next).map((s) => [s.place, s.schedule])).toEqual([['pen', []]]);
  });

  it("keeps a Start at the player's starting location, with its rows renamed", () => {
    const beside: EntityStart = { id: 'p', place: PLAYER_START, weight: 1, schedule: [night] };
    const next = withRoutineMapped(withFirstStarts(herd, [beside]), { yard: 'pen' }, newId);
    expect(startsOf(next)).toEqual([{ ...beside, schedule: [{ ...night, action: { kind: 'stay', place: 'pen' } }] }]);
  });
});

describe('a Unique entity carried into another world', () => {
  const both: Entity = { ...withFirstStarts(mare, [
    { id: 'a', place: 'barn', weight: 3, schedule: [
      night,
      { id: 'roam', time: 'allDay', action: { kind: 'wander', places: [{ place: 'yard', weight: 1 }, { place: 'moor', weight: 2 }], idle: 30 } },
      { id: 'lost', time: { start: 60, end: 120 }, action: { kind: 'stay', place: 'moor' } },
    ] },
    { id: 'b', place: 'moor', weight: 1, schedule: [] },
  ]) };

  it('keeps the Start whose place maps, with its rows renamed, and drops the Start and the rows that do not', () => {
    const next = withRoutineMapped(both, { barn: 'stable', yard: 'pen' }, newId);
    expect(startsOf(next)).toEqual([{ id: 'a', place: 'stable', weight: 3, schedule: [
      { ...night, action: { kind: 'stay', place: 'pen' } },
      { id: 'roam', time: 'allDay', action: { kind: 'wander', places: [{ place: 'pen', weight: 1 }], idle: 30 } },
    ] }]);
  });

  it('takes one Start with no rows at the first mapped place when no Start maps', () => {
    const next = withRoutineMapped(both, { yard: 'pen', field: 'meadow' }, newId);
    expect(startsOf(next).map((s) => [s.place, s.schedule])).toEqual([['pen', []]]);
  });

  it("keeps a Start at the player's starting location as it is", () => {
    const beside: EntityStart = { id: 'p', place: PLAYER_START, weight: 2, schedule: [], beginsFollowing: true };
    expect(startsOf(withRoutineMapped(withFirstStarts(both, [beside]), { yard: 'pen' }, newId))).toEqual([beside]);
  });

  it('maps a Can Also Go list and drops the places that do not map; Anywhere stays Anywhere', () => {
    const wide = withFirstTraversable(both, ['barn', 'moor', 'yard']);
    expect(applyingRoutine(withRoutineMapped(wide, { barn: 'stable', yard: 'pen' }, newId))?.traversable).toEqual(['stable', 'pen']);
    expect(applyingRoutine(withRoutineMapped(withFirstTraversable(both, 'anywhere'), { barn: 'stable' }, newId))?.traversable).toBe('anywhere');
  });
});

describe("the player's starting location", () => {
  const beside: EntityStart = { id: 'p', place: PLAYER_START, weight: 1, schedule: [night], beginsFollowing: true };

  it('keeps Begins Following only while the Start stays there', () => {
    expect(withStartPlace(beside, PLAYER_START).beginsFollowing).toBe(true);
    expect(withStartPlace(beside, 'barn')).toEqual({ id: 'p', place: 'barn', weight: 1, schedule: [night] });
  });
});
