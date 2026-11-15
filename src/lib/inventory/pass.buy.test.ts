import { describe, expect, it } from 'vitest';
import { followsResponseSchema } from '@/lib/aiRequest/responseSchema';
import { applyInventoryPass, inventoryPassSchema, parseInventoryLines, parseInventoryReply, type PassMoney, type PassScene } from '.';
import type { Currency, InventoryPassOp, Item, ItemInstance, Placement, PlayerStat } from '@/types';

const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const ids = () => { let i = 0; return () => `n${i++}`; };

const copper = item('copper', 'Copper', { stackable: true });
const gold = item('gold', 'Gold', { stackable: true });
const shell = item('shell', 'Shell', { stackable: true });
const MONEY: Currency = { id: 'coin', name: 'Coin', backing: { kind: 'items', items: [{ itemId: 'copper', worth: 1 }, { itemId: 'gold', worth: 100 }] } };
const SHELLS: Currency = { id: 'shells', name: 'Shells', backing: { kind: 'items', items: [{ itemId: 'shell', worth: 1 }] } };
const CREDITS: Currency = { id: 'credits', name: 'Credits', backing: { kind: 'stat', statId: 'funds' } };
const GOATS: Currency = { id: 'goats', name: 'Goats', backing: { kind: 'name' } };

const sword = item('sword', 'Iron Sword', { value: 150, currencyId: 'coin' });
const dagger = item('dagger', 'Dagger', { value: 5, currencyId: 'coin', stackable: true });
const potion = item('potion', 'Potion', { value: 30, currencyId: 'credits', stackable: true });
const flute = item('flute', 'Flute', { value: 2, currencyId: 'goats' });
const rope = item('rope', 'Rope');
const relic = item('relic', 'Relic', { value: 9 });
const pebble = item('pebble', 'Pebble', { value: 0, currencyId: 'coin' });
const ITEMS = [copper, gold, shell, sword, dagger, potion, flute, rope, relic, pebble];

const you = { kind: 'you' } as const;
const mara = { kind: 'entity', id: 'mara' } as const;
const shop = { kind: 'location', id: 'shop' } as const;

const instance = (id: string, itemId: string, where: ItemInstance['where'], quantity = 1, over: Partial<ItemInstance> = {}): ItemInstance =>
  ({ id, item: { kind: 'item', itemId }, where, quantity, visibility: 'visible', ...over });
const buy = (name: string, owner: string, to: string, over: Partial<InventoryPassOp> = {}): InventoryPassOp =>
  ({ op: 'buy', item: name, quantity: 1, owner, to, ...over });
const pay = (owner: string, to: string, price: string): InventoryPassOp => ({ op: 'pay', item: '', quantity: 1, owner, to, price });
const hand = (kind: InventoryPassOp['op'], name: string, owner: string, to = ''): InventoryPassOp => ({ op: kind, item: name, quantity: 1, owner, to });

const funds = (value: number): PlayerStat =>
  ({ id: 'funds', name: 'Funds', type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [] });
const maraPurse: Placement = { id: 'purse', source: { kind: 'item', itemId: 'gold' }, where: mara, quantity: 1 };

const money = (over: Partial<PassMoney> = {}): PassMoney => ({
  currencies: [MONEY, SHELLS, CREDITS, GOATS], placements: [], stats: { globalStats: [funds(50)], entityStats: {} }, playedIds: ['hero'], statsOn: (_owner, stats) => stats, ...over,
});
const scene = (over: Partial<PassScene> = {}): PassScene => ({
  items: ITEMS, runtimeItems: [], playerNames: ['Ashley Vance', 'Little Bird'], owners: [{ id: 'mara', name: 'Mara' }], location: { id: 'shop', name: 'Shop' }, money: money(), ...over,
});
const settle = (instances: ItemInstance[], ops: InventoryPassOp[], over: Partial<PassScene> = {}) =>
  applyInventoryPass(instances, ops, scene(over), { world: { items: ITEMS }, newId: ids() });
const counts = (instances: readonly ItemInstance[], where: ItemInstance['where']) => Object.fromEntries(instances
  .filter((c) => JSON.stringify(c.where) === JSON.stringify(where)).map((c) => [c.item.kind === 'item' ? c.item.itemId : c.item.runtimeItemId, c.quantity]));
const fundsAfter = (result: ReturnType<typeof settle>) => result.stats?.globalStats.find((stat) => stat.id === 'funds')?.value;

