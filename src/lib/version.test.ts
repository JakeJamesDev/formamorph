import { describe, it, expect } from 'vitest';
import { APP_VERSION, migrateWorld, migrateSave, isSaveEnvelope, migrateCarriedPlaceholders } from './version';
import { placeholderWeight } from './placeholders';
import { entityIdsAt } from './entityPresence';
import { buildEntityContext, navigableDestinationEntries } from './locationContext';
import { effectiveDestinations } from './locationGraph';
import type { Connection, Entity, GameLocation, Placeholder, SaveObject, World } from '@/types';

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

describe('migrateWorld — connection records (ADR-0002)', () => {
  // A world as 1.x–2.0 stored it: each location naming the places it connected to. Green and Cottage
  // declare each other; Green→Landing is one-sided; "Nowhere" names no location at all.
  const legacyWorld = () => ({
    worldOverview: {},
    locations: [
      { id: 'green', name: 'Green', parentId: 'hamlet', connections: ['Cottage', 'Eelhouse', 'Landing', 'Nowhere'] },
      { id: 'cottage', name: 'Cottage', parentId: 'hamlet', connections: ['green'] }, // matched case-insensitively
      { id: 'eel', name: 'Eelhouse', parentId: 'hamlet' }, // named by the Green, names nobody back
      { id: 'hamlet', name: 'Hamlet' },
      { id: 'landing', name: 'Landing' },
    ],
    entities: [],
  });

  type WithConnections = { locations: (GameLocation & { connections?: string[] })[]; connections?: Connection[] };
  const migrated = (raw: unknown) => migrateWorld(raw) as unknown as WithConnections;
  const record = (world: WithConnections, a: string, b: string) =>
    world.connections!.find((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a));

  /**
   * Effective destinations as the pre-migration union rule computed them: authored names resolved
   * case-insensitively, plus children, plus the containing location and its other children. This is the
   * contract the migration has to preserve, written out rather than borrowed from the code that replaced it.
   */
  const legacyDestinations = (id: string, locations: (GameLocation & { connections?: string[] })[]) => {
    const current = locations.find((l) => l.id === id)!;
    const byLowerName = new Map(locations.map((l) => [l.name.toLowerCase(), l]));
    const out = new Set<string>();
    const add = (loc?: GameLocation) => { if (loc && loc.id !== id) out.add(loc.id); };
    for (const name of current.connections ?? []) add(byLowerName.get(name.toLowerCase().trim()));
    for (const child of locations.filter((l) => (l.parentId ?? null) === id)) add(child);
    const parentId = current.parentId ?? null;
    if (parentId !== null) {
      add(locations.find((l) => l.id === parentId));
      for (const sib of locations.filter((l) => l.id !== id && (l.parentId ?? null) === parentId)) add(sib);
    }
    return [...out].sort();
  };

  it('pair-merges reciprocal declarations into one two-way record', () => {
    const out = migrated(legacyWorld());
    const pair = out.connections!.filter((c) =>
      [c.a, c.b].sort().join('|') === ['green', 'cottage'].sort().join('|'));
    expect(pair).toHaveLength(1);
    expect(pair[0]).toMatchObject({ aToB: {}, bToA: {} });
  });

  it('makes an unmatched declaration a one-way record from the declaring end', () => {
    const out = migrated(legacyWorld());
    const link = record(out, 'green', 'landing')!;
    expect(link).toEqual({ id: expect.any(String), a: 'green', b: 'landing', aToB: {} });
  });

  it('drops a name matching no location and strips every list from the locations', () => {
    const out = migrated(legacyWorld());
    // Green↔Cottage, Green↔Eelhouse and Green→Landing; "Nowhere" contributes none.
    expect(out.connections).toHaveLength(3);
    for (const loc of out.locations) expect('connections' in loc).toBe(false);
  });

  it('records a one-sided declaration between tree-adjacent locations two-way, so neither end loses a trip', () => {
    // Green names its sibling the Cottage; the Cottage names nobody. The record replaces their implicit
    // link, so recording it one-way would strand the Cottage — it could no longer walk back to the Green.
    const out = migrated({
      worldOverview: {},
      locations: [
        { id: 'green', name: 'Green', parentId: 'hamlet', connections: ['Cottage'] },
        { id: 'cottage', name: 'Cottage', parentId: 'hamlet' },
        { id: 'hamlet', name: 'Hamlet' },
      ],
      entities: [],
    });
    expect(out.connections![0]).toMatchObject({ aToB: {}, bToA: {} });
    expect([...effectiveDestinations('cottage', out.locations, out.connections!).keys()].sort())
      .toEqual(['green', 'hamlet']);
  });

  it('equivalence: every location reaches exactly where it reached before the migration', () => {
    const before = legacyWorld();
    const expected = Object.fromEntries(
      before.locations.map((l) => [l.id, legacyDestinations(l.id, before.locations)]),
    );
    const after = migrated(legacyWorld());
    for (const loc of after.locations) {
      expect([...effectiveDestinations(loc.id, after.locations, after.connections ?? []).keys()].sort())
        .toEqual(expected[loc.id]);
    }
  });

  it('migrating twice is identical to migrating once', () => {
    const once = migrateWorld(legacyWorld());
    const twice = migrateWorld(structuredClone(once));
    expect(twice).toEqual(once);
  });

  it('runs on a world already stamped at APP_VERSION (shipped 2.x worlds predate the records)', () => {
    const out = migrated({ ...legacyWorld(), version: APP_VERSION });
    expect(out.connections).toHaveLength(3);
  });

  it('leaves a world with no name lists without a connections array of its own making', () => {
    const out = migrated({
      worldOverview: {},
      locations: [{ id: 'green', name: 'Green' }],
      entities: [],
    });
    expect(out.connections).toBeUndefined();
  });

  it('keeps records an author already authored, appending the migrated ones', () => {
    const authored: Connection = { id: 'existing', a: 'hamlet', b: 'landing', aToB: {}, bToA: {} };
    const out = migrated({ ...legacyWorld(), connections: [authored] });
    expect(out.connections![0]).toEqual(authored);
    expect(out.connections).toHaveLength(4);
  });

  it('ignores a location naming itself, which reached nowhere new', () => {
    const out = migrated({
      worldOverview: {},
      locations: [{ id: 'green', name: 'Green', connections: ['Green'] }],
      entities: [],
    });
    expect(out.connections).toBeUndefined();
  });
});

