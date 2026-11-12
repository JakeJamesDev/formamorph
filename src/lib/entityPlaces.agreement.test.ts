import { describe, expect, it } from 'vitest';
import {
  PLAYER_START, type Connection, type Entity, type GameLocation, type PersonaRef, type ScheduleRow, type Stat, type WorldOverview,
} from '@/types';
import {
  idsAt, idsAtAny, positionsIn, presenceIn, samplePlacement, startPlacesOf, type PlacesOf, type PlacesWorld,
} from '@/lib/entityPlaces';
import { pickMarks, type PickMark } from '@/lib/entityPicking';
import { presenceLines } from '@/lib/locationPresenceReasons';
import { castRoutines, withDerivedLocations } from '@/lib/entityKind';
import { presentEntityIds, type Standings } from '@/lib/entityPresence';
import { EMPTY_BOOK, runtimeRoutine, type PositionBook } from '@/lib/positionEngine';
import { placeAll, positionWorld, scriptPlaces } from '@/lib/positionPlay';
import { discoveredAsEntities, selectReachableVisitors } from '@/lib/runtimeCharacters';
import { computePresence } from '@/lib/presence';
import { metRosterByLocation } from '@/lib/metEntities';
import { nearbyPlaces } from '@/lib/locationGraph';
import { reachableEntityIds, sublocationEntityIds } from '@/lib/locationContext';
import { inPlayOwners } from '@/lib/ownedTraitsInPlay';
import { snapshotOf } from '@/lib/sandboxSnapshot';
import type { SandboxState } from '@/lib/statCodeTurn';
import { liveChipScene, type LiveSceneSources } from '@/lib/chipValues/liveScene';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { NOON } from '@/test/entityKindFixture';
import { statBoxLookups } from '@/lib/codeWorldLookup';
import { sampleStart } from '@/lib/startingLocation';
import { buildAiContext } from '@/lib/testBench/aiContext';
import { buildLens } from '@/lib/testBench/lens';
import { buildOpening, primeOpeningRolls } from '@/lib/testBench/opening';
import { openingPool, openingsEditorView, type PoolEntry } from '@/lib/openings';
import { standaloneStateOf } from '@/lib/openingState';
import { newGamePool } from '@/lib/newGameOpening';
import { selectVisitorAdditions } from '@/lib/turnPipeline/narrationReading';
import { openingPlacesOf, placementOf } from '@/lib/openingPlacement';

import { runRules, type RuleWorld } from '@/lib/testBench/rules';
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
const MET = [{ entity: { id: 'sailor', name: 'Sailor' }, locationId: 'docks', sourceTurnId: 't-2' }];
const RUNTIME = discoveredAsEntities(MET);
const EVERYONE = [...CAST, ...RUNTIME];

// The book a game reads at noon with the player in the square: every entity with a kind placed by the engine.
const BOOK = placeAll(EMPTY_BOOK, positionWorld(
  [...castRoutines(CAST), runtimeRoutine(MET[0])!], NOON, 'square', LOCATIONS, CONNECTIONS, () => 0, 'square',
));

// The same book with the baker and the gulls unplaced: each has a kind and no Position, and stands nowhere (Q10).
const { baker: _baker, ...placedButBaker } = BOOK.positions;
const { gulls: _gulls, ...genericsButGulls } = BOOK.generics;
const UNPLACED: PositionBook = { ...BOOK, positions: placedButBaker, generics: genericsButGulls };

const BOOKS = [
  { name: 'everyone placed', book: BOOK },
  { name: 'the baker and the gulls with no Position', book: UNPLACED },
];

const liveSources = (standings: Standings): LiveSceneSources => ({
  overview: '', stats: [], statPlacement: { groups: [], authored: [] }, traits: [], traitGroups: [],
  resolve: (text) => text, resolveTrait: (_t, text) => text, resolveEntity: (_e, text) => text,
  persona: null, location: null, locations: LOCATIONS, connections: CONNECTIONS,
  entities: CAST, allEntities: EVERYONE, standings, participants: [], notes: '', time: null, placeholders: [],
});

