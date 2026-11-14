import { describe, expect, it } from 'vitest';
import { PLAYER_START, type Connection, type Entity, type EntityStart, type GameLocation, type ScheduleRow } from '@/types';
import {
  idsAt, idsAtAny, namedPlacesOf, positionOf, positionsIn, presenceIn, presenceOf, samplePlacement, startPlacesOf, withMembership, type PlacesWorld,
} from '@/lib/entityPlaces';
import { castRoutines, withFirstStarts } from '@/lib/entityKind';
import { EMPTY_BOOK } from '@/lib/positionEngine';
import { placeAll, positionWorld } from '@/lib/positionPlay';
import { discoveredAsEntities } from '@/lib/runtimeCharacters';
import { runtimePositions } from '@/lib/entityFollowing';
import { NOON } from '@/test/entityKindFixture';
import { oneRoutine } from '@/test/routines';

// Entities with a kind carry the derived list a world stores, which no answer may read.
// town > { market, well }, flagged starting; the forest is linked to the town; the island has no path from anywhere.
const loc = (id: string, over: Partial<GameLocation> = {}): GameLocation => ({ id, name: id, ...over });
const LOCATIONS = [loc('town', { isStarting: true }), loc('market', { parentId: 'town' }), loc('well', { parentId: 'town' }), loc('forest'), loc('island')];
const ROAD: Connection = { id: 'road', a: 'town', b: 'forest', aToB: {}, bToA: {} };
const WORLD: PlacesWorld = { locations: LOCATIONS, connections: [ROAD] };
const UNFLAGGED: PlacesWorld = { locations: LOCATIONS.map(({ isStarting: _s, ...l }) => l), connections: [ROAD] };

const stay = (id: string, place: string): ScheduleRow => ({ id, time: 'allDay', action: { kind: 'stay', place } });
const start = (id: string, place: string, schedule: ScheduleRow[] = [], weight = 1): EntityStart => ({ id, place, weight, schedule });

/** Begins at the market (weight 3) and wanders to the well; or begins in the forest and stays on the island. */
const MARA: Entity = {
  id: 'mara', name: 'Mara', kind: 'unique',
  routines: oneRoutine([
    start('s-market', 'market', [{ id: 'r-wander', time: 'allDay', action: { kind: 'wander', idle: 10, places: [{ place: 'market', weight: 1 }, { place: 'well', weight: 1 }] } }], 3),
    start('s-forest', 'forest', [stay('r-island', 'island')]),
  ], ['forest', 'well']),
};
/** Two Generic Entity Instances, both beginning at the well. */
const CROWS: Entity = { id: 'crows', name: 'Crows', kind: 'generic', routines: oneRoutine([start('c1', 'well'), start('c2', 'well', [stay('c2-r', 'forest')])], ['island']) };
/** Begins wherever the player does. */
const GUIDE: Entity = { id: 'guide', name: 'Guide', kind: 'unique', routines: oneRoutine([start('g', PLAYER_START, [stay('g-r', 'forest')])], 'anywhere') };
/** No kind: plain membership. */
const STATUE: Entity = { id: 'statue', name: 'Statue', locations: ['well', 'forest'] };
const CAST = [MARA, CROWS, GUIDE, STATUE];

const placeOf = (entity: Entity, world = WORLD) => presenceOf(entity, world).places.map((p) => p.place);
const reasonsAt = (entity: Entity, place: string, world = WORLD) => presenceOf(entity, world).places.find((p) => p.place === place)?.reasons;

