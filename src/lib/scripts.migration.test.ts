/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entity, PersonaRef, PlayerStat, SaveObject, Script, Stat, World } from '@/types';
import { migrateSave, migrateWorld } from './version';
import { runStatCodeTurn, type OwnerCodeTurn } from './statCodeTurn';
import type { StatCodeOwners } from './statCodeTraits';
import { inPlayOwners } from './ownedTraitsInPlay';
import { executeStatCode, type SandboxEntity } from './statCodeExecutor';
import { globalStatsOf, resolvedEntityStats, statLinkState } from './statLinks';
import { bindOwnedStats } from './portableStats';
import { codeAt } from '@/test/scriptFixtures';
import { PRE_REFRESH_SHA, worldAt } from '@/test/bundledRevisions';
import { DEFAULT_WORLDS } from './defaultWorlds';
import { statCodeNamed } from './statCodeNames';
import { parseEntityCardData } from './entityFile';
import { clamp } from './utils';
import { newScript } from './scriptRows';
import { editScripts, orderEdits, reorderWrites, scriptsByTiming, worldScriptEntries } from './worldScripts';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const NO_PERSONA: PersonaRef = { source: 'none' };

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [], ...over,
});

/** One turn of `world` at `timing`, every entity with stats running beside the global stats, as play runs it.
 *  The lists `loadWorldData` defaults after the migration default here too. */
