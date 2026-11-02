import { describe, expect, it } from 'vitest';
import type { SlotOwner } from '@/lib/bodies';
import { applyInventoryOps } from '@/lib/inventory';
import type { Currency, Item, ItemCopy, ItemCopyWhere, Placement, PlayerStat } from '@/types';
import { applyPaymentStats, balanceOf, backingStatIds, currenciesSettle, planPayment, readStatedPrice, type PaymentStat, type PaymentState } from './currency';

const item = (id: string, name: string): Item => ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], stackable: true });
const items = [item('copper', 'Copper'), item('silver', 'Silver Coin'), item('gold', 'Gold'), item('shell', 'Shell')];
const MONEY: Currency = {
  id: 'coin', name: 'Coin',
  backing: { kind: 'items', items: [{ itemId: 'copper', worth: 1 }, { itemId: 'silver', worth: 10 }, { itemId: 'gold', worth: 100 }] },
};
const SHELLS: Currency = { id: 'shells', name: 'Shells', backing: { kind: 'items', items: [{ itemId: 'shell', worth: 1 }] } };
const CREDITS: Currency = { id: 'credits', name: 'Credits', backing: { kind: 'stat', statId: 'funds' } };
const GOATS: Currency = { id: 'goats', name: 'Goats', backing: { kind: 'name' } };

const you = { kind: 'you' } as const;
const mara = { kind: 'entity', id: 'mara' } as const;
const stranger = { kind: 'entity', id: 'stranger' } as const;

const heldCopy = (itemId: string, where: ItemCopyWhere, quantity: number, over: Partial<ItemCopy> = {}): ItemCopy =>
  ({ id: `${itemId}-${where.kind === 'entity' ? where.id : where.kind}${over.visibility ?? ''}`, item: { kind: 'item', itemId }, where, quantity, visibility: 'visible', ...over });
const placedOnMara: Placement[] = [{ id: 'p', source: { kind: 'item', itemId: 'copper' }, where: mara, quantity: 1 }];

const state = (copies: ItemCopy[], over: Partial<PaymentState> = {}): PaymentState =>
  ({ copies, placements: placedOnMara, globalStats: [], statsOf: () => [], ...over });

/** The item counts each owner holds once the plan's ops run through the real validator. */
function settle(copies: ItemCopy[], payer: SlotOwner | null, payee: SlotOwner | null, amount: number, currency = MONEY) {
  const plan = planPayment(currency, payer, payee, amount, state(copies), items);
  if (!plan.settled) throw new Error(plan.reason);
  let next = 0;
  const { copies: after, diagnostics, events } = applyInventoryOps(copies, plan.ops, { world: { items }, source: 'pass', newId: () => `new${next++}` });
  expect(diagnostics).toEqual([]);
  const count = (where: SlotOwner) => Object.fromEntries(after
    .filter((c) => c.where.kind === where.kind && (where.kind === 'you' || (c.where.kind === 'entity' && c.where.id === where.id)))
    .map((c) => [c.item.kind === 'item' ? c.item.itemId : '', c.quantity]));
  return { you: count(you), mara: count(mara), plan, events };
}