describe('parsing a buy', () => {
  it('reads from the schema and the text line, and needs an item', () => {
    const json = JSON.stringify({ operations: [{ op: 'buy', item: 'Dagger', quantity: 2, owner: 'Mara', to: 'you', price: '8 Copper', currency: 'Coin' }] });
    expect(followsResponseSchema(json, inventoryPassSchema().schema)).toBe(true);
    expect(parseInventoryReply(json)).toEqual([buy('Dagger', 'Mara', 'you', { quantity: 2, price: '8 Copper', currency: 'Coin' })]);
    expect(parseInventoryLines('buy | Dagger | 2 | Mara | you |  |  |  |  | 8 Copper | Coin'))
      .toEqual([buy('Dagger', 'Mara', 'you', { quantity: 2, state: '', price: '8 Copper', currency: 'Coin' })]);
    expect(parseInventoryLines('buy |  | 1 | Mara | you')).toEqual([]);
  });
});

describe('a buy moves money and item as one', () => {
  it('moves items to a tracked seller and the item to the buyer', () => {
    const { instances, diagnostics } = settle([instance('s', 'sword', mara), instance('g', 'gold', you, 2), instance('m', 'gold', mara)],
      [buy('Iron Sword', 'Mara', 'you')], { money: money({ placements: [maraPurse] }) });
    expect(diagnostics).toEqual([]);
    expect(counts(instances, you)).toEqual({ sword: 1, copper: 50 });
    expect(counts(instances, mara)).toEqual({ gold: 2, copper: 50 });
  });

  it('moves a stat with the item', () => {
    const result = settle([instance('p', 'potion', mara)], [buy('Potion', 'Mara', 'you')]);
    expect(fundsAfter(result)).toBe(20);
    expect(counts(result.instances, you)).toEqual({ potion: 1 });
  });

  it('refuses what the buyer cannot afford: neither moves', () => {
    const start = [instance('s', 'sword', mara), instance('g', 'gold', you)];
    const { instances, diagnostics, events } = settle(start, [buy('Iron Sword', 'Mara', 'you')]);
    expect(instances).toEqual(start);
    expect(events).toEqual([]);
    expect(diagnostics).toEqual([expect.stringMatching(/^Inventory \(pass\) skipped buy "Iron Sword": it costs 150/)]);
  });

  it('takes the money back when the item then cannot move', () => {
    const start = [instance('s', 'sword', mara), instance('g', 'gold', you, 2)];
    const { instances, diagnostics, events } = applyInventoryPass(start, [buy('Iron Sword', 'Mara', 'you')], scene(), {
      world: { items: ITEMS }, newId: ids(), presence: { locationId: 'shop', entityIds: new Set() },
    });
    expect(instances).toEqual(start);
    expect(events).toEqual([]);
    expect(diagnostics).toEqual([expect.stringContaining('skipped buy "Iron Sword"')]);
  });

  it('takes a stat back when no item can be made', () => {
    const result = settle([], [buy('Mystery Box', 'Mara', 'you', { price: '5', currency: 'Credits' })], { items: [] });
    expect(fundsAfter(result)).toBe(50);
    expect(result.instances).toEqual([]);
    expect(result.runtimeItems).toEqual([]);
  });

  it('refuses a seller who sells to itself, and a buy naming no buyer', () => {
    const start = [instance('s', 'sword', mara), instance('g', 'gold', you, 2)];
    expect(settle(start, [buy('Iron Sword', 'Mara', 'Mara')]).instances).toEqual(start);
    expect(settle(start, [buy('Iron Sword', 'Mara', '')]).instances).toEqual(start);
    expect(settle(start, [buy('Iron Sword', 'Mara', 'the stranger')]).instances).toEqual(start);
  });
});

