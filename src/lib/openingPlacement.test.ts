import { describe, expect, it } from 'vitest';
import type { Entity, EntityStart, GameLocation, ScheduleRow } from '@/types';
import type { PlacesWorld } from '@/lib/entityPlaces';
import { startRoutinePick } from '@/lib/inPlayWorld';
import { openingPlacesOf, placementOf } from '@/lib/openingPlacement';

const loc = (id: string, over: Partial<GameLocation> = {}): GameLocation => ({ id, name: id, ...over });
const LOCATIONS = [loc('town', { isStarting: true }), loc('market', { parentId: 'town' }), loc('well', { parentId: 'town' }), loc('forest')];
const WORLD: PlacesWorld = { locations: LOCATIONS, connections: [] };

const stay = (id: string, place: string): ScheduleRow => ({ id, time: 'allDay', action: { kind: 'stay', place } });
const start = (id: string, place: string, schedule: ScheduleRow[] = []): EntityStart => ({ id, place, weight: 1, schedule });

const ASH: Entity = { id: 'ash', name: 'Ash', persona: true };
/** Keeps the market while the player plays Ash; otherwise begins in the forest and stays in the town. */
const VELA: Entity = {
  id: 'vela', name: 'Vela', kind: 'unique', routines: [
    { id: 'night', name: 'Night', requires: [{ all: [{ kind: 'playingAs', id: 'ash' }] }], traversable: [], starts: [start('n', 'market')] },
    { id: 'day', name: 'Day', traversable: [], starts: [start('d', 'forest', [stay('d-r', 'town')])] },
  ],
};

describe('openingPlacesOf', () => {
  const cast = [VELA];
  const pickOf = (playing: string | null) => startRoutinePick({ entities: [VELA, ASH], locations: LOCATIONS }, playing);

  it('places a save with no stored placement from the Routine whose gate holds at the start', () => {
    expect(openingPlacesOf(undefined, cast, WORLD, 'town', pickOf(null))(VELA)).toEqual(['forest']);
    expect(openingPlacesOf(undefined, cast, WORLD, 'town', pickOf('ash'))(VELA)).toEqual(['market']);
  });

  it('reads the first Routine when no pick is given', () => {
    expect(openingPlacesOf(undefined, cast, WORLD, 'town')(VELA)).toEqual(['market']);
  });

  it('reads a stored placement, whatever the pick', () => {
    const stored = placementOf({ positions: { vela: 'well' }, generics: {} });
    expect(openingPlacesOf(stored, cast, WORLD, 'town', pickOf(null))(VELA)).toEqual(['well']);
  });
});
