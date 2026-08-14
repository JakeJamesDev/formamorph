import { describe, it, expect } from 'vitest';
import { APP_VERSION, migrateWorld, migrateSave, isSaveEnvelope } from './version';
import { entityIdsAt } from './entityPresence';
import { buildEntityContext } from './locationContext';
import type { Entity, GameLocation, SaveObject } from '@/types';

// Loose view of a migrated world for assertions (avoids `any`).
type DescItem = {
  playerDescription?: string;
  aiDescription?: string;
  inGameDescription?: string;
  detailedDescription?: string;
};
type MigratedWorld = {
  version?: string;
  customPlayerVRM?: unknown;
  worldOverview: { customPlayerVRM?: unknown };
  stats?: { name: string; morphBindings?: string[] }[];
  entities?: DescItem[];
  locations?: DescItem[];
  dictionary?: unknown[];
  dictionaries?: { id: string; name: string; enabled?: boolean; entries: { id: string; position?: string }[] }[];
};

describe('APP_VERSION', () => {
  it('is a non-empty version string (injected from package.json)', () => {
    expect(typeof APP_VERSION).toBe('string');
    expect(APP_VERSION.length).toBeGreaterThan(0);
  });
});

describe('migrateWorld — entity galleries', () => {
  it('folds a pre-gallery portrait into the gallery', () => {
    const out = migrateWorld({ worldOverview: {}, entities: [{ id: 'e', name: 'Wren', image: 'a' }] });
    expect(out.entities[0].images).toEqual(['a']);
    expect('image' in out.entities[0]).toBe(false);
  });

  it('folds even a world already stamped at the current version, which can still predate the gallery', () => {
    const out = migrateWorld({
      version: APP_VERSION,
      worldOverview: {},
      entities: [{ id: 'e', name: 'Wren', image: 'a' }],
    });
    expect(out.entities[0].images).toEqual(['a']);
  });

  it('leaves an authored gallery alone', () => {
    const out = migrateWorld({ worldOverview: {}, entities: [{ id: 'e', name: 'Wren', images: ['a', 'b'] }] });
    expect(out.entities[0].images).toEqual(['a', 'b']);
  });
});