describe('what a buy costs', () => {
  it('prices the whole purchase by quantity from Value', () => {
    const { instances } = settle([instance('d', 'dagger', mara, 4), instance('c', 'copper', you, 20)], [buy('Dagger', 'Mara', 'you', { quantity: 3 })]);
    expect(counts(instances, you)).toEqual({ copper: 5, dagger: 3 });
  });

  it('counts a stated price as the whole purchase, and over Value', () => {
    const { instances } = settle([instance('d', 'dagger', mara, 4), instance('c', 'copper', you, 20)], [buy('Dagger', 'Mara', 'you', { quantity: 3, price: '4 Copper' })]);
    expect(counts(instances, you)).toEqual({ copper: 16, dagger: 3 });
  });

  it("reads a bare number in the item's Currency, not the Default (Q65)", () => {
    const result = settle([instance('p', 'potion', mara), instance('c', 'copper', you, 20)], [buy('Potion', 'Mara', 'you', { price: '12' })]);
    expect(fundsAfter(result)).toBe(38);
    expect(counts(result.instances, you)).toEqual({ copper: 20, potion: 1 });
  });

  it('reads a bare number on an item with no Currency in the Default', () => {
    const { instances } = settle([instance('r', 'rope', mara), instance('c', 'copper', you, 20)], [buy('Rope', 'Mara', 'you', { price: '12' })]);
    expect(counts(instances, you)).toEqual({ copper: 8, rope: 1 });
  });

  it("lets a named item or a stated Currency override the item's Currency", () => {
    const named = settle([instance('p', 'potion', mara), instance('c', 'shell', you, 20)], [buy('Potion', 'Mara', 'you', { price: '12 Shell' })]);
    expect(fundsAfter(named)).toBe(50);
    expect(counts(named.instances, you)).toEqual({ shell: 8, potion: 1 });
    const stated = settle([instance('p', 'potion', mara), instance('c', 'shell', you, 20)], [buy('Potion', 'Mara', 'you', { price: '3', currency: 'Shells' })]);
    expect(counts(stated.instances, you)).toEqual({ shell: 17, potion: 1 });
  });

  it('ignores a stated Currency with no stated price', () => {
    const result = settle([instance('p', 'potion', mara), instance('c', 'shell', you, 40)], [buy('Potion', 'Mara', 'you', { currency: 'Shells' })]);
    expect(fundsAfter(result)).toBe(20);
    expect(counts(result.instances, you)).toEqual({ shell: 40, potion: 1 });
  });

  it('never draws on another Currency: a stated price the buyer lacks is refused (Q26)', () => {
    const start = [instance('p', 'potion', mara), instance('c', 'copper', you, 40)];
    expect(settle(start, [buy('Potion', 'Mara', 'you', { price: '3 Shell' })]).instances).toEqual(start);
    expect(settle(start, [buy('Potion', 'Mara', 'you', { price: '3 Copper, 1 Shell' })]).instances).toEqual(start);
  });

  it.each([
    ['no Value and no Currency', 'Rope', 'rope'],
    ['a Value and no existing Currency', 'Relic', 'relic'],
  ])('refuses %s with no stated price', (_case, name, id) => {
    const start = [instance('x', id, mara), instance('c', 'copper', you, 40)];
    const { instances, diagnostics } = settle(start, [buy(name, 'Mara', 'you')]);
    expect(instances).toEqual(start);
    expect(diagnostics).toEqual([expect.stringContaining('it has no price')]);
  });

  it('ignores a stated Currency that names no money when the price names its own (Q50)', () => {
    const { instances } = settle([instance('c', 'copper', you, 40)], [buy('Dagger', 'Mara', 'you', { price: '1 Copper', currency: 'Silver and Copper' })]);
    expect(counts(instances, you)).toEqual({ copper: 39, dagger: 1 });
    const start = [instance('c', 'copper', you, 40)];
    expect(settle(start, [buy('Dagger', 'Mara', 'you', { price: '1', currency: 'Silver and Copper' })]).instances).toEqual(start);
  });

  it('refuses a stated price of nothing, since a gift is no buy', () => {
    const start = [instance('s', 'sword', mara), instance('c', 'copper', you, 40)];
    expect(settle(start, [buy('Iron Sword', 'Mara', 'you', { price: '0' })]).instances).toEqual(start);
  });

  it('refuses an item price that is not a whole number of items', () => {
    const fractional = item('dust', 'Dust', { value: 1.5, currencyId: 'coin' });
    const start = [instance('x', 'dust', mara), instance('c', 'copper', you, 40)];
    const { instances } = settle(start, [buy('Dust', 'Mara', 'you')], { items: [...ITEMS, fractional] });
    expect(instances).toEqual(start);
  });
});

describe('an item that moves alone (Q64)', () => {
  it('moves alone in a world with no stat or item Currency, ignoring the price', () => {
    for (const noMoney of [{ money: undefined }, { money: money({ currencies: [GOATS] }) }]) {
      const { instances } = settle([instance('s', 'sword', mara), instance('c', 'copper', you, 40)], [buy('Iron Sword', 'Mara', 'you', { price: '12 Copper' })], noMoney);
      expect(counts(instances, you)).toEqual({ copper: 40, sword: 1 });
    }
  });

  it("moves alone in a name-only Currency, stated or by the item's own", () => {
    const start = [instance('f', 'flute', mara), instance('c', 'copper', you, 40)];
    expect(counts(settle(start, [buy('Flute', 'Mara', 'you')]).instances, you)).toEqual({ copper: 40, flute: 1 });
    expect(counts(settle(start, [buy('Flute', 'Mara', 'you', { price: '2', currency: 'Goats' })]).instances, you)).toEqual({ copper: 40, flute: 1 });
    const start2 = [instance('s', 'sword', mara), instance('c', 'copper', you, 40)];
    expect(counts(settle(start2, [buy('Iron Sword', 'Mara', 'you', { price: '3 Goats' })]).instances, you)).toEqual({ copper: 40, sword: 1 });
  });

  it('moves alone at a Value of 0', () => {
    const { instances, diagnostics } = settle([instance('p', 'pebble', mara)], [buy('Pebble', 'Mara', 'you')]);
    expect(diagnostics).toEqual([]);
    expect(counts(instances, you)).toEqual({ pebble: 1 });
  });

  it('charges a named item on a name-only item: a stated price counts (Q65)', () => {
    const { instances } = settle([instance('f', 'flute', mara), instance('c', 'copper', you, 40)], [buy('Flute', 'Mara', 'you', { price: '12 Copper' })]);
    expect(counts(instances, you)).toEqual({ copper: 28, flute: 1 });
  });

  it('refuses a Value of 0 with no Currency: priceless wins (Q13)', () => {
    const free = item('leaf', 'Leaf', { value: 0 });
    const start = [instance('l', 'leaf', mara)];
    const { instances, diagnostics } = settle(start, [buy('Leaf', 'Mara', 'you')], { items: [...ITEMS, free] });
    expect(instances).toEqual(start);
    expect(diagnostics).toEqual([expect.stringContaining('it has no price')]);
  });
});

