/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeStatCode, type SandboxEntity } from './statCodeExecutor';
import type { Stat } from '@/types';

const makeStat = (over: Partial<Stat>): Stat => ({
  id: '1', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...over,
});

const gold = makeStat({ id: 'g', name: 'Gold', value: 5 });
const rage = makeStat({ id: 'r', name: 'Rage', value: 10 });
const stock = makeStat({ id: 'k', name: 'Stock', value: 12 });
const brave = { name: 'Brave', enabled: false, acquired: false, id: 'brave' };
const bram: SandboxEntity = {
  id: 'bram', name: 'Bram', traits: [brave],
  stats: { stats: [rage, stock], enabled: { k: false } },
};

/** Runs `code` as Bram's Rage, the world holding Gold. */
const asRage = (code: string, entities: SandboxEntity[] = [bram], owner: SandboxEntity = bram) =>
  executeStatCode(code, [gold], rage, { entities, owner });

describe('executeStatCode owner', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('reads the world stats as `stats` and the owner’s as `owner.stats`', async () => {
    const out = await asRage('return stats.Gold.value * 100 + owner.stats.Stock.value + (stats.Rage.name === "" ? 1 : 0);');
    expect(out.value).toBe(513);
  });

  it('makes `self` and `owner.stats.<own name>` one entry, so their writes are one write', async () => {
    const out = await asRage('self.value = 30; owner.stats.Rage.value += 5; owner.stats.Rage.max = 40; return self.max === 40 ? undefined : -1;');
    expect(out).toEqual({ value: 35, error: null, bounds: { max: 40 } });
  });

  it('returns a write to another of the owner’s stats keyed by the owner’s id', async () => {
    const live = { ...bram, stats: { stats: [rage, stock] } };
    const out = await asRage('owner.stats.Stock.max = 30; owner.stats.Stock.value = 20;', [live], live);
    expect(out.ownerStatWrites).toEqual([{ ownerId: 'bram', writes: [{ id: 'k', name: 'Stock', max: 30, value: 20 }] }]);
    expect(out.statWrites).toBeUndefined();
  });

  it('drops a write to a switched-off or unknown owner stat and reports its path', async () => {
    const out = await asRage('owner.stats.Stock.value = 1; owner.stats.Nope.regen = 2;');
    expect(out.ownerStatWrites).toBeUndefined();
    expect(out.disabledStatWrites).toEqual(['owner.stats.Stock.value']);
    expect(out.unknownStatWrites).toEqual(['owner.stats.Nope.regen']);
  });

  it('returns a world-stat write from an entity stat’s code as a world write', async () => {
    const out = await asRage('stats.Gold.value = 9; stats.Gold.max = 50;');
    expect(out).toEqual({ value: null, error: null, statWrites: [{ id: 'g', name: 'Gold', value: 9, max: 50 }] });
  });

  it('keys a write to another entity’s stats by that entity’s id, beside the owner’s own', async () => {
    const odette: SandboxEntity = { id: 'odette', name: 'Odette', traits: [], stats: { stats: [makeStat({ id: 'o', name: 'Calm', value: 3 })] } };
    const live = { ...bram, stats: { stats: [rage, stock] } };
    const out = await asRage('entities.Odette.stats.Calm.regen = 2; owner.stats.Stock.value = 1;', [live, odette], live);
    expect(out.ownerStatWrites).toEqual([
      { ownerId: 'bram', writes: [{ id: 'k', name: 'Stock', value: 1 }] },
      { ownerId: 'odette', writes: [{ id: 'o', name: 'Calm', regen: 2 }] },
    ]);
  });

  it.each(['id', 'name', 'type', 'description', 'previous', 'delta'])('keeps %s read only on every route', async (field) => {
    const odette: SandboxEntity = { id: 'odette', name: 'Odette', traits: [], stats: { stats: [makeStat({ id: 'o', name: 'Calm' })] } };
    const mira: SandboxEntity = { id: 'mira', name: '', traits: [], stats: { stats: [makeStat({ id: 'm', name: 'Grit' })] } };
    const out = await executeStatCode(
      `stats.Gold.${field} = 1; owner.stats.Stock.${field} = 1; entities.Odette.stats.Calm.${field} = 1; persona.stats.Grit.${field} = 1;`,
      [gold], rage, { entities: [bram, odette], persona: mira, owner: bram },
    );
    expect(out).toEqual({
      value: null, error: null,
      readOnlyWrites: [`stats.Gold.${field}`, `owner.stats.Stock.${field}`, `entities.Odette.stats.Calm.${field}`, `persona.stats.Grit.${field}`],
    });
  });

  it('reports a read-only field on the owner’s stats by its `owner` path on either route', async () => {
    const out = await asRage('owner.stats.Stock.name = "x"; entities.Bram.stats.Rage.previous.value = 1;');
    // In map order.
    expect(out.readOnlyWrites).toEqual(['owner.stats.Rage.previous.value', 'owner.stats.Stock.name']);
  });

  it('keeps a whole owner stat map, a whole owner stat and the owner’s own fields read only', async () => {
    const out = await asRage('owner.stats.Stock = 3; owner.stats = {}; owner.name = "x";');
    expect(out).toEqual({ value: null, error: null, readOnlyWrites: ['owner.stats.Stock', 'entities.Bram.stats', 'entities.Bram.name'] });
  });

  it('is the owner’s `entities` entry while that entry holds the owner', async () => {
    const out = await asRage('return owner === entities.Bram ? 1 : 0;');
    expect(out.value).toBe(1);
  });

  it('stays the owner when a later entity of the same name hides it in `entities`', async () => {
    const later: SandboxEntity = { id: 'bram-2', name: 'Bram', traits: [{ ...brave, id: 'brave-2' }], stats: { stats: [makeStat({ id: 'k2', name: 'Stock', value: 99 })] } };
    const out = await asRage(
      'owner.traits.Brave.enabled = true; owner.name = "x"; return (owner === entities.Bram ? 1000 : 0) + owner.stats.Stock.value + entities.Bram.stats.Stock.value;',
      [bram, later],
    );
    expect(out.value).toBe(12 + 99);
    expect(out.entities).toEqual([{ entity: '', owner: true, traits: [{ name: 'Brave', enabled: true }] }]);
    expect(out.readOnlyWrites).toEqual(['owner.name']);
  });

  it('switches the owner’s trait through `owner.traits`', async () => {
    const out = await asRage('owner.traits.Brave.enabled = true;');
    expect(out.entities).toEqual([{ entity: 'Bram', traits: [{ name: 'Brave', enabled: true }] }]);
  });

  describe('in world-stat code', () => {
    const world = (code: string, persona?: SandboxEntity) =>
      executeStatCode(code, [gold], gold, { entities: [bram], ...(persona && { persona }) });

    it('reads every field of the empty `owner` blank', async () => {
      const out = await world('return owner.stats.Rage.value + (owner.name === "" && owner.id === "" && !owner.traits.Brave.enabled ? 7 : 0);');
      expect(out.value).toBe(7);
    });

    it('drops each write through the empty `owner` and reports it with the path as written', async () => {
      const out = await world('owner.stats.Rage.value = 3; owner.traits.Brave.enabled = true; owner.placeholders.Hair.pin("red"); owner.name = "x";');
      expect(out).toEqual({
        value: null, error: null,
        unknownStatWrites: ['owner.stats.Rage.value'],
        unknownOwnerPlaceholders: ['owner › Hair'],
        entities: [{ entity: '', owner: true, unknownTraits: ['Brave'] }],
        readOnlyWrites: ['owner.name'],
      });
    });

    it('never lets the empty `owner` stand in for the empty persona', async () => {
      const persona: SandboxEntity = { name: '', traits: [brave] };
      const out = await world('owner.traits.Brave.enabled = true; return owner === persona ? 1 : 0;', persona);
      expect(out.value).toBe(0);
      expect(out.entities).toEqual([{ entity: '', owner: true, unknownTraits: ['Brave'] }]);
    });

    it('keeps writing its own stats through `stats`', async () => {
      const out = await executeStatCode('stats.Gold.max = 50; return 4;', [gold, makeStat({ id: 'h', name: 'Health' })], makeStat({ id: 'h', name: 'Health' }));
      expect(out).toEqual({ value: 4, error: null, statWrites: [{ id: 'g', name: 'Gold', max: 50 }] });
    });
  });
});