// The cast with an opening each, so an opening pool lists whom it reads at the start.
const WITH_OPENINGS: Entity[] = CAST.map((e) => ({ ...e, openings: [{ id: `${e.id}-hello`, text: 'Hello.', kind: 'action' }] }));
const OVERVIEW = { name: 'Harbor Town', description: '' } as WorldOverview;
const entityOwners = (pool: readonly PoolEntry[]) => pool.flatMap((row) => (row.ownerId && !row.locationId ? [row.ownerId] : []));

const authoredWorld = {
  worldOverview: { name: 'Harbor Town', description: '' } as WorldOverview,
  stats: [], traits: [], locations: LOCATIONS, connections: CONNECTIONS, entities: CAST,
};

/** One reader: the question it asks, and its ids at each place through its own interface. */
interface Reader {
  name: string;
  /** The module's answer this reader must match at `place` while the game reads `book`. */
  answer: (place: GameLocation, book: PositionBook) => { cast: readonly Entity[]; placesOf: PlacesOf };
  read: (place: GameLocation, book: PositionBook) => string[] | Promise<string[]>;
}

const position = (_place: GameLocation, book: PositionBook) => ({ cast: EVERYONE, placesOf: positionsIn(book) });
const authoredPosition = (_place: GameLocation, book: PositionBook) => ({ cast: CAST, placesOf: positionsIn(book) });
const presence = () => ({ cast: CAST, placesOf: presenceIn(WORLD) });

/** The places the narration can bring a visitor from: one Nearby link away. */
const nearbyOf = (place: GameLocation) => nearbyPlaces(place.id, LOCATIONS, CONNECTIONS);

/** The cast the canvas marks with `kind` at `place`, each entity picked in turn with `knownIn` (unset is Nearby). */
const canvasMarks = (knownIn: Entity['knownIn'], kind: PickMark['kind']) => (place: GameLocation) =>
  CAST.filter((entity) => pickMarks({ ...entity, knownIn }, LOCATIONS, CONNECTIONS).get(place.id)?.kind === kind)
    .map((entity) => entity.id);