describe('selling (Q20)', () => {
  it('pays the player from a tracked buyer, at full Value', () => {
    const { instances, diagnostics } = settle([instance('s', 'sword', you), instance('m', 'gold', mara, 2)], [buy('Iron Sword', 'you', 'Mara')], { money: money({ placements: [maraPurse] }) });
    expect(diagnostics).toEqual([]);
    expect(counts(instances, you)).toEqual({ gold: 1, copper: 50 });
    expect(counts(instances, mara)).toEqual({ sword: 1, copper: 50 });
  });

  it('pays the player from an untracked buyer, by new money', () => {
    const { instances } = settle([instance('s', 'sword', you)], [buy('Iron Sword', 'you', 'Mara', { price: '3 Gold' })]);
    expect(counts(instances, you)).toEqual({ gold: 3 });
    expect(counts(instances, mara)).toEqual({ sword: 1 });
  });

  it('refuses a tracked buyer who cannot pay', () => {
    const start = [instance('s', 'sword', you), instance('m', 'copper', mara, 3)];
    const { instances } = settle(start, [buy('Iron Sword', 'you', 'Mara')], { money: money({ placements: [maraPurse] }) });
    expect(instances).toEqual(start);
  });

  it('adds to a stat wallet', () => {
    const result = settle([instance('p', 'potion', you)], [buy('Potion', 'you', 'Mara')]);
    expect(fundsAfter(result)).toBe(80);
    expect(counts(result.instances, mara)).toEqual({ potion: 1 });
  });

  it.each(['', 'here', 'the fence'])('sells to no one when the buyer reads "%s": the item leaves and money is made (Q67)', (to) => {
    const { instances } = settle([instance('s', 'sword', you)], [buy('Iron Sword', 'you', to, { price: '2 Gold' })]);
    expect(counts(instances, you)).toEqual({ gold: 2 });
    expect(instances).toHaveLength(1);
  });

  it.each(['you', 'Little Bird', 'Ashley'])('never reads "%s" as the buyer no one is: a buy to a player name buys', (to) => {
    const { instances } = settle([instance('s', 'sword', mara), instance('g', 'gold', you, 2)], [buy('Iron Sword', 'Mara', to)]);
    expect(counts(instances, you)).toEqual({ sword: 1, copper: 50 });
  });

  it.each(['you', 'Ashley'])('never reads a seller "%s" with "you" as the buyer as a sale to no one', (name) => {
    const start = [instance('s', 'sword', you)];
    expect(settle(start, [buy('Iron Sword', name, 'you')]).instances).toEqual(start);
  });

  it('pays nothing and makes no instance when the player sells what they do not hold (Q63)', () => {
    const start = [instance('c', 'copper', you, 1)];
    const result = settle(start, [buy('Iron Sword', 'you', 'Mara', { price: '9 Gold' })]);
    expect(result.instances).toEqual(start);
    expect(result.diagnostics).toEqual([expect.stringContaining('skipped buy "Iron Sword"')]);
  });

  it('refuses a player sale above the held quantity, and one of a hidden instance', () => {
    const short = [instance('d', 'dagger', you, 1)];
    expect(settle(short, [buy('Dagger', 'you', 'Mara', { quantity: 2 })]).instances).toEqual(short);
    const hidden = [instance('d', 'dagger', you, 1, { visibility: 'hidden' })];
    expect(settle(hidden, [buy('Dagger', 'you', 'Mara')]).instances).toEqual(hidden);
  });

  it('sells a Bound instance and an equipped one', () => {
    const boundDagger = item('dagger', 'Dagger', { value: 5, currencyId: 'coin', stackable: true, bound: true });
    const result = applyInventoryPass([instance('d', 'dagger', you, 1, { equipped: { slotId: 'hand', order: 1 } })], [buy('Dagger', 'you', 'Mara')], scene({ items: [copper, gold, boundDagger] }), { world: { items: [copper, gold, boundDagger] }, newId: ids() });
    expect(result.diagnostics).toEqual([]);
    expect(counts(result.instances, you)).toEqual({ copper: 5 });
    expect(counts(result.instances, mara)).toEqual({ dagger: 1 });
  });
});

