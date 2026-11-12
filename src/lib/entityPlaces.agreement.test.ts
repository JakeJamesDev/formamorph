import { describe, expect, it } from 'vitest';
import {
  PLAYER_START, type Connection, type Entity, type GameLocation, type ScheduleRow, type Stat, type WorldOverview,
} from '@/types';
import { idsAt, positionsIn, presenceIn, samplePlacement, startPlacesOf, type PlacesOf, type PlacesWorld } from '@/lib/entityPlaces';
import { pickMarks, type PickMark } from '@/lib/entityPicking';
import { presenceLines } from '@/lib/locationPresenceReasons';
import { castRoutines, withDerivedLocations } from '@/lib/entityKind';
import { presentEntityIds } from '@/lib/entityPresence';
import { EMPTY_BOOK, runtimeRoutine } from '@/lib/positionEngine';
import { placeAll, positionWorld } from '@/lib/positionPlay';
import { discoveredAsEntities } from '@/lib/runtimeCharacters';
import { liveChipScene, type LiveSceneSources } from '@/lib/chipValues/liveScene';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { NOON } from '@/test/entityKindFixture';
import { statBoxLookups } from '@/lib/codeWorldLookup';
import { sampleStart } from '@/lib/startingLocation';
import { buildAiContext } from '@/lib/testBench/aiContext';
import { buildLens } from '@/lib/testBench/lens';
import { buildOpening, primeOpeningRolls } from '@/lib/testBench/opening';
import { openingsEditorView } from '@/lib/openings';
import { standaloneStateOf } from '@/lib/openingState';
import { snapshotOf } from '@/lib/sandboxSnapshot';
const CARD_SELF: Stat = { id: 's', name: 'S', type: 'number', description: '', min: 0, max: 10, regen: 0, descriptors: [] };

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
  read: (place: GameLocation) => string[] | Promise<string[]>;
}

const position = () => ({ cast: EVERYONE, placesOf: positionsIn(BOOK) });
const presence = () => ({ cast: CAST, placesOf: presenceIn(WORLD) });

/** The cast the canvas marks with `kind` at `place`, each entity picked in turn with `knownIn` (unset is Nearby). */
const canvasMarks = (knownIn: Entity['knownIn'], kind: PickMark['kind']) => (place: GameLocation) =>
  CAST.filter((entity) => pickMarks({ ...entity, knownIn }, LOCATIONS, CONNECTIONS).get(place.id)?.kind === kind)
    .map((entity) => entity.id);

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
  {
    name: 'the Presence tab',
    answer: presence,
    read: (place) => presenceLines(place.id, CAST, WORLD).map((line) => line.entity.id),
  },
  { name: 'the canvas marks under Nearby', answer: presence, read: canvasMarks(undefined, 'routine') },
  { name: 'the canvas marks under Known In picks', answer: presence, read: canvasMarks(['lighthouse'], 'member') },
  {
    name: 'the script hover card',
    answer: () => ({ cast: CAST, placesOf: samplePlacement(CAST, WORLD, sampleStart(LOCATIONS)?.id) }),
    read: (place) => {
      const card = statBoxLookups({ ...authoredWorld, placeholders: [], statGroups: [], traitGroups: [], entityGroups: [], dictionaries: [] })({ owner: null, timing: 'after', self: CARD_SELF });
      return (card.location(place.id)?.present ?? []).map((name) => CAST.find((entity) => entity.name === name)!.id);
    },
  },
  {
    name: 'the Test Bench AI context',
    answer: (place) => ({ cast: CAST, placesOf: samplePlacement(CAST, WORLD, place.id) }),
    read: (place) => {
      const lens = buildLens({ ...authoredWorld, traitGroups: [] }, { personaId: null, locationId: place.id });
      return buildAiContext({ ...authoredWorld, dictionaries: [] }, lens)
        .rosters.find((roster) => roster.scope === 'here')!.entities.map((entity) => entity.id);
    },
  },
  {
    name: 'the Openings tab, with the place as the one start',
    answer: (place) => ({ cast: CAST, placesOf: (entity) => startPlacesOf(entity, { locations: onlyStart(place) }) }),
    read: (place) => openingsEditorView({ overview: authoredWorld.worldOverview, entities: withOpenings, locations: onlyStart(place) })
      .groups.filter((group) => group.entity && !group.atNoStart).map((group) => group.entity!.id),
  },
  {
    name: 'the Test Bench opening pool, with the place as the one start',
    answer: (place) => ({ cast: CAST, placesOf: samplePlacement(CAST, WORLD, place.id) }),
    read: (place) => {
      const world = { ...authoredWorld, entities: withOpenings, locations: onlyStart(place), traitGroups: [], statUpdates: [], dictionaries: [] };
      const pool = buildOpening(world, buildLens(world, { personaId: null, locationId: null }), primeOpeningRolls(world), { startLocationId: place.id }).pool;
      return pool.flatMap((row) => CAST.filter((entity) => entity.name === row.ownerName).map((entity) => entity.id));
    },
  },
  {
    name: 'a script run with no live positions',
    answer: () => ({ cast: CAST, placesOf: samplePlacement(CAST, WORLD, sampleStart(LOCATIONS)?.id) }),
    read: async (place) => {
      const state = standaloneStateOf(authoredWorld, undefined, { positions: {}, genericPositions: {} });
      const code = `return locations.${place.name}.present.map((entity) => entity.name).join(',');`;
      const out = await snapshotOf(state).run({ home: { kind: 'tool' }, timing: 'before', code, args: {}, readOnly: true });
      return (out.reply ? out.reply.split(',') : []).map((name) => CAST.find((entity) => entity.name === name)!.id);
    },
  },
];

/** The fixture with `place` as its one starting location. */
function onlyStart(place: GameLocation): GameLocation[] {
  return LOCATIONS.map((l) => ({ ...l, isStarting: l.id === place.id }));
}

/** The cast, each with one opening, so the Openings readers list it. */
const withOpenings: Entity[] = CAST.map((entity) => ({ ...entity, openings: [{ id: `o-${entity.id}`, text: `${entity.name}.`, kind: 'action' }] }));

describe('every reader agrees with Entity Places', () => {
  it('runs on a book where everyone stands somewhere and no place is empty but the lighthouse', () => {
    for (const entity of EVERYONE) expect(positionsIn(BOOK)(entity), entity.id).not.toEqual([]);
    const occupied = new Set(EVERYONE.flatMap((entity) => positionsIn(BOOK)(entity)));
    expect(LOCATIONS.filter((l) => !occupied.has(l.id)).map((l) => l.id)).toEqual(['lighthouse']);
  });

  describe.each(READERS)('$name', ({ answer, read }) => {
    it.each(LOCATIONS)('at $id', async (place) => {
      const { cast, placesOf } = answer(place);
      expect(await read(place)).toEqual(idsAt(place.id, cast, placesOf));
    });
  });
});