describe('planPayment with Currency Items', () => {
  it('pays exact items and moves them to a tracked payee', () => {
    const { you: mine, mara: hers } = settle([heldCopy('copper', you, 5)], you, mara, 5);
    expect(mine).toEqual({});
    expect(hers).toEqual({ copper: 5 });
  });

  it('spends the smallest items first', () => {
    const { you: mine, mara: hers } = settle([heldCopy('copper', you, 3), heldCopy('silver', you, 2), heldCopy('gold', you, 1)], you, mara, 13);
    expect(mine).toEqual({ silver: 1, gold: 1 });
    expect(hers).toEqual({ copper: 3, silver: 1 });
  });

  it('returns change in the fewest items, created when the payee lacks it, and the payee keeps only the amount', () => {
    const { you: mine, mara: hers } = settle([heldCopy('gold', you, 1)], you, mara, 5);
    // 95 back reads 9 Silver, 5 Copper, never 95 Copper.
    expect(mine).toEqual({ silver: 9, copper: 5 });
    expect(hers).toEqual({ copper: 5 });
  });

  it('draws change from what a tracked payee holds, and the payee ends up by the amount', () => {
    const { you: mine, mara: hers } = settle([heldCopy('silver', you, 1), heldCopy('copper', mara, 2)], you, mara, 5);
    expect(mine).toEqual({ copper: 5 });
    expect(hers).toEqual({ copper: 7 });
  });

  describe('value between tracked parties (Q54)', () => {
    const worth = { copper: 1, silver: 10, gold: 100 };
    const value = (held: Record<string, number>) => Object.entries(held).reduce((sum, [id, n]) => sum + worth[id as keyof typeof worth] * n, 0);
    const purses: [string, ItemCopy[], ItemCopy[], number][] = [
      ['one big item against an empty purse', [heldCopy('gold', you, 1)], [], 5],
      ['two big items and a remainder', [heldCopy('gold', you, 2)], [], 150],
      ['a payee with part of the change', [heldCopy('silver', you, 1)], [heldCopy('copper', mara, 2)], 5],
      ['a payee with all the change', [heldCopy('gold', you, 1)], [heldCopy('silver', mara, 9), heldCopy('copper', mara, 5)], 5],
      ['a payee with the wrong items', [heldCopy('gold', you, 1)], [heldCopy('gold', mara, 3)], 5],
      ['mixed items and overpay', [heldCopy('copper', you, 3), heldCopy('silver', you, 1), heldCopy('gold', you, 1)], [heldCopy('silver', mara, 1)], 17],
      ['exact items', [heldCopy('copper', you, 5)], [], 5],
    ];
    it.each(purses)('moves exactly the amount, you to Mara: %s', (_shape, mine, hers, amount) => {
      const after = settle([...mine, ...hers], you, mara, amount);
      const before = { you: value(Object.fromEntries(mine.map((c) => [(c.item as { itemId: string }).itemId, c.quantity]))), mara: value(Object.fromEntries(hers.map((c) => [(c.item as { itemId: string }).itemId, c.quantity]))) };
      expect(value(after.you)).toBe(before.you - amount);
      expect(value(after.mara)).toBe(before.mara + amount);
    });
    it.each(purses)('moves exactly the amount, Mara to you: %s', (_shape, mine, hers, amount) => {
      const swap = (c: ItemCopy, where: ItemCopyWhere) => heldCopy((c.item as { itemId: string }).itemId, where, c.quantity);
      const hersNow = mine.map((c) => swap(c, mara));
      const minesNow = hers.map((c) => swap(c, you));
      const after = settle([...hersNow, ...minesNow], mara, you, amount);
      const total = (list: ItemCopy[]) => value(Object.fromEntries(list.map((c) => [(c.item as { itemId: string }).itemId, c.quantity])));
      expect(value(after.mara)).toBe(total(hersNow) - amount);
      expect(value(after.you)).toBe(total(minesNow) + amount);
    });
    it('still creates and destroys money with an untracked party', () => {
      expect(settle([heldCopy('gold', you, 1)], you, stranger, 5).you).toEqual({ silver: 9, copper: 5 });
      expect(settle([], stranger, you, 5).you).toEqual({ copper: 5 });
    });
  });

  it('finds the fewest items when the largest-first answer is not the fewest', () => {
    const odd: Currency = { id: 'odd', name: 'Odd', backing: { kind: 'items', items: [{ itemId: 'copper', worth: 1 }, { itemId: 'silver', worth: 3 }, { itemId: 'gold', worth: 4 }] } };
    const plan = planPayment(odd, null, you, 6, state([]), items);
    expect(plan).toEqual({ settled: true, stats: [], ops: [{ kind: 'gain', itemId: 'silver', quantity: 2, to: you }] });
  });

  it('refuses a payer who is short, with no op', () => {
    expect(planPayment(MONEY, you, mara, 6, state([heldCopy('copper', you, 5)]), items).settled).toBe(false);
  });

  it('does not count hidden or unidentified items, so they cannot pay (Q18)', () => {
    const hidden = heldCopy('copper', you, 5, { visibility: 'hidden' });
    const veiled = heldCopy('silver', you, 1, { state: { unidentified: true } });
    expect(planPayment(MONEY, you, mara, 1, state([hidden, veiled]), items).settled).toBe(false);
  });

  it('spends around a hidden smaller item, which stays put', () => {
    const hidden = heldCopy('copper', you, 5, { visibility: 'hidden' });
    const plan = planPayment(MONEY, you, null, 5, state([hidden, heldCopy('silver', you, 1)]), items);
    expect(plan).toEqual({
      settled: true, stats: [],
      ops: expect.arrayContaining([{ kind: 'lose', copyId: 'silver-you', quantity: 1 }, { kind: 'gain', itemId: 'copper', quantity: 5, to: you }]),
    });
    expect(plan.settled && plan.ops).toHaveLength(2);
  });

  it('lets the player spend a Bound item, because Bound stops the panel only', () => {
    const { you: mine } = settle([heldCopy('copper', you, 2, { id: 'bound' })], you, null, 2);
    expect(mine).toEqual({});
  });

  it('runs an item move as an ordinary op, so the item fires its item events', () => {
    const { events } = settle([heldCopy('copper', you, 2)], you, mara, 1);
    expect(events.map((event) => [event.timing, event.itemId])).toContainEqual(['lost', 'copper']);
  });

  it('removes items paid to an untracked entity, and leaves none on it', () => {
    const { plan } = settle([heldCopy('copper', you, 2)], you, stranger, 2);
    expect(plan).toMatchObject({ ops: [{ kind: 'lose', quantity: 2 }] });
  });

  it('removes money that leaves the world', () => {
    expect(settle([heldCopy('copper', you, 2)], you, null, 2).you).toEqual({});
  });

  it('creates what an untracked entity pays, and income in the fewest items', () => {
    expect(settle([], stranger, you, 112).you).toEqual({ gold: 1, silver: 1, copper: 2 });
    expect(settle([], null, you, 112).you).toEqual({ gold: 1, silver: 1, copper: 2 });
  });

  it('moves nothing between two untracked entities', () => {
    expect(planPayment(MONEY, stranger, null, 5, state([]), items)).toEqual({ settled: true, ops: [], stats: [] });
  });

  it('refuses an amount the items cannot make', () => {
    const tens: Currency = { id: 't', name: 'T', backing: { kind: 'items', items: [{ itemId: 'silver', worth: 10 }] } };
    expect(planPayment(tens, null, you, 5, state([]), items).settled).toBe(false);
    expect(planPayment(tens, you, null, 5, state([heldCopy('silver', you, 1)]), items).settled).toBe(false);
  });

  it('refuses no parties, and one owner on both sides', () => {
    expect(planPayment(MONEY, null, null, 1, state([]), items).settled).toBe(false);
    expect(planPayment(MONEY, you, you, 1, state([heldCopy('copper', you, 1)]), items).settled).toBe(false);
  });
});

