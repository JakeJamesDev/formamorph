import { describe, expect, it } from 'vitest';
import {
  PLAYER_START, type Connection, type Entity, type GameLocation, type ScheduleRow, type WorldOverview,
} from '@/types';
import { idsAt, positionsIn, samplePlacement, type PlacesOf, type PlacesWorld } from '@/lib/entityPlaces';
import { castRoutines, withDerivedLocations } from '@/lib/entityKind';
import { presentEntityIds } from '@/lib/entityPresence';
import { EMPTY_BOOK, runtimeRoutine } from '@/lib/positionEngine';
import { placeAll, positionWorld } from '@/lib/positionPlay';
import { discoveredAsEntities } from '@/lib/runtimeCharacters';
import { liveChipScene, type LiveSceneSources } from '@/lib/chipValues/liveScene';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { NOON } from '@/test/entityKindFixture';

/**
 * Every reader of where an entity is, held to the Entity Places module on one world. A reader joins the table when it
 * moves to the module; each row names the question it asks.
 */

// The square holds the bakery and the chapel, and is flagged starting; the docks are linked to the square; the
// lighthouse is linked to nothing, so no row can reach it.
const loc = (id: string, over: Partial<GameLocation> = {}): GameLocation => ({ id, name: id, ...over });
const LOCATIONS: GameLocation[] = [
  loc('square', { isStarting: true }), loc('bakery', { parentId: 'square' }), loc('chapel', { parentId: 'square' }),
  loc('docks'), loc('lighthouse'),
];
const CONNECTIONS: Connection[] = [{ id: 'quay-road', a: 'square', b: 'docks', aToB: {}, bToA: {} }];
const WORLD: PlacesWorld = { locations: LOCATIONS, connections: CONNECTIONS };

const row = (id: string, time: ScheduleRow['time'], place: string): ScheduleRow => ({ id, time, action: { kind: 'stay', place } });
const MORNING = { start: 360, end: 720 };

// The cast as a world stores it: an entity with a kind carries the list derived from its routine.
const CAST: Entity[] = ([
  { id: 'baker', name: 'Baker', kind: 'unique', traversable: ['chapel'], starts: [
    { id: 'b1', place: 'bakery', weight: 2, schedule: [row('b1-am', MORNING, 'square')] },
    { id: 'b2', place: 'docks', weight: 1, schedule: [row('b2-day', 'allDay', 'lighthouse')] },
  ] },
  { id: 'gulls', name: 'Gulls', kind: 'generic', starts: [
    { id: 'g1', place: 'docks', weight: 1, schedule: [] },
    { id: 'g2', place: 'docks', weight: 1, schedule: [row('g2-day', 'allDay', 'square')] },
    { id: 'g3', place: 'chapel', weight: 1, schedule: [] },
  ] },
  { id: 'friar', name: 'Friar', kind: 'unique', traversable: 'anywhere', starts: [{ id: 'f1', place: 'chapel', weight: 1, schedule: [] }] },
  { id: 'urchin', name: 'Urchin', kind: 'unique', traversable: [], starts: [{ id: 'u1', place: PLAYER_START, weight: 1, schedule: [] }] },
] satisfies Entity[]).map(withDerivedLocations);

/** A character the story met at the docks this playthrough. */
const RUNTIME = discoveredAsEntities([{ entity: { id: 'sailor', name: 'Sailor' }, locationId: 'docks', sourceTurnId: 't-2' }]);
const EVERYONE = [...CAST, ...RUNTIME];

// The book a game reads at noon with the player in the square: every entity with a kind placed by the engine.
const BOOK = placeAll(EMPTY_BOOK, positionWorld(
  [...castRoutines(CAST), runtimeRoutine({ entity: RUNTIME[0], locationId: 'docks', sourceTurnId: 't-2' })!],
  NOON, 'square', LOCATIONS, CONNECTIONS, () => 0, 'square',
));

const liveSources: LiveSceneSources = {
  overview: '', stats: [], statPlacement: { groups: [], authored: [] }, traits: [], traitGroups: [],
  resolve: (text) => text, resolveTrait: (_t, text) => text, resolveEntity: (_e, text) => text,
  persona: null, location: null, locations: LOCATIONS, connections: CONNECTIONS,
  entities: CAST, allEntities: EVERYONE, participants: [], notes: '', time: null, placeholders: [],
};

const authoredWorld = {
  worldOverview: { name: 'Harbor Town', description: '' } as WorldOverview,
  stats: [], traits: [], locations: LOCATIONS, connections: CONNECTIONS, entities: CAST,
};

/** One reader: the question it asks, and its ids at each place through its own interface. */
interface Reader {
  name: string;
  /** The module's answer this reader must match at `place`. */
  answer: (place: GameLocation) => { cast: readonly Entity[]; placesOf: PlacesOf };
  read: (place: GameLocation) => string[];
}

const position = () => ({ cast: EVERYONE, placesOf: positionsIn(BOOK) });

const READERS: Reader[] = [
  {
    name: 'the turn\'s "who is here"',
    answer: position,
    read: (place) => presentEntityIds(EVERYONE, BOOK, place.id),
  },
  {
    name: 'the live chip scene',
    answer: position,
    read: (place) => liveChipScene(liveSources, place, { positions: BOOK.positions, generics: BOOK.generics }).presentIds,
  },
  {
    name: 'the authored chip scene',
    answer: (place) => ({ cast: CAST, placesOf: samplePlacement(CAST, WORLD, place.id) }),
    read: (place) => authoredChipScene(authoredWorld, { location: place }).presentIds,
  },
];

describe('every reader agrees with Entity Places', () => {
  it('runs on a book where everyone stands somewhere and no place is empty but the lighthouse', () => {
    for (const entity of EVERYONE) expect(positionsIn(BOOK)(entity), entity.id).not.toEqual([]);
    const occupied = new Set(EVERYONE.flatMap((entity) => positionsIn(BOOK)(entity)));
    expect(LOCATIONS.filter((l) => !occupied.has(l.id)).map((l) => l.id)).toEqual(['lighthouse']);
  });

  describe.each(READERS)('$name', ({ answer, read }) => {
    it.each(LOCATIONS)('at $id', (place) => {
      const { cast, placesOf } = answer(place);
      expect(read(place)).toEqual(idsAt(place.id, cast, placesOf));
    });
  });
});
