import { describe, it, expect } from 'vitest';
import type { Connection, Entity, GameLocation } from '@/types';
import { reachableRosterIds } from './chipValues';

const LOCATIONS: GameLocation[] = [
  { id: 'town', name: 'Town' },
  { id: 'inn', name: 'Inn', parentId: 'town' },
  { id: 'cellar', name: 'Cellar', parentId: 'inn' },
  { id: 'market', name: 'Market', parentId: 'town' },
  { id: 'farm', name: 'Farm' },
] as GameLocation[];
const ROAD: Connection = { id: 'road', a: 'inn', b: 'farm', aToB: {}, bToA: {} };
const ENTITIES: Entity[] = [
  { id: 'keeper', name: 'Keeper', locations: ['inn'] },
  { id: 'rat', name: 'Rat', locations: ['cellar'] },
  { id: 'baker', name: 'Baker', locations: ['market'] },
  { id: 'farmer', name: 'Farmer', locations: ['farm'] },
  { id: 'hermit', name: 'Hermit', locations: ['market'], knownIn: 'nowhere' },
] as Entity[];
const scene = (location: GameLocation) => ({
  location, locations: LOCATIONS, connections: [ROAD], entities: ENTITIES, presentIds: ['keeper'],
});

describe('reachableRosterIds', () => {
  it('lists the Nearby entities at the parent and siblings, not here, below, or known nowhere', () => {
    expect(reachableRosterIds(scene(LOCATIONS[1]))).toEqual(['baker']);
  });

  it('adds the places one Connection away when the location sets Nearby Through Connections', () => {
    expect(reachableRosterIds(scene({ ...LOCATIONS[1], nearbyUsesConnections: true }))).toEqual(expect.arrayContaining(['baker', 'farmer']));
    expect(reachableRosterIds(scene({ ...LOCATIONS[1], nearbyUsesConnections: true }))).not.toContain('rat');
  });
});
