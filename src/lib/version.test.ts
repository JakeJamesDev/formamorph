import { describe, it, expect } from 'vitest';
import { APP_VERSION, migrateWorld, isSaveEnvelope } from './version';

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

  it("renames a trait's legacy description to playerDescription", () => {
    const out = migrateWorld({
      worldOverview: { name: 'W' },
      traits: [{ id: 't', name: 'Brave', description: 'Fearless.', statChanges: [] }],
    }) as unknown as { traits?: { playerDescription?: string; description?: string }[] };
    expect(out.traits?.[0]).toMatchObject({ playerDescription: 'Fearless.' });
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
