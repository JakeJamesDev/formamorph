/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeStatCode, type SandboxEntity, type SandboxItem, type StatCodeRunOptions } from './statCodeExecutor';
import type { Stat } from '@/types';

const health: Stat = { id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [] };

const places: NonNullable<StatCodeRunOptions['places']> = {
  locations: [{ id: 'loc-vault', name: 'Vault' }], location: { id: 'loc-vault', name: 'Vault' },
};

const keeper: SandboxEntity = { id: 'e-keeper', name: 'Keeper', traits: [{ name: 'Wary', enabled: true, acquired: true }] };
const hero: SandboxEntity = { id: 'e-hero', name: 'Hero', traits: [] };

const key: SandboxItem = {
  id: 'i-key', name: 'Brass Key', instances: [
    { id: 'c-1', where: { kind: 'you' }, quantity: 1, equipped: false, slot: '', occupies: [], allowed: [], hidden: false },
  ],
};

const memory = { id: 'm1', turn: 1, timestamp: 1, day: 1, daypart: 'morning', text: 'A line', name: '', custom: false, kept: true, inContext: true, pinned: false, forgotten: false };

const run = (code: string, over: Partial<StatCodeRunOptions> = {}) =>
  executeStatCode(code, [health], health, {
    places, entities: [keeper, hero], persona: hero, items: [key], memories: [memory],
    dictionaries: [{ name: 'Lore', id: 'd1', entries: [{ id: 'n1', name: 'Tides', keys: ['tide'], value: 'v', enabled: true, constant: false }] }],
    currencies: [{ id: 'coin', name: 'Coin', kind: 'name' }], ...over,
  });

/** Runs `pairs` of [read, expected category]; a mismatch throws in the sandbox and shows in the error. */
const expectCategories = async (pairs: [string, string][], over: Partial<StatCodeRunOptions> = {}) => {
  const res = await run(`
    const bad = [${pairs.map(([read, want]) => `[${read}, ${JSON.stringify(want)}, ${JSON.stringify(read)}]`).join(', ')}].filter((row) => row[0] !== row[1]);
    if (bad.length) throw new Error(JSON.stringify(bad));
    return 1;`, over);
  expect(res).toMatchObject({ value: 1, error: null });
};

describe('category', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('names the shape of every script-facing entry', async () => {
    await expectCategories([
      ['stats.Health.category', 'stat'], ['self.category', 'stat'], ['entities.Keeper.category', 'entity'], ['locations.Vault.category', 'location'],
      ['location.category', 'location'], ['items["Brass Key"].category', 'item'], ['items["Brass Key"].instances[0].category', 'itemInstance'],
      ['currencies.Coin.category', 'currency'], ['dictionaries.Lore.category', 'dictionary'], ['dictionaries.Lore.entries.Tides.category', 'dictionaryEntry'],
      ['memories[0].category', 'memory'], ['entities.Keeper.traits.Wary.category', 'trait'], ['persona.items[0].category', 'itemInstance'],
    ]);
  });

  it('reads "entity" on the persona and the owner entry', async () => {
    await expectCategories([['persona.category', 'entity'], ['entities.Hero.category', 'entity']]);
  });

  it('reads the shape’s value on a blank entry for an unknown name', async () => {
    await expectCategories([
      ['stats.Nope.category', 'stat'], ['stats.Nope.previous.category', 'stat'], ['entities.Nope.category', 'entity'], ['locations.Nope.category', 'location'],
      ['items.Nope.category', 'item'], ['currencies.Nope.category', 'currency'], ['dictionaries.Nope.category', 'dictionary'],
      ['memories.Nope.category', 'memory'], ['entities.Keeper.traits.Nope.category', 'trait'],
    ]);
  });

  it('reads "entity" on a persona that plays no entity', async () => {
    await expectCategories([['persona.category', 'entity']], { persona: { id: '', name: '', traits: [] } });
  });

  it('carries category on the previous snapshot of a stat', async () => {
    await expectCategories([['self.previous.category', 'stat'], ['stats.Health.previous.category', 'stat']]);
  });

  it('drops a write to category and lists it', async () => {
    const res = await run(`entities.Keeper.category = 'item'; stats.Health.category = 'x'; return 1;`);
    expect(res.readOnlyWrites).toEqual(expect.arrayContaining(['entities.Keeper.category', 'stats.Health.category']));
  });

  it('lists category among an entry’s keys', async () => {
    const res = await run(`return Object.keys(entities.Keeper).includes('category') && Object.keys(stats.Health).includes('category') ? 1 : 0;`);
    expect(res).toMatchObject({ value: 1, error: null });
  });
});