describe('migrateWorld — Connection legs', () => {
  const locations = [{ id: 'quay', name: 'Quay' }, { id: 'tower', name: 'Tower' }];
  const connectionsOf = (connections: unknown[], version?: string) =>
    (migrateWorld({ worldOverview: {}, locations, entities: [], connections, version }) as unknown as {
      connections: Connection[];
    }).connections;

  it('puts a two-way hint on both legs, so the pair plays as before', () => {
    const [record] = connectionsOf([{ id: 'c1', from: 'quay', to: 'tower', twoWay: true, aiHint: 'up the steps' }]);
    expect(record).toEqual({
      id: 'c1', a: 'quay', b: 'tower', aToB: { hint: 'up the steps' }, bToA: { hint: 'up the steps' },
    });
    expect(navigableDestinationEntries(locations[1], locations, [record])[0].hint).toBe('up the steps');
  });

  it('gives a one-way record one leg, from its old start', () => {
    const [record] = connectionsOf([{ id: 'c1', from: 'tower', to: 'quay', twoWay: false, aiHint: 'down the chute' }]);
    expect(record).toEqual({ id: 'c1', a: 'tower', b: 'quay', aToB: { hint: 'down the chute' } });
  });

  it('stores a blank old hint as no hint', () => {
    const [record] = connectionsOf([{ id: 'c1', from: 'quay', to: 'tower', twoWay: true, aiHint: '  ' }]);
    expect(record).toEqual({ id: 'c1', a: 'quay', b: 'tower', aToB: {}, bToA: {} });
  });

  it('passes a new-shape record through unchanged', () => {
    const current: Connection = { id: 'c1', a: 'quay', b: 'tower', bToA: { hint: 'down' } };
    expect(connectionsOf([current])).toEqual([current]);
  });

  it('normalizes a new-shape record: a blank hint becomes no hint, a malformed leg or end is dropped', () => {
    expect(connectionsOf([
      { id: 'c1', a: 'quay', b: 'tower', aToB: { hint: '  ' }, bToA: 'yes' },
      { id: 'c2', a: 'quay', aToB: {} },
    ])).toEqual([{ id: 'c1', a: 'quay', b: 'tower', aToB: {} }]);
  });

  it('drops a record with no legs', () => {
    expect(connectionsOf([{ id: 'c1', a: 'quay', b: 'tower' }, { id: 'c2', a: 'tower', b: 'quay', aToB: {} }]))
      .toEqual([{ id: 'c2', a: 'tower', b: 'quay', aToB: {} }]);
  });

  it('runs on a world already stamped at APP_VERSION (shipped worlds carry the old shape)', () => {
    const [record] = connectionsOf([{ id: 'c1', from: 'quay', to: 'tower', twoWay: false }], APP_VERSION);
    expect(record).toEqual({ id: 'c1', a: 'quay', b: 'tower', aToB: {} });
  });

  it('migrating twice is identical to migrating once', () => {
    const raw = {
      worldOverview: {}, locations, entities: [],
      connections: [{ id: 'c1', from: 'quay', to: 'tower', twoWay: true, aiHint: 'up' }],
    };
    const once = migrateWorld(raw);
    expect(migrateWorld(structuredClone(once))).toEqual(once);
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

  describe('stat code lookups', () => {
    const stats = [
      { id: 's1', name: 'Health', code: "const self = stats.find(s => s.id === currentStatId);\nreturn stats.find(s => s.name === 'Power').value + self.value;" },
      { id: 's2', name: 'Power', code: 'const me = stats.find(s => s.id === currentStatId);\nreturn me.value;' },
      { id: 's3', name: 'Plain' },
    ];
    const codeOf = (world: unknown) => (world as { stats: { code?: string }[] }).stats.map((s) => s.code);

    it('rewrites every stat’s code in a world from an earlier version', () => {
      expect(codeOf(migrateWorld({ version: '2.14.0', worldOverview: { name: 'W' }, stats }))).toEqual([
        "return stats['Power'].value + self.value;",
        'const me = self;\nreturn me.value;',
        undefined,
      ]);
    });

    it('rewrites an unversioned world', () => {
      expect(codeOf(migrateWorld({ worldOverview: { name: 'W' }, stats }))[1]).toBe('const me = self;\nreturn me.value;');
    });

    // A world saved by v3.1.2 carries APP_VERSION 3.1.2 and may still hold the retired routes.
    it('rewrites a world already at APP_VERSION', () => {
      expect(codeOf(migrateWorld({ version: APP_VERSION, worldOverview: { name: 'W' }, stats }))).toEqual([
        "return stats['Power'].value + self.value;",
        'const me = self;\nreturn me.value;',
        undefined,
      ]);
    });

    it('is idempotent', () => {
      const once = migrateWorld({ version: '2.14.0', worldOverview: { name: 'W' }, stats });
      expect(migrateWorld({ ...once, version: '2.14.0' })).toEqual(once);
    });
  });

  describe('stat code routes', () => {
    const ph = (id: string, name: string, over: Partial<Placeholder> = {}) => ({ id, name, values: [], ...over });
    // The world holds Mood, and Hair › Shade; Molly owns Eyes; the Weather book owns Sky.
    const world = {
      version: APP_VERSION,
      worldOverview: { name: 'W' },
      placeholders: [
        ph('mood', 'Mood'),
        ph('hair', 'Hair', { values: [{ id: 'v1', text: '{{ph:shade:world:p-shade}}' }] }),
        ph('shade', 'Shade', { ownerId: 'hair' }),
      ],
      entities: [{ id: 'molly', name: 'Molly', placeholders: [ph('eyes', 'Eyes')] }],
      dictionaries: [{ id: 'weather', name: 'Weather', enabled: true, entries: [], placeholders: [ph('sky', 'Sky')] }],
      stats: [{
        id: 's1', name: 'Mood Meter',
        beforeCode: "placeholders.Molly.Eyes.pin('green'); placeholders.Shade.pin('ash');",
        code: 'return placeholders.Weather.Sky.text.length + deltaHours + startDay + (currentStatId ? 1 : 0)'
          + " + (placeholders.Eyes.value === 'green' ? 1 : 0);",
      }],
    };
    const boxesOf = (out: unknown) => (out as { stats: { beforeCode?: string; code?: string }[] }).stats[0];

    it('rewrites every retired route in both boxes', () => {
      expect(boxesOf(migrateWorld(world))).toMatchObject({
        beforeCode: "entities.Molly.placeholders.Eyes.pin('green'); placeholders.Hair.Shade.pin('ash');",
        code: 'return dictionaries.Weather.placeholders.Sky.text.length + clock.deltaHours + clock.previous.day'
          + " + (self.id ? 1 : 0) + (entities.Molly.placeholders.Eyes.value === 'green' ? 1 : 0);",
      });
    });

    it('is idempotent', () => {
      const once = migrateWorld(world);
      expect(migrateWorld(once)).toEqual(once);
    });

    it('keeps a stat whose code needs nothing as the same object', () => {
      const plain = { id: 's2', name: 'Plain', code: 'return clock.day;' };
      const out = migrateWorld({ ...world, stats: [plain] }) as unknown as { stats: unknown[] };
      expect(out.stats[0]).toBe(plain);
    });
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

describe('migrateWorld — pre-rebuild start flag', () => {
  type StartLoc = { id: string; isStarting?: boolean; isStartLocation?: unknown };
  const withLocations = (locations: unknown[], version?: string) =>
    migrateWorld({ ...(version ? { version } : {}), worldOverview: {}, locations }) as unknown as {
      locations: StartLoc[];
    };

  it('promotes every truthy legacy flag to a start candidate and drops the field', () => {
    const out = withLocations([
      { id: 'harbor', isStartLocation: true },
      { id: 'fen', isStartLocation: true },
      { id: 'ridge' },
    ]);
    expect(out.locations.map((l) => l.isStarting)).toEqual([true, true, undefined]);
    expect(out.locations.some((l) => 'isStartLocation' in l)).toBe(false);
  });

  it('drops a falsy legacy flag without making it a candidate', () => {
    const out = withLocations([{ id: 'harbor', isStartLocation: false }, { id: 'fen', isStartLocation: true }]);
    expect(out.locations.map((l) => l.isStarting)).toEqual([undefined, true]);
    expect(out.locations.some((l) => 'isStartLocation' in l)).toBe(false);
  });

  it('keeps the live flag authoritative: leftovers are deleted, not promoted', () => {
    const out = withLocations([
      { id: 'harbor', isStartLocation: true },
      { id: 'fen', isStarting: true },
    ]);
    expect(out.locations.map((l) => l.isStarting)).toEqual([undefined, true]);
    expect(out.locations.some((l) => 'isStartLocation' in l)).toBe(false);
  });

  it('is idempotent — a second run leaves the promoted flags as the first did', () => {
    const once = withLocations([{ id: 'harbor', isStartLocation: true }, { id: 'fen', isStartLocation: true }]);
    const twice = migrateWorld(once) as unknown as { locations: StartLoc[] };
    expect(twice.locations.map((l) => l.isStarting)).toEqual([true, true]);
  });

  it('runs on a world already stamped at APP_VERSION (nothing stripped the flag before now)', () => {
    const out = withLocations([{ id: 'harbor', isStartLocation: true }], APP_VERSION);
    expect(out.locations[0].isStarting).toBe(true);
    expect('isStartLocation' in out.locations[0]).toBe(false);
  });

  it('leaves a world that never carried the flag untouched', () => {
    const locations = [{ id: 'harbor', isStarting: true }, { id: 'fen' }];
    expect(withLocations(locations).locations).toStrictEqual(locations);
  });

  it('survives malformed locations', () => {
    const out = withLocations([null, { id: 'harbor', isStartLocation: true }]);
    expect(out.locations[0]).toBeNull();
    expect(out.locations[1].isStarting).toBe(true);
    expect(() => migrateWorld({ worldOverview: {}, locations: 'nope' })).not.toThrow();
  });
});

describe('migrateWorld — single opening cue to the openings list', () => {
  const CUE = 'I wake in the reed-beds with the tide already climbing.';
  const overviewOf = (worldOverview: Record<string, unknown>, version?: string) =>
    migrateWorld({ ...(version ? { version } : {}), worldOverview }).worldOverview as unknown as Record<string, unknown>;

  it('moves the cue into the list as one Opening Action and removes the old fields', () => {
    const ov = overviewOf({ openingCue: CUE, openingCueEnabled: true }, APP_VERSION);
    expect(ov.openings).toEqual([{ id: expect.any(String), text: CUE, kind: 'action' }]);
    expect(ov.openingsEnabled).toBeUndefined();
    expect('openingCue' in ov).toBe(false);
    expect('openingCueEnabled' in ov).toBe(false);
  });

  it('treats a cue with no switch as on', () => {
    const ov = overviewOf({ openingCue: CUE });
    expect(ov.openings).toHaveLength(1);
    expect(ov.openingsEnabled).toBeUndefined();
  });

  it('keeps a switched-off cue as a row and switches the list off', () => {
    const ov = overviewOf({ openingCue: CUE, openingCueEnabled: false });
    expect(ov.openings).toEqual([{ id: expect.any(String), text: CUE, kind: 'action' }]);
    expect(ov.openingsEnabled).toBe(false);
  });

  it('adds no row for a blank cue, which opened on the default before', () => {
    const ov = overviewOf({ openingCue: '  ', openingCueEnabled: true });
    expect(ov.openings).toBeUndefined();
    expect('openingCue' in ov).toBe(false);
  });

  it('carries a switched-off blank cue over as a switched-off empty list', () => {
    const ov = overviewOf({ openingCue: '', openingCueEnabled: false });
    expect(ov.openings).toBeUndefined();
    expect(ov.openingsEnabled).toBe(false);
  });

  it('is idempotent — a second run changes nothing', () => {
    const once = migrateWorld({ worldOverview: { openingCue: CUE, openingCueEnabled: false } });
    const twice = migrateWorld(structuredClone(once));
    expect(twice.worldOverview).toEqual(once.worldOverview);
  });

  it('leaves a world already on the list untouched', () => {
    const openings = [{ id: 'a', text: CUE, kind: 'action' }];
    const ov = overviewOf({ openings, openingWeights: { a: 2 } });
    expect(ov.openings).toStrictEqual(openings);
    expect(ov.openingWeights).toEqual({ a: 2 });
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

describe('migrateWorld — placeholder value records', () => {
  const withPlaceholders = (placeholders: unknown[], version?: string) =>
    migrateWorld({ ...(version ? { version } : {}), placeholders }) as unknown as { placeholders?: Placeholder[] };
  const first = (placeholders: unknown[], version?: string) => withPlaceholders(placeholders, version).placeholders![0];

  it('gives every legacy string value a record with a stable id', () => {
    const out = first([{ id: 'p1', name: 'Hair', values: ['Red', 'Blue'] }]);
    expect(out.values.map((v) => v.text)).toEqual(['Red', 'Blue']);
    expect(out.values.map((v) => v.id)).toEqual([expect.any(String), expect.any(String)]);
    expect(out.values[0].id).not.toBe(out.values[1].id);
  });

  it('rekeys the weight map from value text to the id that text was minted under', () => {
    const out = first([{ id: 'p1', name: 'Hair', values: ['Red', 'Blue'], weights: { Red: 3 } }]);
    expect(out.weights).toEqual({ [out.values[0].id]: 3 });
    expect(placeholderWeight(out, out.values[0])).toBe(3);
    expect(placeholderWeight(out, out.values[1])).toBe(1);
  });

  it('drops a weight naming no value — its key space is gone, so nothing could read it again', () => {
    const out = first([{ id: 'p1', name: 'Hair', values: ['Red'], weights: { Red: 2, grog: 5 } }]);
    expect(Object.keys(out.weights ?? {})).toEqual([out.values[0].id]);
  });

  it('removes an emptied weight map rather than storing one that weighs nothing', () => {
    const out = first([{ id: 'p1', name: 'Hair', values: ['Red'], weights: { grog: 5 } }]);
    expect('weights' in out).toBe(false);
  });

  it('leaves an already-converted map alone, dead keys included — that is the Bench’s finding to make', () => {
    // Stripping it here would quietly repair the exact condition `placeholder-weight-unknown-value` reports,
    // so the rule could never fire on a stored world and its Fix could never run.
    const values = [{ id: 'v-red', text: 'Red' }];
    const out = first([{ id: 'p1', name: 'Hair', values, weights: { 'v-red': 2, 'v-gone': 5 } }]);
    expect(out.weights).toEqual({ 'v-red': 2, 'v-gone': 5 });
  });

  it('is idempotent — a second run keeps every id and every weight', () => {
    const once = withPlaceholders([{ id: 'p1', name: 'Hair', values: ['Red', 'Blue'], weights: { Red: 3 } }]);
    const twice = migrateWorld(once) as unknown as { placeholders?: Placeholder[] };
    expect(twice.placeholders).toEqual(once.placeholders);
  });

  it('converts only the strings in a half-converted list, keeping the records already there', () => {
    // Hand-edited world JSON is the only way to reach this, and re-minting the record would orphan its
    // weight. Detected by element type, one value at a time.
    const kept = { id: 'v-kept', text: 'Red' };
    const out = first([{ id: 'p1', name: 'Hair', values: [kept, 'Blue'], weights: { 'v-kept': 3 } }]);
    expect(out.values[0]).toEqual(kept);
    expect(out.values[1].text).toBe('Blue');
    expect(out.weights).toEqual({ 'v-kept': 3 });
  });

  it('runs on a world already stamped at APP_VERSION (shipped 2.x worlds predate the records)', () => {
    expect(first([{ id: 'p1', name: 'Hair', values: ['Red'] }], APP_VERSION).values[0].text).toBe('Red');
  });

  it('leaves a world with no placeholders alone', () => {
    expect('placeholders' in migrateWorld({ version: APP_VERSION })).toBe(false);
  });
});

describe('migrateCarriedPlaceholders', () => {
  it('converts the defs an entity card or a dictionary file carries, which never see migrateWorld', () => {
    const [out] = migrateCarriedPlaceholders([{ id: 'p1', name: 'Hair', values: ['Red'], weights: { Red: 4 } }]);
    expect(out.values[0].text).toBe('Red');
    expect(out.weights).toEqual({ [out.values[0].id]: 4 });
  });

  it('reads anything that is not a list as no defs at all', () => {
    expect(migrateCarriedPlaceholders(undefined)).toEqual([]);
    expect(migrateCarriedPlaceholders('nonsense')).toEqual([]);
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

describe('migrateWorld — player setting to persona rules', () => {
  const playable = { id: 'w', name: 'Maren', persona: true };
  const overviewOf = (playerSetting: string, entities: unknown[] = []) =>
    migrateWorld({ version: APP_VERSION, worldOverview: { name: 'W', playerSetting }, entities }).worldOverview as unknown as Record<string, unknown>;

  it('drops Open, which is the absent value', () => {
    const ov = overviewOf('open');
    expect('playerSetting' in ov).toBe(false);
    expect(ov.allowedPersonas).toBeUndefined();
    expect(ov.startPersona).toBeUndefined();
  });

  it('turns Fixed into a start on None', () => {
    const ov = overviewOf('fixed', [playable]);
    expect('playerSetting' in ov).toBe(false);
    expect(ov.allowedPersonas).toBeUndefined();
    expect(ov.startPersona).toEqual({ source: 'none' });
  });

  it('turns Cast into World Only, starting on the first persona', () => {
    const ov = overviewOf('cast', [playable]);
    expect(ov.allowedPersonas).toBe('world');
    expect(ov.startPersona).toBeUndefined();
  });

  it('keeps a Cast world with no playable entity starting on None, as Cast did', () => {
    const ov = overviewOf('cast');
    expect(ov.allowedPersonas).toBe('world');
    expect(ov.startPersona).toEqual({ source: 'none' });
  });

  it('is idempotent', () => {
    const once = migrateWorld({ version: APP_VERSION, worldOverview: { playerSetting: 'cast' }, entities: [playable] });
    expect(migrateWorld(JSON.parse(JSON.stringify(once))).worldOverview).toEqual(once.worldOverview);
  });
});

describe('migrateWorld — exclusive groups to pick counts', () => {
  const raw = () => ({
    version: APP_VERSION,
    traitGroups: [
      { id: 'class', name: 'Class', parentId: null, exclusive: true },
      { id: 'perks', name: 'Perks', parentId: null, exclusive: false },
    ],
    entities: [{ id: 'e', name: 'Maren', traitGroups: [{ id: 'bond', name: 'Bond', parentId: null, exclusive: true }] }],
  });
  const groupsOf = (world: World) => world.traitGroups as unknown as Record<string, unknown>[];
  const ownedOf = (world: World) => world.entities[0].traitGroups as unknown as Record<string, unknown>[];

  it('turns an exclusive world group into a max of one', () => {
    const [cls, perks] = groupsOf(migrateWorld(raw()));
    expect(cls.maxPicks).toBe(1);
    expect('exclusive' in cls).toBe(false);
    expect(perks.maxPicks).toBeUndefined();
    expect('exclusive' in perks).toBe(false);
  });

  it('turns an exclusive entity-owned group into a max of one', () => {
    const [bond] = ownedOf(migrateWorld(raw()));
    expect(bond.maxPicks).toBe(1);
    expect('exclusive' in bond).toBe(false);
  });

  it('is idempotent', () => {
    const once = migrateWorld(raw());
    const twice = migrateWorld(JSON.parse(JSON.stringify(once)));
    expect(twice.traitGroups).toEqual(once.traitGroups);
    expect(twice.entities).toEqual(once.entities);
  });
});

describe('migrateWorld — links only into Blueprints', () => {
  const link = (id: string, originalId: string, kind: 'trait' | 'group' = 'trait') =>
    ({ id, originalId, kind, originalName: originalId, groupId: null, order: 0, overrides: { [originalId]: { isDefault: { value: true, blueprint: false } } } });
  // A 3.1.0 world: Classes (Paladin) in Blueprints, Brave and Faction (Guard) at the top level.
  const raw = () => ({
    version: APP_VERSION,
    traits: [
      { id: 'paladin', name: 'Paladin', statChanges: [], groupId: 'classes' },
      { id: 'brave', name: 'Brave', statChanges: [], groupId: null },
      { id: 'guard', name: 'Guard', statChanges: [], groupId: 'faction' },
    ],
    traitGroups: [
      { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' },
      { id: 'classes', name: 'Classes', parentId: 'bp' },
      { id: 'faction', name: 'Faction', parentId: null },
    ],
    entities: [
      { id: 'albus', name: 'Albus', traitLinks: [link('l1', 'paladin'), link('l2', 'brave'), link('l3', 'classes', 'group')] },
      { id: 'mira', name: 'Mira', customPersona: true, traitLinks: [link('l4', 'faction', 'group'), link('l5', 'guard')] },
      { id: 'tomas', name: 'Tomas', traitLinks: [link('l6', 'bp', 'group')] },
      { id: 'vex', name: 'Vex' },
    ],
  });
  const linkIds = (world: World) => world.entities.map((e) => e.traitLinks?.map((l) => l.id));

  it('drops each link whose original sits outside Blueprints, overrides and all, and keeps the rest', () => {
    const world = migrateWorld(raw());
    expect(linkIds(world)).toEqual([['l1', 'l3'], undefined, undefined, undefined]);
    expect(world.entities[0].traitLinks?.[0]).toEqual(raw().entities[0].traitLinks![0]);
  });

  it('removes the list outright when no link is left, so the entity stores none', () => {
    const [, mira, tomas, vex] = migrateWorld(raw()).entities;
    expect(mira).not.toHaveProperty('traitLinks');
    expect(tomas).not.toHaveProperty('traitLinks');
    expect(vex).toEqual(raw().entities[3]);
  });

  it('drops every link in a world with no Blueprints group', () => {
    const bare = { ...raw(), traitGroups: raw().traitGroups.filter((g) => g.id !== 'bp') };
    expect(linkIds(migrateWorld(bare))).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('is idempotent', () => {
    const once = migrateWorld(raw());
    expect(migrateWorld(JSON.parse(JSON.stringify(once))).entities).toEqual(once.entities);
  });
});
