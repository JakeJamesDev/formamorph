import { describe, expect, it, vi } from 'vitest';
import { PLAYER_START, type Entity, type World } from '@/types';
import { namedPlacesOf, presenceIn, presenceOf } from './entityPlaces';
import { startingLocationIds } from './locationGraph';
import { buildEntityCardData } from './entityFile';
import released from '@/test/v3.6.2-veilwood-world.json';

// The export path serializes off the main thread; the worker is the transport, not the shape under test.
const files = vi.hoisted(() => [] as string[]);
vi.mock('./jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(async (value: unknown, space?: number) => {
    files.push(JSON.stringify(value, null, space));
    return new Blob([files.at(-1)!]);
  }),
  parseJsonText: vi.fn(),
  terminateWorker: vi.fn(),
}));

const { migrateWorld } = await import('./version');
const { serializeWorldFile } = await import('./worldFile');

/** The world a file of `world` holds once loaded and saved again. */
async function savedAfterLoad(world: unknown): Promise<World> {
  files.length = 0;
  await serializeWorldFile(migrateWorld(structuredClone(world)) as World);
  return JSON.parse(files[0]) as World;
}

const placesOf = (world: World) => presenceIn({ locations: world.locations, connections: world.connections ?? [] });

describe('a world from v3.6.2', () => {
  const before = released as unknown as World;
  const world = migrateWorld(structuredClone(before)) as World;

  it('gives each placed entity but the Custom Persona a kind and Starts, and no stored list', () => {
    const placed = before.entities.filter((e) => !e.customPersona && e.locations?.length);
    expect(placed.length).toBeGreaterThan(10);
    for (const { id } of placed) {
      const entity = world.entities.find((e) => e.id === id)!;
      expect(entity.kind, entity.name).toBeDefined();
      expect(entity.starts?.length, entity.name).toBeGreaterThan(0);
      expect(entity, entity.name).not.toHaveProperty('locations');
    }
  });

  it('places each entity where its membership list did, plus only the places Q7 adds', () => {
    const presence = placesOf(world);
    for (const old of before.entities) {
      const entity = world.entities.find((e) => e.id === old.id)!;
      // A Start at Player's Starting Location stands for the starting locations (Q7).
      const added = (entity.starts ?? []).some((s) => s.place === PLAYER_START) ? startingLocationIds(world.locations) : [];
      const now = presence(entity);
      expect(now.filter((place) => !(old.locations ?? []).includes(place) && !added.includes(place)), entity.name).toEqual([]);
      expect((old.locations ?? []).filter((place) => !now.includes(place)), entity.name).toEqual([]);
    }
  });

  it('saves with no stored list on an entity with a kind', async () => {
    const saved = await savedAfterLoad(before);
    expect(saved.entities.filter((e) => e.kind && 'locations' in e).map((e) => e.name)).toEqual([]);
  });
});

describe('an unreleased world whose entity with a kind still stores a list (Q5, Q32)', () => {
  const stale = {
    version: '3.6.2',
    worldOverview: { name: 'Quay' },
    locations: [{ id: 'quay', name: 'Quay' }, { id: 'inn', name: 'Inn' }, { id: 'loft', name: 'Loft' }],
    connections: [{ id: 'c1', a: 'quay', b: 'inn', aToB: {}, bToA: {} }],
    entities: [{
      id: 'pilot', name: 'Pilot', kind: 'unique', traversable: [], locations: ['loft'],
      starts: [{ id: 's1', place: 'quay', weight: 1, schedule: [{ id: 'r1', time: 'allDay', action: { kind: 'stay', place: 'inn' } }] }],
    }],
  };

  it('loads with places from the routine only', () => {
    const world = migrateWorld(structuredClone(stale)) as World;
    expect(placesOf(world)(world.entities[0])).toEqual(['quay', 'inn']);
  });

  it('saves without the field', async () => {
    const saved = await savedAfterLoad(stale);
    expect(saved.entities[0]).not.toHaveProperty('locations');
    expect(saved.entities[0].starts).toEqual(stale.entities[0].starts);
  });
});

describe('the Custom Persona', () => {
  const world = {
    version: '3.6.2',
    worldOverview: { name: 'Quay' },
    locations: [{ id: 'quay', name: 'Quay' }, { id: 'inn', name: 'Inn' }],
    entities: [{ id: 'me', name: 'Me', customPersona: true, locations: ['quay', 'inn'] }],
  };

  it('keeps its stored locations across a load and a save', async () => {
    const saved = await savedAfterLoad(world);
    expect(saved.entities[0].locations).toEqual(['quay', 'inn']);
    expect(saved.entities[0]).not.toHaveProperty('kind');
    expect(presenceOf(saved.entities[0], { locations: saved.locations, connections: [] }).places.map((p) => p.place)).toEqual(['quay', 'inn']);
  });
});

describe('an exported entity card', () => {
  it('holds no locations for an entity with a kind, even one that still stores a list', () => {
    const pilot: Entity = {
      id: 'pilot', name: 'Pilot', kind: 'unique', traversable: [], locations: ['loft'],
      starts: [{ id: 's1', place: 'quay', weight: 1, schedule: [] }],
    };
    expect(namedPlacesOf(pilot)).toEqual(['quay']);
    expect(buildEntityCardData(pilot)).not.toHaveProperty('locations');
  });
});