const funds = (value: number, over: Partial<PaymentStat> = {}): PaymentStat => ({ id: 'funds', value, min: 0, max: 1000, noIncrease: false, noDecrease: false, ...over });

describe('planPayment with a stat', () => {
  const owned = (mine: PaymentStat | null, hers: PaymentStat | null = null) =>
    state([], { statsOf: (owner) => { const stat = owner.kind === 'you' ? mine : hers; return stat ? [stat] : []; } });

  it('moves the amount between two owners that have the stat', () => {
    expect(planPayment(CREDITS, you, mara, 30, owned(funds(50), funds(5)), items)).toEqual({
      settled: true, ops: [], stats: [{ owner: you, statId: 'funds', delta: -30 }, { owner: mara, statId: 'funds', delta: 30 }],
    });
  });

  it('refuses a payer who is short, and one the floor stops (Q52)', () => {
    expect(planPayment(CREDITS, you, null, 51, owned(funds(50)), items).settled).toBe(false);
    expect(planPayment(CREDITS, you, null, 45, owned(funds(50, { min: 10 })), items).settled).toBe(false);
    expect(planPayment(CREDITS, you, null, 40, owned(funds(50, { min: 10 })), items).settled).toBe(true);
  });

  it('refuses a No Decrease payer and a No Increase payee (Q29)', () => {
    expect(planPayment(CREDITS, you, null, 1, owned(funds(50, { noDecrease: true })), items).settled).toBe(false);
    expect(planPayment(CREDITS, you, mara, 1, owned(funds(50), funds(5, { noIncrease: true })), items).settled).toBe(false);
    expect(planPayment(CREDITS, null, you, 1, owned(funds(50, { noIncrease: true })), items).settled).toBe(false);
  });

  it('charges the payer in full when the payee is at its max', () => {
    expect(planPayment(CREDITS, you, mara, 30, owned(funds(50), funds(990, { max: 1000 })), items)).toMatchObject({
      stats: [{ owner: you, delta: -30 }, { owner: mara, delta: 10 }],
    });
  });

  it('lowers the payer alone for an untracked payee, and raises the payee alone for an untracked payer', () => {
    expect(planPayment(CREDITS, you, stranger, 30, owned(funds(50)), items)).toMatchObject({ stats: [{ owner: you, delta: -30 }] });
    expect(planPayment(CREDITS, stranger, you, 30, owned(funds(50)), items)).toMatchObject({ stats: [{ owner: you, delta: 30 }] });
  });

  it('treats a Global Stat as one wallet: paying an entity adds to no one (Q21)', () => {
    const wallet = state([], { globalStats: [funds(50)], statsOf: () => [funds(5)] });
    expect(planPayment(CREDITS, you, mara, 30, wallet, items)).toEqual({ settled: true, ops: [], stats: [{ owner: null, statId: 'funds', delta: -30 }] });
    expect(planPayment(CREDITS, mara, you, 30, wallet, items)).toEqual({ settled: true, ops: [], stats: [{ owner: null, statId: 'funds', delta: 30 }] });
  });

  it('refuses an untracked player on either side (Q48, Q53)', () => {
    expect(planPayment(CREDITS, you, null, 1, owned(null), items).settled).toBe(false);
    expect(planPayment(CREDITS, null, you, 1, owned(null), items).settled).toBe(false);
  });
});

