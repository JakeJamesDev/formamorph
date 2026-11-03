/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runStatCodeTurn, type OwnerCodeTurn } from './statCodeTurn';
import type { StatCodeOwners } from './statCodeTraits';
import { inPlayOwners } from './ownedTraitsInPlay';
import { runRowKeys } from './worldScripts';
import type { Entity, PersonaRef, PlayerStat, Script, StatGroup, TraitGroup } from '@/types';
import { statCodeTurnOf } from '@/test/statCodeTurnFixture';

const NO_PERSONA: PersonaRef = { source: 'none' };

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

const script = (id: string, code: string, order?: number): Script => ({ id, timing: 'after', code, ...(order === undefined ? {} : { order }) });

const blueprints = { id: 'sbp', name: 'Blueprints', parentId: null, system: 'blueprints' } as StatGroup;

/** Two world entities that each link the Hub Blueprint, and a library entity. Each writes Gold from its own script. */
function cast(orders: { world?: number; grit?: number; edge?: number; hub?: number; lib?: number } = {}) {
  const gold = stat({ id: 'gold', name: 'Gold', value: 5 });
  const hub = stat({ id: 'hub', name: 'Hub', groupId: 'sbp', scripts: [script('hub-s', 'stats.Gold.value = owner.stats.Tag.value;', orders.hub)] });
  const grit = stat({ id: 'grit', name: 'Grit', scripts: [script('grit-s', 'stats.Gold.value = 4;', orders.grit)] });
  const edge = stat({ id: 'edge', name: 'Edge', scripts: [script('edge-s', 'stats.Gold.value = 2;', orders.edge)] });
  const lib = stat({ id: 'lib', name: 'Lib', scripts: [script('lib-s', 'stats.Gold.value = 99;', orders.lib)] });
  const tag = (value: number) => stat({ id: 'tag', name: 'Tag', value });
  const link = (id: string) => ({ id, originalId: 'hub', kind: 'stat' as const, originalName: 'Hub', groupId: null });
  const bram: Entity = { id: 'bram', name: 'Bram', stats: [tag(11), grit], statLinks: [link('bram-hub')] };
  // Odette's Hub sits ahead of her own Edge, so owner order alone would run Edge last.
  const odette: Entity = { id: 'odette', name: 'Odette', stats: [tag(12), edge], statLinks: [link('odette-hub')] };
  const lyra: Entity = { id: 'lyra', name: 'Lyra', stats: [tag(77), lib], statLinks: [link('lyra-hub')] };
  const worldScripts = [script('world-s', 'stats.Gold.value = 1;', orders.world)];
  const entities = [bram, odette];
  const owners: OwnerCodeTurn[] = [
    { id: 'bram', stats: [tag(11), grit, hub], enabled: {}, previous: [], regenApplied: {} },
    { id: 'odette', stats: [tag(12), hub, edge], enabled: {}, previous: [], regenApplied: {} },
    { id: 'lyra', stats: [tag(77), lib, hub], enabled: {}, previous: [], regenApplied: {} },
  ].map((owner) => ({ ...owner, previous: owner.stats }));
  const ownerTraits: StatCodeOwners = {
    acquired: [], disabledTraitIds: [], appliedValues: {}, ownedTraits: {}, entities, library: [lyra],
    world: {
      traits: [], groups: [], entities, persona: NO_PERSONA,
      ...inPlayOwners({ traits: [], traitGroups: [], entities }, NO_PERSONA, [lyra]),
    },
  };
  const tab = {
    scripts: worldScripts, stats: [gold, hub], statGroups: [blueprints], traits: [], traitGroups: [], entities, placeholders: [],
  };
  return { gold, worldScripts, owners, ownerTraits, tab };
}

type Cast = ReturnType<typeof cast>;

/** The Gold the last script to write it left; `rowOrder` is the Scripts tab's, as the game passes it. */
async function goldAfter({ gold, worldScripts, owners, ownerTraits, tab }: Cast, { rows = true, library = true } = {}) {
  const out = await runStatCodeTurn(statCodeTurnOf({
    stats: [gold], enabled: {}, previous: [gold], asks: [], regenApplied: {}, clock: {}, ownerTraits,
    owners: library ? owners : owners.filter((owner) => owner.id !== 'lyra'),
    worldScripts, ...(rows ? { rowOrder: runRowKeys(tab, 'after') } : {}),
    statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
  }));
  return out.stats.find((s) => s.id === 'gold')?.value;
}