function playTurn(migrated: World, timing: 'before' | 'after' | 'start') {
  const world = { ...migrated, entities: migrated.entities ?? [], traits: migrated.traits ?? [] };
  const atStart = (stats: readonly Stat[]): PlayerStat[] => stats.map((s) => ({ ...s, value: s.starting ?? s.value ?? s.min }));
  const ownerTraits: StatCodeOwners = {
    acquired: [], disabledTraitIds: [], appliedValues: {}, ownedTraits: {}, entities: world.entities, library: [],
    world: {
      traits: world.traits, groups: world.traitGroups ?? [], entities: world.entities, persona: NO_PERSONA,
      ...inPlayOwners({ traits: world.traits, traitGroups: world.traitGroups ?? [], entities: world.entities }, NO_PERSONA, []),
    },
  };
  const statWorld = { stats: world.stats, statGroups: world.statGroups ?? [] };
  const owners: OwnerCodeTurn[] = world.entities.flatMap((entity) => {
    const stats = atStart(resolvedEntityStats(statWorld, entity));
    return stats.length ? [{ id: entity.id, stats, enabled: {}, previous: stats, regenApplied: {} }] : [];
  });
  const stats = atStart(globalStatsOf(world.stats, world.statGroups ?? []));
  return runStatCodeTurn(statCodeTurnOf({
    timing, stats, enabled: {}, previous: stats, asks: [], regenApplied: {}, clock: {}, ownerTraits, owners,
    worldScripts: world.scripts,
    statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
  } satisfies FlatStatCodeTurn));
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('a world saved with the two code boxes', () => {
  const legacy = {
    worldOverview: { name: 'Boxes' },
    stats: [{ ...stat({ id: 'hp', name: 'Health' }), beforeCode: 'return 11;', code: 'return 22;' }, stat({ id: 'mp', name: 'Mana' })],
  };

  it('loads each box as a script with its timing, and keeps no box field', () => {
    const world = migrateWorld(legacy);
    expect(world.stats[0].scripts).toEqual([
      { id: 'hp:before', timing: 'before', code: 'return 11;' },
      { id: 'hp:after', timing: 'after', code: 'return 22;' },
    ]);
    for (const s of world.stats) {
      expect(s).not.toHaveProperty('beforeCode');
      expect(s).not.toHaveProperty('code');
    }
  });

  it('runs the before box before the AI and the after box after it, as the boxes ran', async () => {
    const world = migrateWorld(legacy);
    expect((await playTurn(world, 'before')).stats.find((s) => s.id === 'hp')?.value).toBe(11);
    expect((await playTurn(world, 'after')).stats.find((s) => s.id === 'hp')?.value).toBe(22);
  });

  it('folds an entity link’s box override into one scripts override against the world’s Blueprint', () => {
    const world = migrateWorld({
      ...legacy,
      statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
      stats: [{ ...stat({ id: 'howl', name: 'Howl', groupId: 'bp' }), beforeCode: 'return 1;', code: 'return 2;' }],
      entities: [{
        id: 'bram', name: 'Bram',
        statLinks: [{
          id: 'l', originalId: 'howl', kind: 'stat', originalName: 'Howl', groupId: null,
          overrides: { howl: { code: { value: 'return 9;', blueprint: 'return 2;' } } },
        }],
      }],
    });
    const howl = world.stats[0].scripts;
    expect(world.entities[0].statLinks?.[0].overrides?.howl).toEqual({
      scripts: { value: [howl?.[0], { id: 'howl:after', timing: 'after', code: 'return 9;' }], blueprint: howl },
    });
  });
});

describe('a link’s box override', () => {
  const blueprintWorld = (before: string) => migrateWorld({
    worldOverview: { name: 'Links' },
    statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
    stats: [{ ...stat({ id: 'howl', name: 'Howl', groupId: 'bp' }), beforeCode: before, code: 'return 22;' }],
  });
  const codeOnlyLink = {
    id: 'l', originalId: 'howl', kind: 'stat', originalName: 'Howl', groupId: null,
    overrides: { howl: { code: { value: 'return 33;', blueprint: 'return 22;' } } },
  };

  it('on a card, folds when a world binds it and runs both scripts, the override on the after side only (Q36)', async () => {
    const world = blueprintWorld('return 11;');
    const card = parseEntityCardData({ formamorphKind: 'entity', name: 'Bram', statLinks: [codeOnlyLink] });
    const bram = bindOwnedStats(card, world);
    const link = bram.statLinks![0];
    expect(statLinkState(world.stats[0], link).stale).toEqual([]);
    const inWorld = { ...world, entities: [bram] };
    const howlOf = async (timing: 'before' | 'after') => (await playTurn(inWorld, timing)).owners?.[bram.id]?.stats[0].value;
    expect(await howlOf('before')).toBe(11);
    expect(await howlOf('after')).toBe(33);
  });

  it('in a world file, folds the live side after its retired routes are rewritten, so it reads current', () => {
    const world = migrateWorld({
      ...blueprintWorld('const me = stats.find(s => s.id === currentStatId);\nreturn me.value;'),
      stats: [{ ...stat({ id: 'howl', name: 'Howl', groupId: 'bp' }), beforeCode: 'const me = stats.find(s => s.id === currentStatId);\nreturn me.value;', code: 'return 22;' }],
      entities: [{ id: 'bram', name: 'Bram', statLinks: [codeOnlyLink] }],
    });
    const original = world.stats[0];
    const link = world.entities[0].statLinks![0];
    expect(codeAt(original, 'before')).toBe('const me = self;\nreturn me.value;');
    expect(link.overrides?.howl?.scripts?.value[0]).toEqual(original.scripts?.[0]);
    expect(statLinkState(original, link).stale).toEqual([]);
  });
});

describe('the other boundaries that read a stat', () => {
  it('migrates an entity card’s own stats', () => {
    const entity = parseEntityCardData({
      formamorphKind: 'entity', name: 'Mara', stats: [{ ...stat({ id: 's', name: 'Grit' }), code: 'return 3;' }],
    });
    expect(entity.stats?.[0].scripts).toEqual([{ id: 's:after', timing: 'after', code: 'return 3;' }]);
    expect(entity.stats?.[0]).not.toHaveProperty('code');
  });

  it('migrates every saved stat in a save, the global stats’ and each entity’s', () => {
    const boxed = { ...stat({ id: 's' }), beforeCode: 'return 1;' } as PlayerStat;
    const snapshot = { globalStats: [boxed], entityStats: { e: [boxed] } };
    const save = migrateSave({ version: '3.3.0', currentState: snapshot, stateHistory: [snapshot] } as unknown as SaveObject);
    const want: Script[] = [{ id: 's:before', timing: 'before', code: 'return 1;' }];
    for (const state of [save.currentState, ...save.stateHistory]) {
      expect(state.globalStats[0].scripts).toEqual(want);
      expect(state.entityStats?.e[0].scripts).toEqual(want);
      expect(state.globalStats[0]).not.toHaveProperty('beforeCode');
    }
  });
});

// The released bundled worlds store box code, and the pre-refresh revision holds them.
describe('the shipped bundled worlds', () => {
  type RawStat = Stat & { beforeCode?: string; code?: string };
  type RawWorld = { stats: RawStat[]; statGroups?: World['statGroups']; entities: (Entity & { stats?: RawStat[] })[]; placeholders?: World['placeholders'] };
  // Parsed JSON: the box-code fields the World type no longer carries are read as RawWorld.
  const raws = DEFAULT_WORLDS.map(({ id }) => [`${id}.json`, worldAt(PRE_REFRESH_SHA, id) as unknown as RawWorld] as const);
  const boxed = raws.filter(([, raw]) =>
    [...raw.stats, ...raw.entities.flatMap((e) => e.stats ?? [])].some((s) => s.code?.trim() || s.beforeCode?.trim()));

  it('include worlds that ship box code, so the guard below is not vacuous', () => {
    expect(boxed.length).toBeGreaterThan(0);
  });

  /** Each stat's value when its shipped box text runs straight through the executor, the way the box ran. */
  async function asShipped(raw: RawWorld, world: World, timing: 'before' | 'after') {
    const field = timing === 'before' ? 'beforeCode' : 'code';
    const rawById = new Map([...raw.stats, ...raw.entities.flatMap((e) => e.stats ?? [])].map((s) => [s.id, s]));
    const statWorld = { stats: world.stats, statGroups: world.statGroups ?? [] };
    const named = (stats: readonly Stat[]) => statCodeNamed(stats.map((s) => ({ ...s, value: s.starting ?? s.value ?? s.min })), world.placeholders ?? []);
    const globals = named(globalStatsOf(world.stats, world.statGroups ?? []));
    const held = world.entities.map((e) => ({ entity: e, stats: named(resolvedEntityStats(statWorld, e)) })).filter((o) => o.stats.length);
    const entities: SandboxEntity[] = held.map(({ entity, stats }) => ({ id: entity.id, name: entity.name, traits: [], stats: { stats } }));
    const values = new Map<string, number>();
    for (const { owner, stats } of [{ owner: null, stats: globals }, ...held.map((o) => ({ owner: o.entity.id, stats: o.stats }))]) {
      for (const s of stats) {
        // A linked stat runs its original's box.
        const code = rawById.get(s.id)?.[field] ?? '';
        const res = code.trim()
          ? await executeStatCode(code, globals, s, { entities, owner: entities.find((e) => e.id === owner) })
          : null;
        values.set(`${owner}:${s.id}`, res?.value == null ? s.value ?? 0 : clamp(res.value, s.min, s.max));
      }
    }
    return values;
  }

  it.each(boxed.flatMap(([path, raw]) => (['before', 'after'] as const).map((timing) => [path, timing, raw] as const)))(
    '%s runs every stat to the same value through its scripts at %s',
    async (_path, timing, raw) => {
      const world = migrateWorld(structuredClone(raw));
      const expected = await asShipped(raw, world, timing);
      const out = await playTurn(world, timing);
      const got = new Map([
        ...out.stats.map((s): [string, number] => [`null:${s.id}`, s.value]),
        ...Object.entries(out.owners ?? {}).flatMap(([id, o]) => o.stats.map((s): [string, number] => [`${id}:${s.id}`, s.value])),
      ]);
      expect(Object.fromEntries(got)).toEqual(Object.fromEntries(expected));
    },
  );
});

describe('run order within a timing', () => {
  // The world script and Mana's script both write Health; the later one in run order wins (Q30).
  const world = (worldOrder?: number, statOrder?: number): World => migrateWorld({
    worldOverview: { name: 'Order' },
    stats: [
      stat({ id: 'hp', name: 'Health', value: 50 }),
      stat({
        id: 'mp', name: 'Mana',
        scripts: [{ id: 'mp-s', timing: 'after', code: 'stats.Health.value = 1;', ...(statOrder === undefined ? {} : { order: statOrder }) }],
      }),
    ],
    scripts: [{ id: 'w-s', timing: 'after', code: 'stats.Health.value = 2;', ...(worldOrder === undefined ? {} : { order: worldOrder }) }],
  });
  const health = async (w: World) => (await playTurn(w, 'after')).stats.find((s) => s.id === 'hp')?.value;

  it('lets a world script ordered after a stat script win a shared write, and lose with the orders flipped', async () => {
    expect(await health(world(1, 0))).toBe(2);
    expect(await health(world(0, 1))).toBe(1);
  });

  it('runs scripts with an order before scripts without one', async () => {
    expect(await health(world(undefined, 0))).toBe(2);
    expect(await health(world(0, undefined))).toBe(1);
  });

  it('runs the world’s unordered scripts before its stats’ unordered scripts', async () => {
    expect(await health(world())).toBe(1);
  });

  it('follows a Scripts tab drag: the script dragged last wins the shared write', async () => {
    const w = world();
    const rows = scriptsByTiming(worldScriptEntries({ ...w, statGroups: [], traits: [], traitGroups: [], entities: [], placeholders: [] })).after;
    expect(rows.map((row) => row.script.id)).toEqual(['w-s', 'mp-s']);
    const dragged = editScripts({ ...w, traits: [], entities: [] }, orderEdits(reorderWrites(rows, rows[0].key, rows[1].key)!));
    expect(await health({ ...w, ...dragged })).toBe(2);
  });

  it('runs a world script with an empty self, ignoring a self write and a return value', async () => {
    const w = migrateWorld({
      worldOverview: { name: 'No Self' },
      stats: [stat({ id: 'hp', name: 'Health', value: 50 })],
      scripts: [{
        id: 'w', timing: 'after',
        code: 'stats.Health.value = Object.keys(self).length ? 8 : 7; self.value = 99; self.max = 1; return "ignored";',
      }],
    });
    const out = await playTurn(w, 'after');
    expect(out.stats.find((s) => s.id === 'hp')).toMatchObject({ value: 7, max: 100 });
  });

  it('runs a world script the Scripts tab adds in its picked timing, with self and owner empty', async () => {
    const added = { ...newScript('start'), code: [
        // The empty owner is a blank entry, as a global stat's is: no name, no stats, no traits.
        'const empty = !Object.keys(self).length && owner.name === "" && !Object.keys(owner.stats).length && !Object.keys(owner.traits).length;',
        'stats.Health.value = empty ? 7 : 8;',
      ].join('\n') };
    const w = migrateWorld({ worldOverview: { name: 'Added' }, stats: [stat({ id: 'hp', name: 'Health', value: 50 })], scripts: [added] });
    expect((await playTurn(w, 'start')).stats.find((s) => s.id === 'hp')?.value).toBe(7);
    expect(await health(w)).toBe(50);
  });

  it('runs a world script only in its own timing', async () => {
    const w = migrateWorld({
      worldOverview: { name: 'Timed' },
      stats: [stat({ id: 'hp', name: 'Health', value: 50 })],
      scripts: [{ id: 'w', timing: 'before', code: 'stats.Health.value = 3;' }],
    });
    expect(await health(w)).toBe(50);
    expect((await playTurn(w, 'before')).stats.find((s) => s.id === 'hp')?.value).toBe(3);
  });
});
