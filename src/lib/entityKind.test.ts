import { describe, expect, it } from 'vitest';
import { PLAYER_START, type Entity, type EntityStart } from '@/types';
import {
  canRemoveGenericStartsAt, castRoutines, toggleGenericStart, withDerivedLocations, withGenericPlacesMapped, withGenericStart, withKind, withoutGenericStart,
  withoutGenericStartsAt, withStartPlace,
} from './entityKind';

let n = 0;
const newId = () => `new-${++n}`;

const night: EntityStart['schedule'][number] = { id: 'night', time: { start: 1200, end: 360 }, strict: true, action: { kind: 'stay', place: 'yard' } };
const starts: EntityStart[] = [
  { id: 'a', place: 'barn', weight: 3, schedule: [night] },
  { id: 'b', place: 'field', weight: 1, schedule: [] },
];
const herd: Entity = { id: 'herd', name: 'Herd', kind: 'generic', locations: ['barn', 'yard', 'field'], starts };
const mare: Entity = { id: 'mare', name: 'Mare', kind: 'unique', locations: ['barn', 'yard', 'field'], starts, traversable: ['barn'] };

describe('the kind switch', () => {
  it('keeps every Start, row, weight, Strict flag and Traversable both ways', () => {
    const asGeneric = withKind(mare, 'generic', newId);
    expect(asGeneric).toMatchObject({ kind: 'generic', starts, traversable: ['barn'], locations: ['barn', 'yard', 'field'] });
    expect(withKind(asGeneric, 'unique', newId)).toEqual(mare);
  });

  it('gives a kindless entity one Start per place as a Generic entity, and one at its first place as a Unique entity', () => {
    const loose: Entity = { id: 'x', name: 'X', locations: ['barn', 'field'] };
    expect(withKind(loose, 'generic', newId).starts?.map((s) => [s.place, s.schedule])).toEqual([['barn', []], ['field', []]]);
    expect(withKind(loose, 'unique', newId).starts?.map((s) => s.place)).toEqual(['barn']);
  });
});

describe("a Generic entity's Starts", () => {
  it('adds a Start with no rows, even at a place a Start already begins at', () => {
    const next = withGenericStart(herd, 'barn', newId);
    expect(next.starts?.slice(2)).toEqual([expect.objectContaining({ place: 'barn', weight: 1, schedule: [] })]);
    expect(next.locations).toEqual(['barn', 'yard', 'field']);
  });

  it('removes every Start that begins at a place, rows and all, and rewrites its locations', () => {
    const twice = withGenericStart(herd, 'barn', newId);
    const next = withoutGenericStartsAt(twice, 'barn');
    expect(next.starts).toEqual([starts[1]]);
    expect(next.locations).toEqual(['field']);
  });

  it('keeps the last Start', () => {
    const one: Entity = { ...herd, starts: [starts[0]] };
    expect(canRemoveGenericStartsAt(one, 'barn')).toBe(false);
    expect(withoutGenericStartsAt(one, 'barn')).toBe(one);
  });

  it('removes one Start by id, leaving another at the same place, and keeps the last one', () => {
    const twice = withGenericStart(herd, 'barn', newId);
    const added = twice.starts![2];
    expect(withoutGenericStart(twice, 'a').starts).toEqual([starts[1], added]);
    expect(withoutGenericStart(twice, 'a').locations).toEqual(['field', 'barn']);
    const one: Entity = { ...herd, starts: [starts[0]] };
    expect(withoutGenericStart(one, 'a')).toBe(one);
    expect(withoutGenericStart(herd, 'missing')).toBe(herd);
  });

  it('toggles a place: adds a Start where none begins, removes the ones that do', () => {
    expect(toggleGenericStart(herd, 'yard', newId).starts?.map((s) => s.place)).toEqual(['barn', 'field', 'yard']);
    expect(toggleGenericStart(herd, 'field', newId).starts).toEqual([starts[0]]);
  });

  it('reads as a routine that runs every Start and ignores Traversable', () => {
    expect(castRoutines([{ ...herd, traversable: 'anywhere' }])).toEqual([{ id: 'herd', starts, traversable: [], generic: true }]);
  });
});

describe('a Generic entity carried into another world', () => {
  it('keeps the Starts whose place maps, with their rows renamed, and drops a row left with no place', () => {
    const next = withGenericPlacesMapped(herd, { barn: 'stable', field: 'meadow' }, newId);
    expect(next.starts).toEqual([
      { id: 'a', place: 'stable', weight: 3, schedule: [] },
      { id: 'b', place: 'meadow', weight: 1, schedule: [] },
    ]);
    const kept = withGenericPlacesMapped(herd, { barn: 'stable', yard: 'pen' }, newId);
    expect(kept.starts).toEqual([{ ...starts[0], place: 'stable', schedule: [{ ...night, action: { kind: 'stay', place: 'pen' } }] }]);
    expect(kept.locations).toEqual(['stable', 'pen']);
  });

  it('renames Wander places and Patrol stops, dropping the ones the world lacks', () => {
    const roam: EntityStart = { id: 'r', place: 'barn', weight: 1, schedule: [
      { id: 'w', time: 'allDay', action: { kind: 'wander', places: [{ place: 'yard', weight: 2 }, { place: 'moor', weight: 1 }], idle: 60 } },
      { id: 'p', time: { start: 60, end: 120 }, action: { kind: 'patrol', stops: [{ place: 'moor', idle: 5 }, { place: 'barn', idle: 9 }] } },
      { id: 'gone', time: { start: 200, end: 300 }, action: { kind: 'patrol', stops: [{ place: 'moor', idle: 5 }] } },
    ] };
    const next = withGenericPlacesMapped({ ...herd, starts: [roam] }, { barn: 'stable', yard: 'pen' }, newId);
    expect(next.starts?.[0].schedule.map((row) => row.action)).toEqual([
      { kind: 'wander', places: [{ place: 'pen', weight: 2 }], idle: 60 },
      { kind: 'patrol', stops: [{ place: 'stable', idle: 9 }] },
    ]);
  });

  it('takes one Start per mapped place when no Start survives', () => {
    const next = withGenericPlacesMapped(herd, { yard: 'pen' }, newId);
    expect(next.starts?.map((s) => [s.place, s.schedule])).toEqual([['pen', []]]);
  });

  it("keeps a Start at the player's starting location, with its rows renamed", () => {
    const beside: EntityStart = { id: 'p', place: PLAYER_START, weight: 1, schedule: [night] };
    const next = withGenericPlacesMapped({ ...herd, starts: [beside] }, { yard: 'pen' }, newId);
    expect(next.starts).toEqual([{ ...beside, schedule: [{ ...night, action: { kind: 'stay', place: 'pen' } }] }]);
  });
});

describe("the player's starting location", () => {
  const beside: EntityStart = { id: 'p', place: PLAYER_START, weight: 1, schedule: [night], beginsFollowing: true };

  it('adds no place to the derived locations', () => {
    expect(withDerivedLocations({ ...mare, starts: [beside] }).locations).toEqual(['yard']);
    expect(withDerivedLocations({ ...mare, starts: [{ ...beside, schedule: [] }] }).locations).toBeUndefined();
  });

  it('keeps Begins Following only while the Start stays there', () => {
    expect(withStartPlace(beside, PLAYER_START).beginsFollowing).toBe(true);
    expect(withStartPlace(beside, 'barn')).toEqual({ id: 'p', place: 'barn', weight: 1, schedule: [night] });
  });
});
