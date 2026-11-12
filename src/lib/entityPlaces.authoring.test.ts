/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it } from 'vitest';
import { PLAYER_START, type Connection, type Entity, type GameLocation, type ScheduleRow, type Stat, type World } from '@/types';
import { statBoxLookups, type CodeCardWorld } from '@/lib/codeWorldLookup';
import { runTestCode, type StatCodeWorld } from '@/lib/statCodeTestRun';
import { snapshotOf } from '@/lib/sandboxSnapshot';
import { standaloneStateOf } from '@/lib/openingState';
import { idsAt, samplePlacement } from '@/lib/entityPlaces';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { buildAiContext } from '@/lib/testBench/aiContext';
import { buildLens } from '@/lib/testBench/lens';

/**
 * Authoring reads the Sample Placement: the script hover card and a script run with no live positions place each
 * Unique entity at one place, as a Test Code run does.
 */

const loc = (id: string, over: Partial<GameLocation> = {}): GameLocation => ({ id, name: id[0].toUpperCase() + id.slice(1), ...over });
// The square is the one flagged start; the bakery sits in it; the docks are linked to the square.
const LOCATIONS: GameLocation[] = [loc('square', { isStarting: true }), loc('bakery', { parentId: 'square' }), loc('docks')];
const CONNECTIONS: Connection[] = [{ id: 'quay-road', a: 'square', b: 'docks', aToB: {}, bToA: {} }];
const row = (id: string, place: string): ScheduleRow => ({ id, time: { start: 600, end: 720 }, action: { kind: 'stay', place } });

// The cast as a world stores it: the list derived from each routine rides along.
const CAST: Entity[] = ([
  // Begins in the bakery; a late-morning row names the docks, which its stored list holds.
  { id: 'baker', name: 'Baker', kind: 'unique', traversable: [], starts: [
    { id: 'b1', place: 'bakery', weight: 1, schedule: [row('b1-am', 'docks')] },
  ] },
  // Begins wherever the player does, which its stored list leaves out.
  { id: 'urchin', name: 'Urchin', kind: 'unique', traversable: [], starts: [{ id: 'u1', place: PLAYER_START, weight: 1, schedule: [] }] },
  // No kind: it belongs where it lists.
  { id: 'gull', name: 'Gull', locations: ['docks'] },
] satisfies Entity[]);

const WORLD = {
  stats: [], statGroups: [], traits: [], traitGroups: [], entities: CAST, entityGroups: [], placeholders: [], placeholderGroups: [],
  dictionaries: [], locations: LOCATIONS, connections: CONNECTIONS,
} satisfies StatCodeWorld & CodeCardWorld;

const SELF: Stat = { id: 's', name: 'S', type: 'number', description: '', min: 0, max: 10, regen: 0, descriptors: [] };
const cardPresent = (place: GameLocation): readonly string[] =>
  statBoxLookups(WORLD)({ owner: null, timing: 'after', self: SELF }).location(place.id)?.present ?? [];

const PRESENT = (key: string) => `return locations.${key}.present.map((entity) => entity.name).join(',');`;
const testRunPresent = async (place: GameLocation): Promise<string[]> => {
  const report = await runTestCode(PRESENT(place.name), 'after', { kind: 'tool' }, WORLD, { args: {} });
  expect(report.error).toBeNull();
  return report.reply ? report.reply.split(',') : [];
};

describe('the script hover card reads the Sample Placement', () => {
  it.each(LOCATIONS)('lists at $id what a Test Code run of `present` gives', async (place) => {
    expect(cardPresent(place)).toEqual(await testRunPresent(place));
  });

  it('lists a Unique entity at its one sample place only', () => {
    expect(cardPresent(LOCATIONS[1])).toEqual(['Baker']);
    expect(cardPresent(LOCATIONS[2])).toEqual(['Gull']);
  });

  it('lists an entity that begins at Player\'s Starting Location on the sample start', () => {
    expect(cardPresent(LOCATIONS[0])).toEqual(['Urchin']);
  });
});

describe('an entity the opening cannot place has no Sample Placement (Q26)', () => {
  // Every Start is at Player's Starting Location, and a row names the docks; the sample has no player start.
  const stray: Entity = {
    id: 'stray', name: 'Stray', kind: 'unique', traversable: [],
    starts: [{ id: 's1', place: PLAYER_START, weight: 1, schedule: [row('s1-am', 'docks')] }],
  };
  const noStarts: Entity = { id: 'ghost', name: 'Ghost', kind: 'unique', traversable: [], starts: [] };

  it('places the stray nowhere, now that it stores no list', () => {
    expect(idsAt('docks', [stray], samplePlacement([stray], { locations: LOCATIONS, connections: CONNECTIONS }, undefined))).toEqual([]);
  });

  it.each([stray, noStarts])('places $name nowhere', (entity) => {
    const placesOf = samplePlacement([entity], { locations: LOCATIONS, connections: CONNECTIONS }, undefined);
    expect(placesOf(entity)).toEqual([]);
    expect(LOCATIONS.flatMap((place) => idsAt(place.id, [entity], placesOf))).toEqual([]);
  });
});

// The comparison reads the Sample Placement at each location.
const bundled = Object.entries(import.meta.glob<World>('@/defaultworlds/*.json', { import: 'default', eager: true }))
  .map(([path, world]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), world] as const);

describe.each(bundled)('the bundled world %s keeps its authoring cast', (_name, world) => {
  const locations = world.locations ?? [];
  const cast = world.entities ?? [];
  const sampleCast = (at: GameLocation) => idsAt(at.id, cast, samplePlacement(cast, { locations, connections: world.connections ?? [] }, at.id));

  it('in the authored chip scene at every location', () => {
    for (const at of locations) expect(authoredChipScene(world, { location: at }).presentIds, at.name).toEqual(sampleCast(at));
  });

  it('in the Test Bench AI context at every location', () => {
    const lensWorld = { ...world, traitGroups: world.traitGroups ?? [] };
    for (const at of locations) {
      const here = buildAiContext(world, buildLens(lensWorld, { personaId: null, locationId: at.id })).rosters.find((r) => r.scope === 'here')!;
      expect(here.entities.map((e) => e.id), at.name).toEqual(sampleCast(at));
    }
  });
});

describe('a script run with no live positions reads the Sample Placement', () => {
  const NO_LIVE = { positions: {}, genericPositions: {}, followers: [], waiting: [], routineNow: {} };
  const run = async (state: ReturnType<typeof standaloneStateOf>, place: GameLocation) => {
    const out = await snapshotOf(state).run({ home: { kind: 'tool' }, timing: 'before', code: PRESENT(place.name), args: {}, readOnly: true });
    expect(out.error).toBeNull();
    return out.reply ? out.reply.split(',') : [];
  };

  it('places each Unique entity at one place', async () => {
    const state = standaloneStateOf(WORLD, undefined, NO_LIVE);
    const at = await Promise.all(LOCATIONS.map((place) => run(state, place)));
    expect(at).toEqual([['Urchin'], ['Baker'], ['Gull']]);
  });

  it('reads the live places once the live book places someone', async () => {
    const live = { ...NO_LIVE, positions: { baker: 'docks', urchin: 'docks' } };
    const at = await Promise.all(LOCATIONS.map((place) => run(standaloneStateOf(WORLD, undefined, live), place)));
    expect(at).toEqual([[], [], ['Baker', 'Urchin', 'Gull']]);
  });
});