describe('runStatCodeTurn run order', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('runs one Blueprint script for all its owners back to back after the entities’ own rows, as the tab lists it', async () => {
    const world = cast();
    expect(runRowKeys(world.tab, 'after')).toEqual([
      'world|world-s', 'entity/bram/grit|grit-s', 'entity/odette/edge|edge-s', 'stat/hub|hub-s',
    ]);
    // Hub writes each owner's Tag, so Odette's 12 lands last. Owner order alone would leave Odette's Edge, 2, last.
    expect(await goldAfter(world, { library: false })).toBe(12);
    expect(await goldAfter(world, { rows: false, library: false })).toBe(2);
  });

  it('keeps the row together when it carries an order, the tied row ahead of it running first', async () => {
    // Edge and Hub tie on 2; the tab lists Edge's row first, so Hub's owners run last.
    const world = cast({ world: 0, grit: 1, edge: 2, hub: 2 });
    expect(await goldAfter(world, { library: false })).toBe(12);
    expect(await goldAfter(world, { rows: false, library: false })).toBe(2);
  });

  it('places a dragged Blueprint row ahead of the rows it was dragged above', async () => {
    const world = cast({ hub: 0, world: 1 });
    // Hub (0) runs first, then World (1); Grit and Edge have no order, so they follow, Edge last.
    expect(await goldAfter(world, { library: false })).toBe(2);
  });

  it('runs a library entity’s scripts after every row, its Blueprint link included, and ignores its stored order', async () => {
    const world = cast({ lib: 0 });
    // The Hub row runs for Bram and Odette only. Lyra's own script (99) then her Hub (77) run after every row.
    // Were her Hub in the row, Lyra's script (99) would run after it and win.
    expect(await goldAfter(world)).toBe(77);
  });

  it('keeps the old sort when no row order is given: ordered scripts first, then owner order', async () => {
    const world = cast({ edge: 0 });
    // Edge (order 0) runs first; owner order then ends on Odette's Hub, 12.
    expect(await goldAfter(world, { rows: false, library: false })).toBe(12);
  });
});

/** Bram, then Mira, the played world persona authored last. Each writes Gold from every script they hold. */
function castWithPersona({ miraStats = false }: { miraStats?: boolean } = {}) {
  const gold = stat({ id: 'gold', name: 'Gold', value: 5 });
  const write = script;
  const hub = {
    id: 'hub', name: 'Hub', statChanges: [], groupId: 'tbp', scripts: [write('hub-s', 'stats.Gold.value = owner.name === "Bram" ? 21 : 12;')],
  };
  const link = (id: string) => ({ id, originalId: 'hub', kind: 'trait' as const, originalName: 'Hub', groupId: null });
  const ownTrait = (id: string, name: string, code: string) => ({ id, name, statChanges: [], scripts: [write(`${id}-s`, code)] });
  const brave = ownTrait('brave', 'Brave', 'stats.Gold.value = 21;');
  const wise = ownTrait('wise', 'Wise', 'stats.Gold.value = 12;');
  const grit = stat({ id: 'grit', name: 'Grit', scripts: [write('grit-s', 'stats.Gold.value = 21;')] });
  const poise = stat({ id: 'poise', name: 'Poise', scripts: [write('poise-s', 'stats.Gold.value = 12;')] });
  const bram: Entity = { id: 'bram', name: 'Bram', traits: [brave], traitLinks: [link('bram-hub')], stats: [grit] };
  const mira: Entity = {
    id: 'mira', name: 'Mira', persona: true, traits: [wise], traitLinks: [link('mira-hub')], ...(miraStats ? { stats: [poise] } : {}),
  };
  const entities = [bram, mira];
  const persona: PersonaRef = { source: 'world', entityId: 'mira' };
  const traitGroups = [{ id: 'tbp', name: 'Blueprints', parentId: null, system: 'blueprints' } as TraitGroup];
  const ownerTraits: StatCodeOwners = {
    acquired: [], disabledTraitIds: [], appliedValues: {},
    ownedTraits: { bram: { chosen: ['hub', 'brave'] }, mira: { chosen: ['hub', 'wise'] } }, entities, library: [],
    world: { traits: [hub], groups: traitGroups, entities, persona, ...inPlayOwners({ traits: [hub], traitGroups, entities }, persona, []) },
  };
  const turnOf = (id: string, stats: PlayerStat[]): OwnerCodeTurn => ({ id, stats, enabled: {}, previous: stats, regenApplied: {} });
  const owners = [turnOf('bram', [grit]), ...(miraStats ? [turnOf('mira', [poise])] : [])];
  const tab = { scripts: [], stats: [gold], statGroups: [], traits: [hub], traitGroups, entities, placeholders: [] };
  return { gold, owners, ownerTraits, tab };
}

describe('runStatCodeTurn run order, a played persona authored last', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const goldOf = async ({ gold, owners, ownerTraits, tab }: ReturnType<typeof castWithPersona>, rows: boolean) => {
    const out = await runStatCodeTurn(statCodeTurnOf({
      stats: [gold], enabled: {}, previous: [gold], asks: [], regenApplied: {}, clock: {}, ownerTraits, owners,
      ...(rows ? { rowOrder: runRowKeys(tab, 'after') } : {}), statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
    }));
    return out.stats.find((s) => s.id === 'gold')?.value;
  };

  it('runs a Blueprint trait row in authored owner order, the persona with no stats last', async () => {
    const world = castWithPersona();
    expect(await goldOf(world, true)).toBe(12);
  });

  it.each([true, false])('runs its own trait rows in authored owner order (rows: %s)', async (rows) => {
    const world = castWithPersona();
    world.ownerTraits.world.traits = [];
    world.ownerTraits.ownedTraits = { bram: { chosen: ['brave'] }, mira: { chosen: ['wise'] } };
    expect(await goldOf(world, rows)).toBe(12);
  });

  it.each([true, false])('runs its stat rows in authored owner order (rows: %s)', async (rows) => {
    const world = castWithPersona({ miraStats: true });
    world.ownerTraits.world.traits = [];
    world.ownerTraits.ownedTraits = {};
    expect(await goldOf(world, rows)).toBe(12);
  });
});
