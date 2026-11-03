/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeStatCode, type SandboxEntity, type SandboxItem, type StatCodeRunOptions } from './statCodeExecutor';
import { scriptMoney, type ScriptMoneyState } from './scriptMoney';
import type { Currency, Item, ItemCopy, ItemCopyWhere, PlayerStat, Stat } from '@/types';

const item = (id: string, name: string): Item => ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], stackable: true });
const items = [item('copper', 'Copper'), item('silver', 'Silver'), item('gold', 'Gold')];
const MONEY: Currency = {
  id: 'coin', name: 'Coin',
  backing: { kind: 'items', items: [{ itemId: 'copper', worth: 1 }, { itemId: 'silver', worth: 10 }, { itemId: 'gold', worth: 100 }] },
};
const CREDITS: Currency = { id: 'credits', name: 'Credits', backing: { kind: 'stat', statId: 'funds' } };
const GOATS: Currency = { id: 'goats', name: 'Goats', backing: { kind: 'name' } };

const keeper: SandboxEntity = { id: 'e-keeper', name: 'Keeper', traits: [] };
const stranger: SandboxEntity = { id: 'e-stranger', name: 'Stranger', traits: [] };
const hero: SandboxEntity = { id: 'e-hero', name: 'Hero', traits: [] };

const funds = (value: number, over: Partial<PlayerStat> = {}): PlayerStat =>
  ({ id: 'funds', name: 'Funds', type: 'number', description: '', min: 0, max: 1000, value, regen: 0, descriptors: [], ...over });

const moneyCopy = (id: string, itemId: string, where: ItemCopyWhere, quantity: number): ItemCopy =>
  ({ id, item: { kind: 'item', itemId }, where, quantity, visibility: 'visible' });

const sandboxBackingItem = (copy: ItemCopy): SandboxItem['copies'][number] =>
  ({ id: copy.id, where: copy.where, quantity: copy.quantity, equipped: false, slot: '', occupies: [], allowed: [], hidden: false });

const health: Stat = { id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [] };

const kinds = (currencies: readonly Currency[]) => currencies.map((c) => ({ id: c.id, name: c.name, kind: c.backing.kind }));

/** A run over a world with one Currency of each backing. The player holds 1 Gold; the Keeper is placed with Copper. */
function run(code: string, state: Partial<ScriptMoneyState> = {}, over: Partial<StatCodeRunOptions> = {}) {
  const copies = state.copies ?? [moneyCopy('c-gold', 'gold', { kind: 'you' }, 1), moneyCopy('c-copper', 'copper', { kind: 'entity', id: 'e-keeper' }, 3)];
  const money = scriptMoney({
    currencies: [MONEY, CREDITS, GOATS], items, itemNames: items, slots: [],
    placements: [{ id: 'p', source: { kind: 'item', itemId: 'copper' }, where: { kind: 'entity', id: 'e-keeper' }, quantity: 3 }],
    copies, stats: { globalStats: [], entityStats: { 'e-hero': [funds(50)], 'e-keeper': [funds(5)] } },
    playedIds: ['e-hero'], statsOn: (_id, stats) => stats,
    ...state,
  });
  const sandboxItems: SandboxItem[] = items.map(({ id, name }) => ({
    id, name, copies: copies.filter((c) => c.item.kind === 'item' && c.item.itemId === id).map(sandboxBackingItem),
  }));
  return executeStatCode(code, [health], null, {
    entities: [keeper, stranger, hero], persona: hero, items: sandboxItems, currencies: kinds([MONEY, CREDITS, GOATS]), money, ...over,
  });
}