describe('Presence', () => {
  it('names each place a Unique entity can be, with every reason, in order', () => {
    expect(presenceOf(MARA, WORLD)).toEqual({
      anywhere: false,
      places: [
        { place: 'market', reasons: [{ kind: 'begins', startIds: ['s-market'] }, { kind: 'row', startId: 's-market', rowId: 'r-wander' }] },
        { place: 'well', reasons: [{ kind: 'row', startId: 's-market', rowId: 'r-wander' }, { kind: 'traversable' }] },
        { place: 'forest', reasons: [{ kind: 'begins', startIds: ['s-forest'] }, { kind: 'traversable' }] },
      ],
    });
  });

  it('leaves out a row place with no path from its Start', () => {
    expect(placeOf(MARA)).not.toContain('island');
    const linked: PlacesWorld = { ...WORLD, connections: [ROAD, { id: 'ferry', a: 'forest', b: 'island', aToB: {} }] };
    expect(reasonsAt(MARA, 'island', linked)).toEqual([{ kind: 'row', startId: 's-forest', rowId: 'r-island' }]);
  });

  it('gives a Generic entity each Start once per place, and no Traversable', () => {
    expect(presenceOf(CROWS, WORLD)).toEqual({
      anywhere: false,
      places: [
        { place: 'well', reasons: [{ kind: 'begins', startIds: ['c1', 'c2'] }] },
        { place: 'forest', reasons: [{ kind: 'row', startId: 'c2', rowId: 'c2-r' }] },
      ],
    });
  });

  it('reads an entity with no kind from its membership', () => {
    expect(presenceOf(STATUE, WORLD)).toEqual({
      anywhere: false,
      places: [{ place: 'well', reasons: [{ kind: 'member' }] }, { place: 'forest', reasons: [{ kind: 'member' }] }],
    });
  });

  it('expands Player\'s Starting Location to the flagged starting locations', () => {
    expect(reasonsAt(GUIDE, 'town')).toEqual([{ kind: 'begins', startIds: ['g'] }]);
    expect(placeOf(GUIDE)).toEqual(['town', 'forest']);
  });

  it('expands Player\'s Starting Location to every location when none is flagged', () => {
    expect(placeOf(GUIDE, UNFLAGGED)).toEqual(['town', 'market', 'well', 'forest', 'island']);
    expect(reasonsAt(GUIDE, 'island', UNFLAGGED)).toEqual([{ kind: 'begins', startIds: ['g'] }]);
  });

  it('counts every row place of a Player\'s Starting Location Start, with no path check', () => {
    const wanderer = withFirstStarts(GUIDE, [start('g', PLAYER_START, [stay('to-island', 'island')])]);
    expect(reasonsAt(wanderer, 'island')).toEqual([{ kind: 'row', startId: 'g', rowId: 'to-island' }]);
    expect(placeOf(wanderer)).toEqual(['town', 'island']);
  });

  it('holds only places the world has, for every reason', () => {
    const lost: Entity = {
      id: 'lost', name: 'Lost', kind: 'unique',
      routines: oneRoutine([start('l1', 'gone-a', [stay('l1-r', 'gone-c')]), start('l2', 'market', [stay('l2-r', 'gone-d')])], ['gone-b', 'well']),
    };
    expect(placeOf(lost)).toEqual(['market', 'well']);
    expect(placeOf({ ...STATUE, locations: ['gone-e', 'well'] })).toEqual(['well']);
  });

  it('reports Traversable set to Anywhere as a flag that adds no place', () => {
    expect(presenceOf(GUIDE, WORLD).anywhere).toBe(true);
    expect(placeOf(GUIDE)).toEqual(['town', 'forest']);
  });

  it('inverts to the cast at a place and at any of several places, in cast order', () => {
    const presence = presenceIn(WORLD);
    expect(idsAt('forest', CAST, presence)).toEqual(['mara', 'crows', 'guide', 'statue']);
    expect(idsAt('well', [STATUE, MARA, CROWS], presence)).toEqual(['statue', 'mara', 'crows']);
    expect(idsAtAny(['market', 'town'], CAST, presence)).toEqual(['mara', 'guide']);
    expect(idsAt(undefined, CAST, presence)).toEqual([]);
  });
});

describe('the named places', () => {
  it('lists every place id the routine names, with no world and no path check', () => {
    expect(namedPlacesOf(MARA)).toEqual(['market', 'well', 'forest', 'island']);
    expect(namedPlacesOf(withFirstStarts(MARA, [start('x', 'gone', [stay('x-r', 'gone-too')])]))).toEqual(['gone', 'gone-too', 'forest', 'well']);
  });

  it('names no place for Player\'s Starting Location, and a Generic entity\'s Traversable too', () => {
    expect(namedPlacesOf(GUIDE)).toEqual(['forest']);
    expect(namedPlacesOf(CROWS)).toEqual(['well', 'forest', 'island']);
  });

  it('reads an entity with no kind from its membership', () => {
    expect(namedPlacesOf({ ...STATUE, locations: ['gone', 'well'] })).toEqual(['gone', 'well']);
  });
});