const READERS: Reader[] = [
  {
    name: 'the turn\'s "who is here"',
    answer: position,
    read: (place, book) => presentEntityIds(EVERYONE, book, place.id),
  },
  {
    name: 'the live chip scene',
    answer: position,
    read: (place, book) => liveChipScene(liveSources(book), place).presentIds,
  },
  {
    name: 'the live chip scene under a turn box',
    answer: position,
    read: (place, book) => liveChipScene(liveSources(EMPTY_BOOK), place, { positions: book.positions, generics: book.generics }).presentIds,
  },
  {
    name: 'the met roster by location',
    answer: position,
    read: (place, book) => {
      const presence = computePresence({
        entities: CAST, runtime: RUNTIME, ...book, followers: [], locationId: 'square', locations: LOCATIONS,
        connections: CONNECTIONS, persona: null, met: EVERYONE.map((e) => e.id), strangerAliases: {}, turns: [],
      });
      const names = metRosterByLocation(presence.known)[place.id] ?? [];
      return EVERYONE.filter((e) => names.includes(e.name)).map((e) => e.id);
    },
  },
  {
    name: 'the reachable runtime visitors',
    answer: authoredPosition,
    read: (place, book) => selectReachableVisitors(CAST.map((e) => e.name), [place.id], CAST, [], book).map((e) => e.id),
  },
  {
    name: 'the new-game opening draw',
    answer: authoredPosition,
    read: (place, book) => entityOwners(newGamePool({
      pick: { ref: { source: 'none' } }, worldEntities: WITH_OPENINGS, overview: OVERVIEW, locations: LOCATIONS,
      startingLocationId: place.id, placesOf: positionsIn(book), picked: [],
    }).pool),
  },
  {
    name: 'the page-one redraw',
    answer: authoredPosition,
    read: (place, book) => entityOwners(openingPool({
      overview: OVERVIEW, entities: WITH_OPENINGS, locations: LOCATIONS, startingLocationId: place.id,
      placesOf: openingPlacesOf(placementOf(book), WITH_OPENINGS, WORLD, place.id),
    })),
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

/** A reader over several places at once: the module's ids across them, against the reader's own. */
interface ScopeReader {
  name: string;
  places: (place: GameLocation) => string[];
  read: (place: GameLocation, book: PositionBook) => string[];
}

const childrenOf = (place: GameLocation) => LOCATIONS.filter((l) => l.parentId === place.id).map((l) => l.id);
const liveScope = (book: PositionBook) => liveChipScene(liveSources(book), null);

const SCOPE_READERS: ScopeReader[] = [
  {
    name: 'the sub-location entities of the Entities chip',
    places: childrenOf,
    read: (place, book) => sublocationEntityIds(place, LOCATIONS, CONNECTIONS, CAST, liveScope(book).placesOf),
  },
  {
    name: 'the reachable entities of the Entities chip',
    places: nearbyOf,
    read: (place, book) => reachableEntityIds(place, LOCATIONS, CONNECTIONS, CAST, liveScope(book).placesOf),
  },
];

describe('every reader agrees with Entity Places', () => {
  it('runs on a book where everyone stands somewhere and no place is empty but the lighthouse', () => {
    for (const entity of EVERYONE) expect(positionsIn(BOOK)(entity), entity.id).not.toEqual([]);
    const occupied = new Set(EVERYONE.flatMap((entity) => positionsIn(BOOK)(entity)));
    expect(LOCATIONS.filter((l) => !occupied.has(l.id)).map((l) => l.id)).toEqual(['lighthouse']);
  });

  it('runs on a second book where the baker and the gulls stand nowhere, though each stores a list', () => {
    for (const id of ['baker', 'gulls']) {
      const entity = CAST.find((e) => e.id === id)!;
      expect(entity.locations?.length, id).toBeGreaterThan(0);
      expect(positionsIn(UNPLACED)(entity), id).toEqual([]);
    }
  });

  describe.each(BOOKS)('with $name', ({ book }) => {
    describe.each(READERS)('$name', ({ answer, read }) => {
      it.each(LOCATIONS)('at $id', async (place) => {
        const { cast, placesOf } = answer(place, book);
        expect(await read(place, book)).toEqual(idsAt(place.id, cast, placesOf));
      });
    });

    describe.each(SCOPE_READERS)('$name', ({ places, read }) => {
      it.each(LOCATIONS)('from $id', (place) => {
        expect(read(place, book)).toEqual(idsAtAny(places(place), CAST, positionsIn(book)));
      });
    });
  });
});

describe('the narration visitor additions agree with Entity Places', () => {
  const engine = positionWorld(castRoutines(CAST), NOON, 'square', LOCATIONS, CONNECTIONS, () => 0, 'square');
  const prose = `${CAST.map((e) => e.name).join(' and ')} come over.`;

  it('runs on a book where the narration brings the friar from the chapel to the square', () => {
    const after = selectVisitorAdditions({ prose, entities: CAST, allEntities: EVERYONE, location: LOCATIONS[0], book: BOOK, world: engine });
    expect([BOOK.positions.friar, after.positions.friar]).toEqual(['chapel', 'square']);
  });

  describe.each(BOOKS)('with $name', ({ book }) => {
    it.each(LOCATIONS)('brings to $id only those whose Position was one Nearby link away', (place) => {
      const after = selectVisitorAdditions({ prose, entities: CAST, allEntities: EVERYONE, location: place, book, world: engine });
      const pulled = CAST.filter((e) => after.positions[e.id] === place.id && book.positions[e.id] !== place.id).map((e) => e.id);
      const nearby = idsAtAny(nearbyOf(place), CAST, positionsIn(book));
      const here = idsAt(place.id, CAST, positionsIn(book));
      expect(pulled.filter((id) => !nearby.includes(id) || here.includes(id))).toEqual([]);
    });
  });
});

describe('the script snapshot agrees with Entity Places', () => {
  const persona: PersonaRef = { source: 'none' };
  const world = { traits: [], traitGroups: [], entities: CAST };
  const state = (book: PositionBook): SandboxState => ({
    stats: [], enabled: {}, clock: { deltaHours: 1, elapsedHours: 1 },
    ownerTraits: {
      acquired: [], disabledTraitIds: [], appliedValues: {}, entities: CAST, library: [], discovered: RUNTIME,
      world: { traits: [], groups: [], entities: CAST, persona, ...inPlayOwners(world, persona, []) },
    },
    places: { locations: LOCATIONS, location: { id: 'square', name: 'square' } },
    ...scriptPlaces(book, positionWorld(castRoutines(CAST), NOON, 'square', LOCATIONS, CONNECTIONS, () => 0, 'square')),
    resolveText: (text) => text,
  });
  const PRESENT = `return ${JSON.stringify(LOCATIONS.map((l) => l.name))}.map((name) => locations[name].present.map((e) => e.id));`;

  it.each(BOOKS)('lists who stands at each place with $name', async ({ book }) => {
    const result = await snapshotOf(state(book)).run({ home: { kind: 'tool' }, timing: 'after', code: PRESENT, args: {} });
    expect(result.error).toBeNull();
    expect(JSON.parse(result.reply ?? 'null')).toEqual(LOCATIONS.map((l) => idsAt(l.id, EVERYONE, positionsIn(book))));
  });
});

describe('the Test Bench rules agree with Presence', () => {
  const found = (ruleId: string, world: RuleWorld = { ...authoredWorld, statUpdates: [], dictionaries: [], placeholders: [] }) =>
    runRules(world).filter((f) => f.ruleId === ruleId);

  it('"location has no entities" flags the places no entity can be', () => {
    const empty = LOCATIONS.filter((l) => !CAST.some((entity) => presenceIn(WORLD)(entity).includes(l.id))).map((l) => l.id);
    expect(found('location-no-entities').map((f) => f.items[0].id)).toEqual(empty);
  });

  it('"placed in no location" flags the entities with an empty Presence', () => {
    const stranded: Entity = { id: 'ghost', name: 'Ghost', kind: 'unique', traversable: [], starts: [] };
    const world = { ...authoredWorld, entities: [...CAST, stranded], statUpdates: [], dictionaries: [], placeholders: [] };
    expect(found('entity-nowhere', world).map((f) => f.items[0].id)).toEqual(['ghost']);
  });

  it('"entity-row-unreachable" flags the row place Presence leaves out', () => {
    const [flag] = found('entity-row-unreachable');
    expect(flag.items[0].id).toBe('baker');
    expect(flag.message).toContain('lighthouse');
    expect(presenceIn(WORLD)(CAST.find((e) => e.id === 'baker')!)).not.toContain('lighthouse');
    expect(found('entity-row-unreachable')).toHaveLength(1);
  });

  it('"entity-location-orphan" flags a named place the world lacks, which Presence leaves out', () => {
    const lost: Entity = { id: 'lost', name: 'Lost', kind: 'unique', traversable: [], starts: [{ id: 'l1', place: 'gone', weight: 1, schedule: [] }] };
    const world = { ...authoredWorld, entities: [...CAST, lost], statUpdates: [], dictionaries: [], placeholders: [] };
    expect(found('entity-location-orphan', world).map((f) => f.items[0].id)).toEqual(['lost']);
    expect(presenceIn(WORLD)(lost)).toEqual([]);
    expect(found('entity-nowhere', world)).toEqual([]);
  });
});