describe('planPayment with a name-only Currency', () => {
  it('settles nothing, whoever pays', () => {
    expect(planPayment(GOATS, you, mara, 3, state([]), items)).toEqual({ settled: true, ops: [], stats: [] });
  });
});

describe('applyPaymentStats', () => {
  const stat = (value: number): PlayerStat => ({ id: 'funds', name: 'Funds', type: 'number', description: '', value, min: 0, max: 100, regen: 0, descriptors: [] });

  it('writes the player through the played entity that holds the stat', () => {
    const before = { globalStats: [], entityStats: { other: [], hero: [stat(9)], mara: [stat(1)] } };
    const after = applyPaymentStats(before, [{ owner: you, statId: 'funds', delta: -4 }, { owner: mara, statId: 'funds', delta: 4 }], () => 'hero');
    expect(after.entityStats.hero[0].value).toBe(5);
    expect(after.entityStats.mara[0].value).toBe(5);
  });

  it('writes a Global Stat, and keeps every reference with no change', () => {
    const before = { globalStats: [stat(9)], entityStats: {} };
    expect(applyPaymentStats(before, [{ owner: null, statId: 'funds', delta: 1 }], () => undefined).globalStats[0].value).toBe(10);
    const same = applyPaymentStats(before, [], () => undefined);
    expect(same.globalStats).toBe(before.globalStats);
    expect(same.entityStats).toBe(before.entityStats);
  });
});

