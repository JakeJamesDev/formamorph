import { describe, expect, it } from 'vitest';
import { PLAYER_START, type Entity, type GameLocation } from '@/types';
import { toLibraryItem } from './librarySources';
import { oneRoutine } from '@/test/routines';

const loc = (id: string): GameLocation => ({ id, name: `The ${id}` });

describe('the places a library entity carries', () => {
  it("names every place a Unique entity's routine names, Can Also Go included, and drops places the world lacks", () => {
    // As a world stores it today: the derived list holds the Start and row places, and not Can Also Go.
    const keeper: Entity = {
      id: 'keeper', name: 'Keeper', kind: 'unique',
      routines: oneRoutine([
        { id: 's1', place: 'gate', weight: 1, schedule: [{ id: 'r', time: 'allDay', action: { kind: 'stay', place: 'yard' } }] },
        { id: 's2', place: PLAYER_START, weight: 1, schedule: [] },
      ], ['tower', 'gone']),
    };
    const item = toLibraryItem(keeper, [], [loc('gate'), loc('yard'), loc('tower')]);
    expect(item.locationRefs).toEqual([
      { id: 'gate', name: 'The gate' }, { id: 'yard', name: 'The yard' }, { id: 'tower', name: 'The tower' },
    ]);
  });

  it('names the membership of an entity with no kind', () => {
    const loose: Entity = { id: 'x', name: 'X', locations: ['gate'] };
    const item = toLibraryItem(loose, [], [loc('gate')]);
    expect(item.locationRefs).toEqual([{ id: 'gate', name: 'The gate' }]);
  });
});