describe('migrateWorld — entity-owned location membership (ADR-0003)', () => {
  // A world as 1.x–2.0 stored it: presence listed on each location. `entity` is the pre-audience-split
  // alias, which the description rename never folded, so worlds in the wild still carry it.
  const legacyWorld = () => ({
    worldOverview: {},
    locations: [
      { id: 'bar', name: 'The Bar', entities: ['alice', 'bar-keep'] },
      { id: 'docks', name: 'The Docks', entities: ['bar-keep', 'gull'] },
      { id: 'attic', name: 'The Attic' },
      { id: 'cellar', name: 'The Cellar', entity: ['gull'] },
    ],
    entities: [
      { id: 'alice', name: 'Alice' },
      { id: 'bar-keep', name: 'Bartender' },
      { id: 'gull', name: 'Gull' },
      { id: 'ghost', name: 'Ghost' },
    ],
  });

  /** Every location's roster as the legacy world stated it — read off the fixture, not recomputed. */
  const legacyRosters = (world: ReturnType<typeof legacyWorld>) =>
    Object.fromEntries(world.locations.map((l) => [
      l.id,
      [...((l as { entities?: string[] }).entities ?? []), ...((l as { entity?: string[] }).entity ?? [])].sort(),
    ]));

  const locationsOf = (w: unknown) => (w as { entities: { id: string; locations?: string[] }[] }).entities;

  it('inverts every roster onto the entities and strips the location-side lists', () => {
    const out = migrateWorld(legacyWorld()) as unknown as MigratedWorld & {
      locations: Record<string, unknown>[];
      entities: { id: string; locations?: string[] }[];
    };
    expect(locationsOf(out).find((e) => e.id === 'alice')!.locations).toEqual(['bar']);
    expect(locationsOf(out).find((e) => e.id === 'bar-keep')!.locations).toEqual(['bar', 'docks']);
    expect(locationsOf(out).find((e) => e.id === 'gull')!.locations).toEqual(['docks', 'cellar']);
    // Nobody listed the Ghost, so it gains no field at all.
    expect('locations' in locationsOf(out).find((e) => e.id === 'ghost')!).toBe(false);
    for (const loc of out.locations) {
      expect('entities' in loc).toBe(false);
      expect('entity' in loc).toBe(false);
    }
  });

  it('equivalence: every location rosters exactly who it listed before the flip', () => {
    const before = legacyWorld();
    const after = migrateWorld(before);
    const rosters = legacyRosters(legacyWorld());
    for (const id of Object.keys(rosters)) {
      expect(entityIdsAt(id, (after as unknown as { entities: Entity[] }).entities).sort()).toEqual(rosters[id]);
    }
  });

  it('renders the same roster text the location-owned world fed the AI', () => {
    const after = migrateWorld({
      worldOverview: {},
      locations: [{ id: 'bar', name: 'The Bar', entities: ['alice'] }],
      entities: [{ id: 'alice', name: 'Alice', aiDescription: 'The tenant.' }],
    }) as unknown as { locations: GameLocation[]; entities: Entity[] };
    expect(buildEntityContext(after.locations[0], after.entities)).toBe('Alice\n  description: The tenant.\n');
  });

  it('migrating twice is identical to migrating once', () => {
    const once = migrateWorld(legacyWorld());
    const twice = migrateWorld(structuredClone(once));
    expect(twice).toEqual(once);
  });

  it('runs on a world already stamped at APP_VERSION (shipped 2.x worlds predate the flip)', () => {
    const out = migrateWorld({ ...legacyWorld(), version: APP_VERSION }) as unknown as { entities: Entity[] };
    expect(entityIdsAt('bar', out.entities)).toEqual(['alice', 'bar-keep']);
  });

  it('drops an id naming no entity rather than carrying the dangle onto the entities', () => {
    const out = migrateWorld({
      worldOverview: {},
      locations: [{ id: 'bar', name: 'The Bar', entities: ['deleted-long-ago', 'alice'] }],
      entities: [{ id: 'alice', name: 'Alice' }],
    }) as unknown as { entities: Entity[] };
    expect(out.entities).toHaveLength(1);
    expect(entityIdsAt('bar', out.entities)).toEqual(['alice']);
  });

  it('leaves the rosters alone when the world has no entities array to move them to', () => {
    const out = migrateWorld({
      worldOverview: {},
      locations: [{ id: 'bar', name: 'The Bar', entities: ['alice'] }],
    }) as unknown as { locations: { entities?: string[] }[] };
    // Stripping first would destroy the only copy of the membership.
    expect(out.locations[0].entities).toEqual(['alice']);
  });

  it('merges into a membership an author already wrote, without duplicating it', () => {
    const out = migrateWorld({
      worldOverview: {},
      locations: [{ id: 'bar', name: 'The Bar', entities: ['alice'] }],
      entities: [{ id: 'alice', name: 'Alice', locations: ['bar', 'docks'] }],
    }) as unknown as { entities: Entity[] };
    expect(out.entities[0].locations).toEqual(['bar', 'docks']);
  });
});