describe('where a bought item comes from (Q66)', () => {
  const purse = instance('c', 'copper', you, 500);

  it("makes a new instance when the seller holds none, and the seller's money still moves", () => {
    const { instances } = settle([purse, instance('m', 'gold', mara)], [buy('Iron Sword', 'Mara', 'you')], { money: money({ placements: [maraPurse] }) });
    expect(counts(instances, you)).toEqual({ copper: 350, sword: 1 });
    expect(counts(instances, mara).copper).toBe(150);
  });

  it('takes what lies here before making a new one', () => {
    const { instances } = settle([purse, instance('s', 'sword', shop)], [buy('Iron Sword', 'Mara', 'you')]);
    expect(counts(instances, you).sword).toBe(1);
    expect(counts(instances, shop)).toEqual({});
  });

  it('takes from the seller, then here, then makes the rest, at one price', () => {
    const { instances } = settle([purse, instance('a', 'dagger', mara, 1), instance('b', 'dagger', shop, 1)], [buy('Dagger', 'Mara', 'you', { quantity: 3 })]);
    expect(counts(instances, you)).toEqual({ copper: 485, dagger: 3 });
    expect(counts(instances, mara)).toEqual({});
    expect(counts(instances, shop)).toEqual({});
  });

  it('never sells a hidden instance: it stays and a new one comes', () => {
    const hidden = instance('s', 'sword', mara, 1, { visibility: 'hidden' });
    const { instances } = settle([purse, hidden], [buy('Iron Sword', 'Mara', 'you')]);
    expect(instances.find((c) => c.id === 's')).toEqual(hidden);
    expect(counts(instances, you).sword).toBe(1);
  });

  it.each(['here', 'Shop', '', 'the peddler'])('sends the money out of the world with a seller of "%s"', (owner) => {
    const { instances } = settle([purse, instance('s', 'sword', shop)], [buy('Iron Sword', owner, 'you')]);
    expect(counts(instances, you)).toEqual({ copper: 350, sword: 1 });
    expect(instances).toHaveLength(2);
  });

  it('makes a runtime item for an unknown name with a stated price, and refuses one with none', () => {
    const priced = settle([purse], [buy('Meat Pie', 'Mara', 'you', { price: '3 Copper' })]);
    expect(priced.runtimeItems.map((r) => r.name)).toEqual(['Meat Pie']);
    expect(counts(priced.instances, you).copper).toBe(497);
    const unpriced = settle([purse], [buy('Meat Pie', 'Mara', 'you')]);
    expect(unpriced.instances).toEqual([purse]);
    expect(unpriced.runtimeItems).toEqual([]);
  });

  it('buys an unidentified item under its Unidentified Name at its true Value', () => {
    const veiled = item('veiled', 'Sun Blade', { unidentifiedName: 'Odd Blade', value: 100, currencyId: 'coin', stackable: true });
    const start = [instance('v', 'veiled', mara, 1, { state: { unidentified: true } }), instance('g', 'gold', you, 1)];
    const { instances } = applyInventoryPass(start, [buy('Odd Blade', 'Mara', 'you')], scene({ items: [...ITEMS, veiled] }), { world: { items: [...ITEMS, veiled] }, newId: ids() });
    expect(counts(instances, you)).toEqual({ veiled: 1 });
  });
});

describe('a pay that names money in item beside a price (Q80)', () => {
  const start = [instance('g', 'gold', you, 6)];
  const named = (item: string, price: string): InventoryPassOp => ({ ...pay('you', '', price), item });

  it('counts a bare price in the item named: item Gold and price 5 is 5 Gold', () => {
    const { instances, diagnostics } = settle(start, [named('Gold', '5')]);
    expect(diagnostics).toEqual([]);
    expect(counts(instances, you)).toEqual({ gold: 1 });
  });

  it('reads the item as Items Here lists it, with its count or description', () => {
    for (const listed of ['Gold (3)', 'Gold: a coin']) {
      const { instances, diagnostics } = settle(start, [named(listed, '5')]);
      expect(diagnostics).toEqual([]);
      expect(counts(instances, you)).toEqual({ gold: 1 });
    }
  });

  it('settles a price that names another item of the same Currency by its own words', () => {
    expect(settle(start, [named('Gold', '5 Copper')]).diagnostics).toEqual([]);
  });

  it('refuses a price that names another Currency than the item', () => {
    const { instances, diagnostics } = settle([...start, instance('s', 'shell', you, 9)], [named('Gold', '5 Shell')]);
    expect(counts(instances, you)).toEqual({ gold: 6, shell: 9 });
    expect(diagnostics).toEqual([expect.stringContaining('skipped pay')]);
  });
});

