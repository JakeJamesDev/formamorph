import { describe, expect, it } from 'vitest';
import { loadDevFixture } from './devFixtures';
import { migrateEntityRoutine, migrateWorld } from './version';
import { PLAYER_START, type Entity, type EntityStart, type World } from '@/types';

/** Every bundled world and the dev fixtures with a cast, through the same load migration the game runs. */

const OLD_FIELDS = ['presence', 'movement', 'starts', 'traversable'];

/** What breaks the new entity shape in `world`, one line per entity. Empty when every entity fits it. */
function shapeProblems(world: World): string[] {
  return (world.entities ?? []).flatMap((entity: Entity) => {
    const problems: string[] = [];
    const old = OLD_FIELDS.filter((key) => key in entity);
    if (old.length) problems.push(`${entity.id} keeps ${old.join(', ')}`);
    if (!entity.customPersona && entity.locations?.length && !entity.kind) problems.push(`${entity.id} has places and no kind`);
    if (entity.kind && 'locations' in entity) problems.push(`${entity.id} has a kind and stores locations`);
    if (entity.kind && !entity.routines?.length) problems.push(`${entity.id} has a kind and no Routine`);
    if (!entity.kind && 'routines' in entity) problems.push(`${entity.id} has Routines and no kind`);
    return problems;
  });
}

const bundled = import.meta.glob<{ default: unknown }>('../defaultworlds/*.json', { eager: true });

describe('the load migration over shipped content', () => {
  it.each(Object.keys(bundled))('leaves no entity of %s on the old fields', (path) => {
    expect(shapeProblems(migrateWorld(structuredClone(bundled[path].default)))).toEqual([]);
  });

  // The fixtures that carry a cast with places; the rest need a browser to load.
  it.each(['whiteRoom', 'entityPresence', 'entityFollowers'])('leaves no entity of the %s fixture on the old fields', async (name) => {
    const fixture = await loadDevFixture(name);
    expect(fixture?.world).toBeDefined();
    expect(shapeProblems(migrateWorld(fixture!.world!))).toEqual([]);
  });
});

/** A raw world in the 3.7.0 shape: Starts and Traversable on each entity. */
const flatWorld = (entities: Record<string, unknown>[]) => ({
  version: '3.7.0', worldOverview: { name: 'Quay' },
  locations: [{ id: 'quay', name: 'Quay' }, { id: 'inn', name: 'Inn' }], connections: [], entities,
});

const row = { id: 'r1', time: 'allDay', action: { kind: 'stay', place: 'inn' } };
const STARTS: EntityStart[] = [
  { id: 's1', place: 'quay', weight: 3, schedule: [row] as EntityStart['schedule'] },
  { id: 's2', place: PLAYER_START, weight: 1, schedule: [], beginsFollowing: true },
];

describe('Routines from flat Starts (Routines Q10, Q28)', () => {
  const migrated = () => migrateWorld(structuredClone(flatWorld([
    { id: 'pilot', name: 'Pilot', kind: 'unique', starts: STARTS, traversable: ['inn'] },
    { id: 'gulls', name: 'Gulls', kind: 'generic', starts: [STARTS[0]] },
    { id: 'blank', name: 'Blank', kind: 'unique', traversable: 'anywhere' },
    { id: 'me', name: 'Me', customPersona: true, locations: ['quay'] },
  ])));
  const byId = (world: World, id: string) => world.entities.find((e) => e.id === id)!;

  it('moves a Unique entity\'s Starts and Traversable into one ungated Routine named Routine 1', () => {
    const pilot = byId(migrated(), 'pilot');
    expect(pilot.routines).toEqual([{ id: 'routine-1', name: 'Routine 1', starts: STARTS, traversable: ['inn'] }]);
    expect(pilot).not.toHaveProperty('starts');
    expect(pilot).not.toHaveProperty('traversable');
  });

  it('gives a Generic entity with no Traversable a Routine with none', () => {
    expect(byId(migrated(), 'gulls').routines).toEqual([{ id: 'routine-1', name: 'Routine 1', starts: [STARTS[0]] }]);
  });

  it('gives an entity with a kind and no Starts one empty Routine', () => {
    expect(byId(migrated(), 'blank').routines).toEqual([{ id: 'routine-1', name: 'Routine 1', starts: [], traversable: 'anywhere' }]);
  });

  it('leaves a Custom Persona on its Start Locations list', () => {
    const me = byId(migrated(), 'me');
    expect(me.locations).toEqual(['quay']);
    expect(me).not.toHaveProperty('routines');
  });

  it('gives the same world on a second run', () => {
    const once = migrated();
    expect(migrateWorld(structuredClone(once))).toEqual(once);
  });

  it('round-trips a world exported after the migration and imported again', () => {
    const once = migrated();
    expect(migrateWorld(JSON.parse(JSON.stringify({ ...once, version: '3.7.1' })))).toEqual({ ...once, version: expect.any(String) });
  });

  it('keeps stored Routines over stray flat fields', () => {
    const routines = [{ id: 'routine-1', name: 'Day', starts: [STARTS[0]] }];
    const out = migrateEntityRoutine({ id: 'pilot', name: 'Pilot', kind: 'unique', routines, starts: STARTS, traversable: 'anywhere' });
    expect(out).toEqual({ id: 'pilot', name: 'Pilot', kind: 'unique', routines });
  });

  it('wraps a library entity read without a world, once', () => {
    const once = migrateEntityRoutine({ id: 'pilot', name: 'Pilot', kind: 'unique', starts: STARTS, traversable: 'anywhere' });
    expect(once).toEqual({ id: 'pilot', name: 'Pilot', kind: 'unique', routines: [{ id: 'routine-1', name: 'Routine 1', starts: STARTS, traversable: 'anywhere' }] });
    expect(migrateEntityRoutine(once)).toEqual(once);
  });
});