describe('readStatedPrice', () => {
  const currencies = [CREDITS, MONEY, SHELLS];
  const read = (price: string, named = '', list: readonly Currency[] = currencies) => readStatedPrice(price, named, list, items);

  it('reads the Breakdown form, loose on case, plurals and a trailing "coin"', () => {
    expect(read('3 Gold, 5 Copper')).toEqual({ currency: MONEY, amount: 305 });
    expect(read('2 gold coins and 1 silver')).toEqual({ currency: MONEY, amount: 210 });
    expect(read('7 coppers')).toEqual({ currency: MONEY, amount: 7 });
  });

  it('reads an amount in plain words', () => {
    expect(read('nine silver')).toEqual({ currency: MONEY, amount: 90 });
    expect(read('Twenty-five Copper')).toEqual({ currency: MONEY, amount: 25 });
    expect(read('a Gold and two hundred copper')).toEqual({ currency: MONEY, amount: 300 });
    expect(read('Fifteen credits')).toEqual({ currency: CREDITS, amount: 15 });
  });

  it('gives a lone money word the count it is handed, and asks for a number without one', () => {
    expect(readStatedPrice('Silver', '', currencies, items, 3)).toEqual({ currency: MONEY, amount: 30 });
    expect(read('Silver')).toHaveProperty('refused');
    expect(readStatedPrice('Gold, Silver', '', currencies, items, 3)).toHaveProperty('refused');
  });

  it('reads a bare number in the Default, or in the Currency named', () => {
    expect(read('40')).toEqual({ currency: CREDITS, amount: 40 });
    expect(read('40', 'Coin')).toEqual({ currency: MONEY, amount: 40 });
  });

  it('counts the item `currency` names, and an item name beats a Currency of that name', () => {
    expect(read('5', 'Gold')).toEqual({ currency: MONEY, amount: 500 });
    const gold: Currency = { id: 'gold-currency', name: 'Gold', backing: { kind: 'stat', statId: 'g' } };
    expect(read('5', 'Gold', [gold, MONEY])).toEqual({ currency: MONEY, amount: 500 });
  });

  it('reads a Currency name in the price', () => {
    expect(read('1,000 credits')).toEqual({ currency: CREDITS, amount: 1000 });
  });

  it('refuses a price drawing on two Currencies, or an item that conflicts with the Currency named (Q26)', () => {
    expect(read('1 Gold, 1 Shell')).toHaveProperty('refused');
    expect(read('1 Gold', 'Credits')).toHaveProperty('refused');
    expect(read('1 Shell', 'Coin')).toHaveProperty('refused');
  });

  it('refuses an unknown Currency, and never falls to the Default', () => {
    expect(read('5', 'Marks')).toHaveProperty('refused');
    expect(read('5 Marks')).toHaveProperty('refused');
  });

  it('refuses no price, no Currency, a bare part among items, a zero and a fraction of the base item', () => {
    expect(read('')).toHaveProperty('refused');
    expect(read('some coins')).toHaveProperty('refused');
    expect(read('5', '', [])).toHaveProperty('refused');
    expect(read('1 Gold, 5')).toHaveProperty('refused');
    expect(read('0 Gold')).toHaveProperty('refused');
    expect(read('0.5 Copper')).toHaveProperty('refused');
  });
});

describe('the Inventory pass and the stat pass read the same money', () => {
  it('lists only stat backings', () => {
    expect([...backingStatIds([CREDITS, MONEY, GOATS])]).toEqual(['funds']);
  });

  it('settles for stat and item backings only (Q55)', () => {
    expect(currenciesSettle([GOATS])).toBe(false);
    expect(currenciesSettle([])).toBe(false);
    expect(currenciesSettle([GOATS, MONEY])).toBe(true);
    expect(currenciesSettle([CREDITS])).toBe(true);
  });

  it('agrees with Balance on what the plan can spend', () => {
    const copies = [heldCopy('copper', you, 5), heldCopy('gold', you, 1, { visibility: 'hidden' })];
    const balance = balanceOf(MONEY, you, state(copies));
    expect(balance).toEqual({ tracked: true, amount: 5 });
    expect(planPayment(MONEY, you, null, 5, state(copies), items).settled).toBe(true);
    expect(planPayment(MONEY, you, null, 6, state(copies), items).settled).toBe(false);
  });
});