describe('Start places', () => {
  it('lists each Start place once, in Start order, without row places', () => {
    expect(startPlacesOf(MARA, WORLD)).toEqual(['market', 'forest']);
    expect(startPlacesOf(CROWS, WORLD)).toEqual(['well']);
  });

  it('expands Player\'s Starting Location to the flagged starting locations, else every location', () => {
    expect(startPlacesOf(GUIDE, WORLD)).toEqual(['town']);
    expect(startPlacesOf(GUIDE, UNFLAGGED)).toEqual(['town', 'market', 'well', 'forest', 'island']);
  });

  it('reads an entity with no kind from its membership', () => {
    expect(startPlacesOf(STATUE, WORLD)).toEqual(['well', 'forest']);
  });
});

describe('Position', () => {
  const book = placeAll(EMPTY_BOOK, positionWorld(castRoutines(CAST), NOON, 'town', LOCATIONS, [ROAD], () => 0, 'town'));

  it('puts a Unique entity at its one place', () => {
    expect(positionOf(MARA, { positions: { mara: 'well' }, generics: {} })).toEqual(['well']);
    expect(positionOf(GUIDE, book)).toEqual([book.positions.guide]);
  });

  it('puts a Generic entity at each place a Generic Entity Instance stands, once', () => {
    const generics = { crows: { c1: { position: 'well', lastRun: 0 }, c2: { position: 'well', lastRun: 0 } } };
    expect(positionOf(CROWS, { positions: {}, generics })).toEqual(['well']);
  });

  it('puts an entity with a kind and no Position nowhere', () => {
    expect(positionOf(MARA, { positions: {}, generics: {} })).toEqual([]);
    expect(positionOf(CROWS, { positions: {}, generics: {} })).toEqual([]);
  });

  it('reads an entity with no kind from its membership', () => {
    expect(positionOf(STATUE, book)).toEqual(['well', 'forest']);
  });

  it('gives a runtime character a Position, where it stands once the engine places it', () => {
    const records = [{ entity: { id: 'stranger', name: 'Stranger' }, locationId: 'market', sourceTurnId: 't' }];
    const [runtime] = discoveredAsEntities(records);
    // Its saved anchor, under the book's positions (Q41).
    const at = (book: Record<string, string>) => positionOf(runtime, { positions: { ...runtimePositions(records), ...book }, generics: {} });
    expect(at({})).toEqual(['market']);
    expect(at({ stranger: 'forest' })).toEqual(['forest']);
    expect(positionOf(runtime, { positions: {}, generics: {} })).toEqual([]);
  });

  it('inverts in cast order', () => {
    const standings = { positions: { mara: 'well', guide: 'town' }, generics: { crows: { c1: { position: 'well', lastRun: 0 } } } };
    expect(idsAt('well', CAST, positionsIn(standings))).toEqual(['mara', 'crows', 'statue']);
    expect(idsAtAny(['town', 'forest'], CAST, positionsIn(standings))).toEqual(['guide', 'statue']);
  });
});

describe('Sample Placement', () => {
  it('places a Unique entity from its first Start, a Generic entity from all, a no-kind entity at its membership', () => {
    const sample = samplePlacement(CAST, WORLD, 'town');
    expect(sample(MARA)).toEqual(['market']);
    expect(sample(CROWS)).toEqual(['well', 'forest']);
    expect(sample(GUIDE)).toEqual(['forest']);
    expect(sample(STATUE)).toEqual(['well', 'forest']);
  });

  it('places a Player\'s Starting Location entity at the given start', () => {
    const resting = withFirstStarts(GUIDE, [start('g', PLAYER_START)]);
    expect(samplePlacement([resting], WORLD, 'market')(resting)).toEqual(['market']);
    expect(samplePlacement([resting], WORLD, 'island')(resting)).toEqual(['island']);
  });

  it('places an entity with a kind outside the cast nowhere', () => {
    expect(samplePlacement([STATUE], WORLD, 'town')(MARA)).toEqual([]);
  });
});

describe('the membership write', () => {
  it('stores each place once, and drops the field when empty', () => {
    expect(withMembership(STATUE, ['well', 'well', 'town']).locations).toEqual(['well', 'town']);
    expect('locations' in withMembership(STATUE, [])).toBe(false);
  });
});