describe('migrateWorld', () => {
  const vrmUrl = 'data:application/octet-stream;base64,Z2xURgIAAAD45iEB';

  it('moves a v1.2 root customPlayerVRM string into worldOverview and stamps the version', () => {
    const legacy = { worldOverview: { name: 'W' }, customPlayerVRM: vrmUrl, stats: [] };
    const out = migrateWorld(legacy) as unknown as MigratedWorld;
    expect(out.version).toBe(APP_VERSION);
    expect(out.customPlayerVRM).toBeUndefined(); // stray root key removed
    expect(out.worldOverview.customPlayerVRM).toEqual({ data: vrmUrl, type: 'model/vrm' });
  });

  it('treats an unversioned world without a VRM as legacy and stamps it (VRM null)', () => {
    const out = migrateWorld({ worldOverview: { name: 'W' } }) as unknown as MigratedWorld;
    expect(out.version).toBe(APP_VERSION);
    expect(out.worldOverview.customPlayerVRM).toBeNull();
  });

  it('passes through a world already at the current version (books preserved)', () => {
    const current = {
      version: APP_VERSION,
      worldOverview: { name: 'W', customPlayerVRM: { data: vrmUrl, type: 'model/vrm' } },
      dictionaries: [{ id: 'b1', name: 'Default', enabled: true, entries: [] }],
    };
    expect(migrateWorld(current)).toEqual(current);
  });

  it('is idempotent', () => {
    const legacy = { worldOverview: { name: 'W' }, customPlayerVRM: vrmUrl };
    const once = migrateWorld(legacy);
    expect(migrateWorld(once)).toEqual(once);
  });

  it('retypes an upstream `list` stat as a number seeded at its floor', () => {
    const legacy = {
      worldOverview: { name: 'W' },
      stats: [
        { name: 'Pack', type: 'list', min: 2, max: 10, value: [{ id: 'i1', name: 'Rope', description: '', number: 1 }] },
        { name: 'Health', type: 'number', min: 0, max: 100, value: 80 },
      ],
    };
    const out = migrateWorld(legacy) as unknown as { stats: { type: string; value: number }[] };
    expect(out.stats[0]).toMatchObject({ type: 'number', value: 2 });
    expect(out.stats[1]).toMatchObject({ type: 'number', value: 80 }); // numeric stats untouched
  });

  it('auto-binds legacy body stats (Stomach/Fatness/Breastsize) to their morphs', () => {
    const legacy = {
      worldOverview: { name: 'W' },
      stats: [
        { name: 'Stomach' },
        { name: 'Fatness' },
        { name: 'Breastsize' },
        { name: 'Health' },
      ],
    };
    const out = migrateWorld(legacy) as unknown as MigratedWorld;
    expect(out.stats?.map((s) => s.morphBindings)).toEqual([['Belly'], ['Fat'], ['Breasts'], undefined]);
  });

  it('leaves a body stat that already carries morphBindings untouched', () => {
    const legacy = {
      worldOverview: { name: 'W' },
      stats: [{ name: 'Stomach', morphBindings: ['B_Pear'] }],
    };
    const out = migrateWorld(legacy) as unknown as MigratedWorld;
    expect(out.stats?.[0].morphBindings).toEqual(['B_Pear']);
  });

  it('renames legacy description keys on entities and locations', () => {
    const out = migrateWorld({
      worldOverview: { name: 'W' },
      entities: [{ inGameDescription: 'p', detailedDescription: 'a' }],
      locations: [{ inGameDescription: 'lp', detailedDescription: 'la' }],
    }) as unknown as MigratedWorld;
    expect(out.entities?.[0]).toEqual({ playerDescription: 'p', aiDescription: 'a' });
    expect(out.locations?.[0]).toEqual({ playerDescription: 'lp', aiDescription: 'la' });
  });

  it("copies a trait's legacy description to both player and AI keys", () => {
    const out = migrateWorld({
      worldOverview: { name: 'W' },
      traits: [{ id: 't', name: 'Brave', description: 'Fearless.', statChanges: [] }],
    }) as unknown as {
      traits?: { playerDescription?: string; aiDescription?: string; description?: string }[];
    };
    // v1.2's single description was read by both player and AI, so both keys inherit it.
    expect(out.traits?.[0]).toMatchObject({ playerDescription: 'Fearless.', aiDescription: 'Fearless.' });
    expect(out.traits?.[0].description).toBeUndefined();
  });

  it('prefers an existing new key and drops the legacy one', () => {
    const out = migrateWorld({
      worldOverview: { name: 'W' },
      entities: [{ inGameDescription: 'old', playerDescription: 'new' }],
    }) as unknown as MigratedWorld;
    expect(out.entities?.[0]).toEqual({ playerDescription: 'new' });
  });

  it('folds a legacy flat dictionary into one "Default" book, positions preserved', () => {
    const out = migrateWorld({
      worldOverview: { name: 'W' },
      dictionary: [
        { id: 'a', name: 'x', key: 'x', value: 'v', position: 'before' },
        { id: 'b', name: 'y', key: 'y', value: 'w' },
      ],
    }) as unknown as MigratedWorld;
    expect(out.dictionary).toBeUndefined();
    expect(out.dictionaries).toHaveLength(1);
    expect(out.dictionaries?.[0]).toMatchObject({ name: 'Default', enabled: true });
    expect(out.dictionaries?.[0].entries.map((e) => e.id)).toEqual(['a', 'b']);
    expect(out.dictionaries?.[0].entries[0].position).toBe('before');
  });

  it('seeds one empty "Default" book when there is no dictionary at all', () => {
    const out = migrateWorld({ worldOverview: { name: 'W' } }) as unknown as MigratedWorld;
    expect(out.dictionaries).toHaveLength(1);
    expect(out.dictionaries?.[0]).toMatchObject({ name: 'Default', enabled: true });
    expect(out.dictionaries?.[0].entries).toEqual([]);
  });

  it('leaves an already-books world untouched and drops a stray flat dictionary', () => {
    const out = migrateWorld({
      version: APP_VERSION,
      worldOverview: { name: 'W' },
      dictionaries: [{ id: 'b1', name: 'Lore', enabled: true, entries: [] }],
      dictionary: [{ id: 'z', name: 'z', key: 'z', value: 'zz' }],
    }) as unknown as MigratedWorld;
    expect(out.dictionary).toBeUndefined();
    expect(out.dictionaries).toEqual([{ id: 'b1', name: 'Lore', enabled: true, entries: [] }]);
  });
});