describe('executeStatCode currencies', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reads an item balance, a stat balance and an untracked owner', async () => {
    const res = await run(`
      if (currencies.Coin.balance(persona) !== 100) throw new Error('coin ' + currencies.Coin.balance(persona));
      if (currencies.Coin.balance("Keeper") !== 3) throw new Error('keeper');
      if (currencies.Credits.balance(persona) !== 50) throw new Error('stat');
      if (currencies.Credits.balance(entities.Keeper) !== 5) throw new Error('keeper stat');
      if (currencies.Coin.balance(entities.Stranger) !== null) throw new Error('untracked coin');
      if (currencies.Credits.balance(entities.Stranger) !== null) throw new Error('untracked stat');
      if (currencies.Goats.balance(persona) !== null) throw new Error('name only');
    `);
    expect(res.error).toBeNull();
  });

  it('settles an item pay with exact change and shows the script the result', async () => {
    const res = await run(`
      const result = currencies.Coin.pay(persona, "Keeper", 5);
      if (!result.paid) throw new Error(result.reason);
      if (currencies.Coin.balance(persona) !== 95) throw new Error('balance ' + currencies.Coin.balance(persona));
    `);
    expect(res.error).toBeNull();
    // 1 Gold goes, 95 back as 9 Silver and 5 Copper. The Keeper's 3 Copper give way to 8 new ones, so it ends up by exactly 5.
    const keeper = { kind: 'entity', id: 'e-keeper' };
    expect(res.worldWrites?.inventory).toEqual(expect.arrayContaining([
      { kind: 'lose', copyId: 'c-gold', quantity: 1 },
      { kind: 'transfer', copyId: 'c-copper', to: { kind: 'you' }, quantity: 3 },
      { kind: 'gain', itemId: 'copper', quantity: 2, to: { kind: 'you' } },
      { kind: 'gain', itemId: 'silver', quantity: 9, to: { kind: 'you' } },
      { kind: 'gain', itemId: 'copper', quantity: 8, to: keeper },
    ]));
  });

  it('refuses a payment the owner cannot afford, changes nothing and lets the script see it', async () => {
    const res = await run(`
      const result = currencies.Coin.pay("Keeper", persona, 4);
      if (result.paid || !result.reason) throw new Error('should refuse');
      const stat = currencies.Credits.pay(persona, "Keeper", 51);
      if (stat.paid) throw new Error('stat should refuse');
      if (currencies.Coin.balance("Keeper") !== 3 || currencies.Credits.balance(persona) !== 50) throw new Error('moved');
    `);
    expect(res.error).toBeNull();
    expect(res.worldWrites).toBeUndefined();
    expect(res.ownerStatWrites).toBeUndefined();
  });

  it('settles a stat pay as final stat values for each side', async () => {
    const res = await run(`
      const result = currencies.Credits.pay(persona, "Keeper", 30);
      if (!result.paid) throw new Error(result.reason);
      if (currencies.Credits.balance(persona) !== 20 || currencies.Credits.balance("Keeper") !== 35) throw new Error('balances');
    `);
    expect(res.error).toBeNull();
    expect(res.ownerStatWrites).toEqual([
      { ownerId: 'e-hero', writes: [{ id: 'funds', name: 'Funds', value: 20 }] },
      { ownerId: 'e-keeper', writes: [{ id: 'funds', name: 'Funds', value: 35 }] },
    ]);
  });

  it('refuses a locked stat for the payer and for the payee, income included', async () => {
    const locked = { entityStats: { 'e-hero': [funds(50, { noDecrease: true })], 'e-keeper': [funds(5, { noIncrease: true })] }, globalStats: [] };
    const res = await run(`
      if (currencies.Credits.pay(persona, null, 10).paid) throw new Error('No Decrease should refuse');
      if (currencies.Credits.pay(null, "Keeper", 10).paid) throw new Error('No Increase should refuse income');
    `, { stats: locked });
    expect(res.error).toBeNull();
    expect(res.ownerStatWrites).toBeUndefined();
  });

  it('keeps direct stat writes working beside a payment', async () => {
    const res = await run(`
      stats.Health.value = 77;
      currencies.Credits.pay(persona, "Keeper", 10);
    `, {}, { entities: [keeper, stranger, hero] });
    expect(res.error).toBeNull();
    expect(res.statWrites).toEqual([expect.objectContaining({ name: 'Health', value: 77 })]);
    expect(res.ownerStatWrites).toEqual(expect.arrayContaining([{ ownerId: 'e-hero', writes: [expect.objectContaining({ value: 40 })] }]));
  });

  it('adds a payment to the value the script wrote to the same stat, and reads that write in balance', async () => {
    const withStats: SandboxEntity = { ...hero, stats: { stats: [funds(50)] } };
    const res = await run(`
      persona.stats.Funds.value = 100;
      if (currencies.Credits.balance(persona) !== 100) throw new Error('balance should read the written 100');
      if (!currencies.Credits.pay(persona, null, 30).paid) throw new Error('refused');
      if (currencies.Credits.balance(persona) !== 70) throw new Error('balance should read 70');
      persona.stats.Funds.value = 200;
      if (currencies.Credits.balance(persona) !== 170) throw new Error('balance should keep the payment over a later write');
      persona.stats.Funds.value = 100;
    `, {}, { entities: [keeper, stranger, withStats], persona: withStats });
    expect(res.error).toBeNull();
    expect(res.ownerStatWrites).toEqual([
      { ownerId: 'e-hero', writes: [expect.objectContaining({ id: 'funds', value: 100 })] },
      { ownerId: 'e-hero', writes: [expect.objectContaining({ id: 'funds', value: 70 })] },
    ]);
  });

  it('keeps give working on an item beside a payment', async () => {
    const res = await run(`
      items.Copper.give(persona, 4);
      currencies.Coin.pay(persona, null, 100);
    `);
    expect(res.error).toBeNull();
    expect(res.worldWrites?.inventory).toEqual([
      { kind: 'gain', itemId: 'copper', to: { kind: 'you' }, quantity: 4 },
      { kind: 'lose', copyId: 'c-gold', quantity: 1 },
    ]);
  });

  it('does not let a second payment spend the change the first made, and says the next script can', async () => {
    const res = await run(`
      if (!currencies.Coin.pay(persona, null, 5).paid) throw new Error('first');
      // 95 of change is held now, and the run cannot name those copies yet.
      const second = currencies.Coin.pay(persona, null, 50);
      if (second.paid) throw new Error('second should refuse');
      if (second.reason !== "this script can't spend the items it just made, but the next script can") throw new Error(second.reason);
    `);
    expect(res.error).toBeNull();
  });

  it('counts the run’s own give in balance, while its pay refuses to spend it', async () => {
    const res = await run(`
      items.Copper.give(persona, 4);
      if (currencies.Coin.balance(persona) !== 104) throw new Error('balance ' + currencies.Coin.balance(persona));
      const over = currencies.Coin.pay(persona, null, 103);
      if (over.reason !== "this script can't spend the items it just made, but the next script can") throw new Error(over.reason);
      const never = currencies.Coin.pay(persona, null, 500);
      if (never.paid || never.reason === over.reason) throw new Error('a sum no copy covers keeps its own reason');
    `);
    expect(res.error).toBeNull();
  });

  it('counts the run’s own loss in balance and in a payment’s plan', async () => {
    const res = await run(`
      persona.items[0].lose();
      if (currencies.Coin.balance(persona) !== 0) throw new Error('balance');
      if (currencies.Coin.pay(persona, null, 5).paid) throw new Error('a lost copy should not pay');
    `);
    expect(res.error).toBeNull();
  });

  it('plans a stat payment over the run’s own write, so it can’t undercharge', async () => {
    const withStats: SandboxEntity = { ...hero, stats: { stats: [funds(50)] } };
    const res = await run(`
      persona.stats.Funds.value -= 40;
      if (currencies.Credits.pay(persona, null, 30).paid) throw new Error('should refuse: 10 is left');
      if (!currencies.Credits.pay(persona, null, 10).paid) throw new Error('should pay');
    `, {}, { entities: [keeper, stranger, withStats], persona: withStats });
    expect(res.error).toBeNull();
    expect(res.ownerStatWrites?.at(-1)).toEqual({ ownerId: 'e-hero', writes: [expect.objectContaining({ id: 'funds', value: 0 })] });
  });

  it('reads a write past the stat’s max as that max, in balance and in what lands', async () => {
    const withStats: SandboxEntity = { ...hero, stats: { stats: [funds(50)] } };
    const res = await run(`
      persona.stats.Funds.value = 5000;
      if (!currencies.Credits.pay(persona, null, 30).paid) throw new Error('refused');
      if (currencies.Credits.balance(persona) !== 970) throw new Error('balance ' + currencies.Credits.balance(persona));
    `, {}, { entities: [keeper, stranger, withStats], persona: withStats });
    expect(res.error).toBeNull();
    expect(res.ownerStatWrites?.at(-1)).toEqual({ ownerId: 'e-hero', writes: [expect.objectContaining({ id: 'funds', value: 970 })] });
  });

  it('reads a script’s own `self.value` write in balance', async () => {
    const purse = funds(50);
    const money = scriptMoney({
      currencies: [CREDITS], items, itemNames: items, slots: [], placements: [], copies: [],
      stats: { globalStats: [purse], entityStats: {} }, playedIds: ['e-hero'], statsOn: (_id, stats) => stats,
    });
    const res = await executeStatCode(`
      self.value = 80;
      if (currencies.Credits.balance(persona) !== 80) throw new Error('balance ' + currencies.Credits.balance(persona));
    `, [purse], purse, { entities: [hero], persona: hero, currencies: kinds([CREDITS]), money });
    expect(res.error).toBeNull();
  });

  it('settles a name-only Currency as paid with nothing to land', async () => {
    const res = await run(`if (!currencies.Goats.pay(persona, "Keeper", 3).paid) throw new Error('refused');`);
    expect(res.error).toBeNull();
    expect(res.worldWrites).toBeUndefined();
  });

  it('reads a text price in the Currency’s own Items', async () => {
    const res = await run(`
      if (!currencies.Coin.pay(persona, null, "5 Copper").paid) throw new Error('text price');
      if (currencies.Coin.pay(persona, null, "5 Credits").paid) throw new Error('another Currency should refuse');
    `);
    expect(res.error).toBeNull();
  });

  it('stops the script on a name no Currency has or a party the game lacks', async () => {
    expect((await run(`currencies.Dollar.balance(persona);`)).error).toMatch(/no Currency named "Dollar"/);
    expect((await run(`currencies.Coin.pay("Nobody", persona, 1);`)).error).toMatch(/needs an entity or the persona the game has/);
    expect((await run(`currencies.Coin.pay({ id: 'a-location', name: 'Dock' }, persona, 1);`)).error).toMatch(/needs an entity or the persona the game has/);
    expect((await run(`currencies.Coin.balance(null);`)).error).toMatch(/needs an entity or the persona the game has/);
  });

  it('discards a payment when the script then fails', async () => {
    const res = await run(`currencies.Credits.pay(persona, "Keeper", 10); throw new Error('boom');`);
    expect(res.error).toMatch(/boom/);
    expect(res.ownerStatWrites).toBeUndefined();
  });

  it('exposes no more than id, name and kind as fields, and no host hook', async () => {
    const res = await run(`
      if (Object.keys(currencies.Coin).join() !== 'id,name,kind') throw new Error(Object.keys(currencies.Coin).join());
      if (typeof globalThis.__formamorphMoney !== 'undefined') throw new Error('hook left behind');
      currencies.Coin.id = 'x';
    `);
    expect(res.error).toBeNull();
    expect(res.readOnlyWrites).toEqual(['currencies.Coin.id']);
  });

  it('reads with no world Currencies as blank entries that stop the script', async () => {
    const res = await executeStatCode('currencies.Coin.balance(persona);', [health], null, { persona: hero, entities: [hero] });
    expect(res.error).toMatch(/no Currency named "Coin"/);
  });

  it('leaves a read-only run with no pay', async () => {
    const res = await run(`currencies.Coin.pay(persona, null, 1);`, {}, { readOnly: true });
    expect(res.error).not.toBeNull();
  });
});