describe('a pay that names an item (Q70)', () => {
  const namingPay = (name: string): InventoryPassOp => ({ ...pay('Mara', 'you', '25'), item: name });

  it('refuses a pay naming an authored item: no money appears', () => {
    const start = [instance('s', 'sword', mara)];
    const { instances, diagnostics } = settle(start, [namingPay('Iron Sword')]);
    expect(instances).toEqual(start);
    expect(diagnostics).toEqual([expect.stringContaining("isn't money")]);
  });

  it('refuses a pay naming a runtime item', () => {
    const { instances } = settle([], [namingPay('Meat Pie')], { runtimeItems: [{ id: 'pie', name: 'Meat Pie' }] });
    expect(instances).toEqual([]);
  });

  it.each(['Copper', 'Coin'])('settles a pay whose item reads "%s"', (name) => {
    const { instances } = settle([], [namingPay(name)]);
    expect(counts(instances, you)).toEqual({ copper: 25 });
  });

  it('refuses a pay naming a person, which reads the same as talk about a price', () => {
    const { instances, diagnostics } = settle([], [namingPay('the reeve')]);
    expect(instances).toEqual([]);
    expect(diagnostics).toEqual([expect.stringContaining("isn't money")]);
  });
});

describe('one reply, one statement (Q68, Q69)', () => {
  const purse = instance('g', 'gold', you, 5);

  it('skips a gain and a transfer of the bought item', () => {
    const { instances, diagnostics } = settle([purse, instance('s', 'sword', mara)],
      [hand('gain', 'Iron Sword', 'Mara', 'you'), buy('Iron Sword', 'Mara', 'you'), hand('transfer', 'iron sword', 'Mara', 'you')]);
    expect(counts(instances, you).sword).toBe(1);
    expect(diagnostics.filter((line) => line.includes('covers this item'))).toHaveLength(2);
  });

  it('never delivers a refused buy through a gain', () => {
    const start = [instance('g', 'gold', you), instance('s', 'sword', mara)];
    const { instances } = settle(start, [buy('Iron Sword', 'Mara', 'you'), hand('gain', 'Iron Sword', 'Mara', 'you')]);
    expect(instances).toEqual(start);
  });

  it("skips hand moves of the buy's Currency Items", () => {
    const { instances, diagnostics } = settle([purse], [buy('Iron Sword', 'Mara', 'you', { price: '1 Gold' }), hand('lose', 'Gold', 'you'), hand('transfer', 'Gold', 'you', 'Mara')]);
    expect(counts(instances, you)).toEqual({ gold: 4, sword: 1 });
    expect(diagnostics.filter((line) => line.includes('covers this money'))).toHaveLength(2);
  });

  it("skips hand moves of all money when a buy's price can't be read", () => {
    const { instances } = settle([purse, instance('c', 'shell', you, 3)], [buy('Rope', 'Mara', 'you'), hand('lose', 'Gold', 'you'), hand('lose', 'Shell', 'you')]);
    expect(counts(instances, you)).toEqual({ gold: 5, shell: 3 });
  });

  it('keeps hand moves of another Currency', () => {
    const { instances } = settle([purse, instance('c', 'shell', you, 3)], [buy('Iron Sword', 'Mara', 'you', { price: '1 Gold' }), hand('lose', 'Shell', 'you')]);
    expect(counts(instances, you)).toEqual({ gold: 4, shell: 2, sword: 1 });
  });

  it('drops a pay of the same sum between the same parties, in either order', () => {
    for (const ops of [[buy('Iron Sword', 'Mara', 'you'), pay('you', 'Mara', '150')], [pay('You', 'mara', '1 Gold, 50 Copper'), buy('Iron Sword', 'Mara', 'you')]]) {
      const { instances, diagnostics } = settle([purse], ops);
      expect(counts(instances, you)).toEqual({ gold: 3, copper: 50, sword: 1 });
      expect(diagnostics).toEqual([expect.stringContaining('the same sum')]);
    }
  });

  it('drops a same-sum pay beside a sale', () => {
    const { instances } = settle([instance('s', 'sword', you)], [buy('Iron Sword', 'you', 'Mara'), pay('Mara', 'you', '150')]);
    expect(counts(instances, you)).toEqual({ gold: 1, copper: 50 });
  });

  it.each([
    ['a blank payee', 'you', ''],
    ['a blank payer', '', 'you'],
    ['the buy\'s own direction', 'Mara', 'you'],
    ['a stranger as payee', 'you', 'the harbor guard'],
  ])('drops a pay of the same sum with %s', (_shape, owner, to) => {
    const { instances, diagnostics } = settle([purse], [buy('Iron Sword', 'Mara', 'you'), pay(owner, to, '150')]);
    expect(counts(instances, you)).toEqual({ gold: 3, copper: 50, sword: 1 });
    expect(diagnostics).toEqual([expect.stringContaining('the same sum')]);
  });

  it('settles a pay of any other amount, of another Currency, and one between two others', () => {
    const tip = settle([purse], [buy('Iron Sword', 'Mara', 'you', { price: '150' }), pay('you', 'Mara', '1 Gold')]);
    expect(counts(tip.instances, you)).toEqual({ gold: 2, copper: 50, sword: 1 });
    const shells = settle([purse, instance('c', 'shell', you, 200)], [buy('Iron Sword', 'Mara', 'you'), pay('you', 'Mara', '150 Shell')]);
    expect(counts(shells.instances, you)).toEqual({ gold: 3, copper: 50, shell: 50, sword: 1 });
    const owners = [{ id: 'mara', name: 'Mara' }, { id: 'reeve', name: 'Reeve' }, { id: 'clerk', name: 'Clerk' }];
    const others = settle([purse, instance('r', 'copper', { kind: 'entity', id: 'reeve' }, 150)], [buy('Iron Sword', 'Mara', 'you'), pay('Reeve', 'Clerk', '150')], {
      owners, money: money({ placements: [{ id: 'r', source: { kind: 'item', itemId: 'copper' }, where: { kind: 'entity', id: 'reeve' }, quantity: 1 }] }),
    });
    expect(counts(others.instances, { kind: 'entity', id: 'reeve' })).toEqual({});
    expect(others.diagnostics).toEqual([]);
  });

  it("never charges a broke player through the pay beside a refused buy (Q15)", () => {
    const start = [instance('c', 'copper', you, 100), instance('s', 'sword', mara)];
    for (const paired of [pay('you', 'Mara', '150'), pay('you', '', '150')]) {
      const { instances } = settle(start, [buy('Iron Sword', 'Mara', 'you'), paired]);
      expect(instances).toEqual(start);
    }
    // A broke player can still afford a pay that isn't the buy's sum.
    const { instances } = settle(start, [buy('Iron Sword', 'Mara', 'you', { price: '150' }), pay('you', 'Mara', '10')]);
    expect(counts(instances, you)).toEqual({ copper: 90 });
  });

  it('pays nothing through a pay beside a sale of what the player does not hold', () => {
    const { instances } = settle([], [buy('Iron Sword', 'you', 'Mara'), pay('Mara', 'you', '150')]);
    expect(instances).toEqual([]);
  });

  it.each([
    ['a sale', [instance('s', 'sword', you)], buy('Iron Sword', 'you', 'Mara'), pay('Mara', 'you', '40'), { copper: 40 }],
    ['a purchase', [instance('c', 'copper', you, 200)], buy('Iron Sword', 'Mara', 'you'), pay('you', 'Mara', '40'), { copper: 160, sword: 1 }],
    ['a blank side', [instance('c', 'copper', you, 200)], buy('Iron Sword', 'Mara', 'you'), pay('you', '', '40'), { copper: 160, sword: 1 }],
  ])('reads a pay beside an unpriced buy as its price, on %s (Q71)', (_shape, start, bought, paid, want) => {
    for (const ops of [[bought, paid], [paid, bought]]) {
      const { instances, diagnostics } = settle(start, ops);
      expect(counts(instances, you)).toEqual(want);
      expect(diagnostics).toEqual([expect.stringContaining('the same sum')]);
    }
  });

  it("doesn't read a pay in another Currency as an unpriced buy's price", () => {
    const { instances } = settle([instance('c', 'copper', you, 200), instance('h', 'shell', you, 40)], [buy('Iron Sword', 'Mara', 'you'), pay('you', 'Mara', '40 Shell')]);
    expect(counts(instances, you)).toEqual({ copper: 50, sword: 1 });
  });

  it("doesn't read a pay between two others as an unpriced buy's price", () => {
    const owners = [{ id: 'mara', name: 'Mara' }, { id: 'reeve', name: 'Reeve' }, { id: 'clerk', name: 'Clerk' }];
    const { instances } = settle([instance('c', 'copper', you, 200)], [buy('Iron Sword', 'Mara', 'you'), pay('Reeve', 'Clerk', '40')], { owners });
    expect(counts(instances, you)).toEqual({ copper: 50, sword: 1 });
  });

  it("compares the pay against the buy's whole total", () => {
    const start = [instance('c', 'copper', you, 20)];
    const whole = settle(start, [buy('Dagger', 'Mara', 'you', { quantity: 3 }), pay('you', 'Mara', '15')]);
    expect(counts(whole.instances, you)).toEqual({ copper: 5, dagger: 3 });
    const each = settle(start, [buy('Dagger', 'Mara', 'you', { quantity: 3, price: '15' }), pay('you', 'Mara', '5')]);
    expect(counts(each.instances, you)).toEqual({ dagger: 3 });
  });

  it("drops every pay of the buy's sum, so a repeated pay charges once", () => {
    const { instances, diagnostics } = settle([purse], [buy('Iron Sword', 'Mara', 'you'), pay('you', 'Mara', '150'), pay('you', 'Mara', '150')]);
    expect(counts(instances, you)).toEqual({ gold: 3, copper: 50, sword: 1 });
    expect(diagnostics.filter((line) => line.includes('the same sum'))).toHaveLength(2);
  });

  it('keeps the first pay as the price, and settles a later pay of another sum', () => {
    const { instances } = settle([instance('c', 'copper', you, 200)], [buy('Iron Sword', 'Mara', 'you'), pay('you', 'Mara', '40'), pay('you', 'Mara', '5')]);
    expect(counts(instances, you)).toEqual({ copper: 155, sword: 1 });
  });

  it('charges once when a repeated pay states an unpriced buy its price', () => {
    const { instances } = settle([instance('c', 'copper', you, 200)], [buy('Iron Sword', 'Mara', 'you'), pay('you', 'Mara', '40'), pay('you', 'Mara', '40')]);
    expect(counts(instances, you)).toEqual({ copper: 160, sword: 1 });
  });

  it.each([
    ['an authored item with no Currency', 'Rope', { rope: 1 }],
    ['an authored item with a Value and no Currency', 'Relic', { relic: 1 }],
  ])('reads a pay as the price of %s, in the pay\'s Currency (Q71)', (_case, name, bought) => {
    const { instances } = settle([instance('c', 'copper', you, 200)], [buy(name, 'Mara', 'you'), pay('you', 'Mara', '30 Copper')]);
    expect(counts(instances, you)).toEqual({ copper: 170, ...bought });
  });

  it('moves money and an unauthored item as one when a pay states the price (Q71)', () => {
    const { instances, runtimeItems } = settle([instance('c', 'copper', you, 200)], [buy('Meat Pie', 'Mara', 'you'), pay('you', 'Mara', '3 Copper')]);
    expect(runtimeItems.map((r) => r.name)).toEqual(['Meat Pie']);
    expect(counts(instances, you).copper).toBe(197);
    expect(instances.filter((c) => c.item.kind === 'runtime' && c.where.kind === 'you')).toHaveLength(1);
  });

  it("doesn't read a pay between two others as the price of an item with no Currency", () => {
    const owners = [{ id: 'mara', name: 'Mara' }, { id: 'reeve', name: 'Reeve' }, { id: 'clerk', name: 'Clerk' }];
    const start = [instance('c', 'copper', you, 200), instance('r', 'rope', mara)];
    const { instances } = settle(start, [buy('Rope', 'Mara', 'you'), pay('Reeve', 'Clerk', '30')], { owners });
    expect(counts(instances, you)).toEqual({ copper: 200 });
  });

  it('counts a buy repeated word for word once, and two different buys twice', () => {
    const one = settle([purse], [buy('Iron Sword', 'Mara', 'you'), buy('iron sword', 'mara', 'you')]);
    expect(counts(one.instances, you)).toEqual({ gold: 3, copper: 50, sword: 1 });
    expect(one.diagnostics).toEqual([expect.stringContaining('repeats it')]);
    const two = settle([instance('c', 'copper', you, 50)], [buy('Dagger', 'Mara', 'you'), buy('Dagger', 'Mara', 'you', { quantity: 2 })]);
    expect(counts(two.instances, you)).toEqual({ copper: 35, dagger: 3 });
  });

  it('lands pays first, then buys in reply order, so a sale can fund a later buy and not an earlier one', () => {
    const broke = [instance('s', 'sword', you)];
    const funded = settle(broke, [buy('Iron Sword', 'you', 'Mara'), buy('Dagger', 'Mara', 'you')]);
    expect(counts(funded.instances, you)).toEqual({ gold: 1, copper: 45, dagger: 1 });
    const early = settle(broke, [buy('Dagger', 'Mara', 'you'), buy('Iron Sword', 'you', 'Mara')]);
    expect(counts(early.instances, you)).toEqual({ gold: 1, copper: 50 });
    // The pay stands later in the reply and still spends first, so the buy can't afford the rest.
    const paidFirst = settle([instance('c', 'copper', you, 5)], [buy('Dagger', 'Mara', 'you', { price: '5' }), pay('you', '', '3')]);
    expect(counts(paidFirst.instances, you)).toEqual({ copper: 2 });
  });
});