describe('migrateWorld — dictionary keyword arrays', () => {
  type KeyedWorld = {
    dictionaries?: { entries: { key: string[]; secondaryKeys?: string[] }[] }[];
  };
  const withEntries = (entries: unknown[], version?: string) =>
    migrateWorld({
      ...(version ? { version } : {}),
      dictionaries: [{ id: 'b1', name: 'Lore', enabled: true, entries }],
    }) as unknown as KeyedWorld;

  it('splits legacy comma-joined keys into arrays', () => {
    const out = withEntries([{ id: 'a', name: 'a', key: 'dragon, wyrm ,, drake', value: 'v' }]);
    expect(out.dictionaries?.[0].entries[0].key).toEqual(['dragon', 'wyrm', 'drake']);
  });

  it('splits legacy secondaryKeys and drops the field when it is empty', () => {
    const [withSec, empty] = withEntries([
      { id: 'a', name: 'a', key: 'a', value: 'v', secondaryKeys: 'ruin,vault' },
      { id: 'b', name: 'b', key: 'b', value: 'v', secondaryKeys: '' },
    ]).dictionaries![0].entries;
    expect(withSec.secondaryKeys).toEqual(['ruin', 'vault']);
    expect('secondaryKeys' in empty).toBe(false);
  });

  it('leaves already-migrated entries untouched (idempotent, commas preserved)', () => {
    const entries = [{ id: 'a', name: 'a', key: ['\\d{2,3}', 'Elizabeth, Queen'], value: 'v' }];
    const once = withEntries(entries);
    const twice = migrateWorld(once) as unknown as KeyedWorld;
    expect(twice.dictionaries?.[0].entries[0].key).toEqual(['\\d{2,3}', 'Elizabeth, Queen']);
  });

  it('runs on a world already stamped at APP_VERSION (shipped 2.x worlds predate the change)', () => {
    const out = withEntries([{ id: 'a', name: 'a', key: 'dragon,wyrm', value: 'v' }], APP_VERSION);
    expect(out.dictionaries?.[0].entries[0].key).toEqual(['dragon', 'wyrm']);
  });

  it('defaults a missing key to []', () => {
    expect(withEntries([{ id: 'a', name: 'a', value: 'v' }]).dictionaries?.[0].entries[0].key).toEqual([]);
  });
});

describe('migrateSave — dictionary keyword arrays', () => {
  // A save carries its own copy of the playthrough's books; they need the same migration as the world's.
  const saveWith = (entries: unknown[], version: string | number = APP_VERSION) =>
    migrateSave({
      version,
      currentState: {},
      stateHistory: [],
      dictionaries: [{ id: 'b1', name: 'Lore', enabled: true, entries }],
    } as unknown as SaveObject) as unknown as { dictionaries?: { entries: { key: string[]; secondaryKeys?: string[] }[] }[] };

  it('splits legacy comma-joined keys in a save-carried book', () => {
    const out = saveWith([{ id: 'a', name: 'a', key: 'dragon, wyrm', value: 'v', secondaryKeys: 'ruin,vault' }]);
    expect(out.dictionaries?.[0].entries[0].key).toEqual(['dragon', 'wyrm']);
    expect(out.dictionaries?.[0].entries[0].secondaryKeys).toEqual(['ruin', 'vault']);
  });

  it('runs on a save already stamped at APP_VERSION', () => {
    expect(saveWith([{ id: 'a', name: 'a', key: 'dragon', value: 'v' }], APP_VERSION)
      .dictionaries?.[0].entries[0].key).toEqual(['dragon']);
  });

  it('leaves a save without dictionaries alone', () => {
    const out = migrateSave({ version: APP_VERSION, currentState: {}, stateHistory: [] } as unknown as SaveObject);
    expect('dictionaries' in out).toBe(false);
  });
});

describe('isSaveEnvelope', () => {
  it('recognizes the flat envelope (legacy v2 or current)', () => {
    expect(isSaveEnvelope({ currentState: {}, stateHistory: [], version: 2 })).toBe(true);
    expect(isSaveEnvelope({ currentState: {}, stateHistory: [], version: APP_VERSION })).toBe(true);
  });

  it('rejects deep-nested legacy and non-objects', () => {
    expect(isSaveEnvelope({ gameStates: [] })).toBe(false);
    expect(isSaveEnvelope(null)).toBe(false);
    expect(isSaveEnvelope('x')).toBe(false);
  });
});
