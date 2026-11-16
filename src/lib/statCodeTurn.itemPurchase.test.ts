/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { statCodeTurnOf } from '@/test/statCodeTurnFixture';
import { applyInventoryPass, type ItemScriptEvent, type PassMoney, type PassScene } from './inventory';
import { inPlayOwners } from './ownedTraitsInPlay';
import { withPersonaEntry } from './persona';
import { runItemScripts, stateInventory } from './statCodeTurn';
import { BUILT_IN_TEMPLATES, defaultSlotValues, fillTemplate, parseTemplateSlots } from './statCodeTemplates';
import type { Currency, Entity, InventoryPassOp, Item, ItemInstance, ItemScriptTiming, PersonaRef, PlayerStat } from '@/types';

const tally = (id: string, name: string): PlayerStat => ({
  id, name, type: 'number', description: '', min: 0, max: 1e9, value: 0, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 1e9, baseRegen: 0, aiMaxDelta: 0,
});
const keeper: Entity = { id: 'e-keeper', name: 'Keeper', traits: [] };
const wren: Entity = { id: 'e-wren', name: 'Wren', traits: [] };
const ash: Entity = { id: 'e-ash', name: 'Ash', persona: true, traits: [] };
const cast = [keeper, wren, ash];
const asAsh: PersonaRef = { source: 'world', entityId: 'e-ash' };
const you = { kind: 'you' } as const;
const keeperAt = { kind: 'entity', id: 'e-keeper' } as const;
const vault = { kind: 'location', id: 'loc-vault' } as const;

const COIN: Currency = { id: 'coin', name: 'Coin', backing: { kind: 'items', items: [{ itemId: 'i-copper', worth: 1 }] } };
const copper: Item = { id: 'i-copper', name: 'Copper', stackable: true, statEffects: [], traitEffects: [], equipRequires: [] };

// Gained writes its own stat and Lost its own: the purchase in the thousands, the side in the ones.
const CODE = `
  const side = (v) => v === persona ? 1 : v === entities.Keeper ? 2 : v === locations.Vault ? 3 : v === null ? 4 : 9;
  const buy = (p) => p === null ? 0 : p === undefined ? 8000 : p.price === null && p.currency === null ? 1000 : p.currency === 'Coin' ? 2000 + p.price * 10 : 9000;
`;
const RECORD: Partial<Record<ItemScriptTiming, string>> = {
  gained: `${CODE} stats.Gained.value += buy(args.purchase) + side(args.from);`,
  lost: `${CODE} stats.Lost.value += buy(args.purchase) + side(args.to);`,
};
const gem: Item = {
  id: 'i-gem', name: 'Gem', stackable: false, value: 5, currencyId: 'coin', statEffects: [], traitEffects: [], equipRequires: [],
  scripts: (['gained', 'lost'] as const).map((timing, i) => ({ id: `gem-${i}`, timing, code: RECORD[timing] ?? '' })),
};
const ITEMS = [gem, copper];

const instance = (id: string, itemId: string, where: ItemInstance['where'], quantity = 1): ItemInstance =>
  ({ id, item: { kind: 'item', itemId }, where, quantity, visibility: 'visible' });
const buy = (owner: string, to: string, over: Partial<InventoryPassOp> = {}): InventoryPassOp =>
  ({ op: 'buy', item: 'Gem', quantity: 1, owner, to, ...over });

const money: PassMoney = { currencies: [COIN], placements: [], stats: { globalStats: [], entityStats: {} }, playedIds: ['e-ash'], statsOn: (_owner, stats) => stats };
const scene = (over: Partial<PassScene> = {}): PassScene => ({
  items: ITEMS, runtimeItems: [], playerNames: ['Ash'], owners: [{ id: 'e-keeper', name: 'Keeper' }, { id: 'e-wren', name: 'Wren' }], location: { id: 'loc-vault', name: 'Vault' },
  resolve: (text) => text, money, ...over,
});

let ids = 0;
const pass = (start: ItemInstance[], ops: InventoryPassOp[], over: Partial<PassScene> = {}, items: Item[] = ITEMS) => {
  const landed = applyInventoryPass(start, ops, scene({ items, ...over }), { world: { items }, newId: () => `new-${(ids += 1)}` });
  expect(landed.diagnostics).toEqual([]);
  return landed;
};

type Landed = { instances: readonly ItemInstance[]; events: readonly ItemScriptEvent[] };

/** Runs the item scripts of `landed`'s events, with Keeper holding `keeperStats`. */
async function runOn(landed: Landed, items: Item[], stats: PlayerStat[], keeperStats: PlayerStat[] = []) {
  const entered = [...withPersonaEntry(cast, asAsh, undefined)];
  const turn = statCodeTurnOf({
    stats, enabled: {}, previous: stats, asks: [], regenApplied: {}, clock: {},
    ownerTraits: {
      acquired: [], disabledTraitIds: [], appliedValues: {}, ownedTraits: {}, entities: cast, library: [],
      world: { traits: [], groups: [], entities: entered, persona: asAsh, ...inPlayOwners({ traits: [], traitGroups: [], entities: entered }, asAsh, []) },
    },
    ...(keeperStats.length && { owners: [{ id: 'e-keeper', stats: keeperStats, enabled: {}, previous: keeperStats, regenApplied: {} }] }),
    places: { locations: [{ id: 'loc-vault', name: 'Vault' }], location: { id: 'loc-vault', name: 'Vault' } },
    items, itemInstances: landed.instances, statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
  });
  const out = await runItemScripts(turn, landed.events, stateInventory({ items }));
  expect(out.diagnostics).toEqual([]);
  return out;
}

/** Runs the item scripts of `landed`'s events, and reads what Gained and Lost recorded. */
async function recorded(landed: Landed, items: Item[] = ITEMS) {
  const out = await runOn(landed, items, [tally('gained', 'Gained'), tally('lost', 'Lost')]);
  const read = (id: string) => out.result?.stats.find((s) => s.id === id)?.value ?? 0;
  return { gained: read('gained'), lost: read('lost') };
}

describe('args.purchase on an Inventory pass buy', () => {
  beforeEach(() => {
    ids = 0;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('reads a priced buy on both sides: price in the base unit and the Currency name', async () => {
    const landed = pass([instance('c-gem', 'i-gem', keeperAt), instance('c-cu', 'i-copper', you, 20)], [buy('Keeper', 'Ash', { price: '7 Copper' })]);
    expect(await recorded(landed)).toEqual({ gained: 2070 + 2, lost: 2070 + 1 });
  });

  it('reads an Item Value buy as priced', async () => {
    const landed = pass([instance('c-gem', 'i-gem', keeperAt), instance('c-cu', 'i-copper', you, 20)], [buy('Keeper', 'Ash')]);
    expect(await recorded(landed)).toEqual({ gained: 2050 + 2, lost: 2050 + 1 });
  });

  it('reads an unpriced buy on both sides with a null price and Currency', async () => {
    const landed = pass([instance('c-gem', 'i-gem', keeperAt)], [buy('Keeper', 'Ash')], { money: undefined });
    expect(await recorded(landed)).toEqual({ gained: 1000 + 2, lost: 1000 + 1 });
  });

  it.each([
    ['a Value of 0', { value: 0 }, [COIN]],
    ['a Name Only Currency', { currencyId: 'goats' }, [COIN, { id: 'goats', name: 'Goats', backing: { kind: 'name' } } satisfies Currency]],
  ] as const)('reads a buy that moves no money, through %s, with a null price and Currency', async (_case, over, currencies) => {
    const items = [{ ...gem, ...over }, copper];
    const landed = pass([instance('c-gem', 'i-gem', keeperAt), instance('c-cu', 'i-copper', you, 20)], [buy('Keeper', 'Ash')],
      { money: { ...money, currencies } }, items);
    expect(landed.instances.find((i) => i.id === 'c-cu')?.quantity).toBe(20);
    expect(await recorded(landed, items)).toEqual({ gained: 1000 + 2, lost: 1000 + 1 });
  });

  it('reads a buy of new stock as a purchase from nowhere', async () => {
    const landed = pass([instance('c-cu', 'i-copper', you, 20)], [buy('Keeper', 'Ash')]);
    expect(await recorded(landed)).toEqual({ gained: 2050 + 4, lost: 0 });
  });

  it('reads a buy from location stock as from the location, with the purchase', async () => {
    const landed = pass([instance('c-gem', 'i-gem', vault), instance('c-cu', 'i-copper', you, 20)], [buy('Keeper', 'Ash')]);
    expect(await recorded(landed)).toEqual({ gained: 2050 + 3, lost: 2050 + 1 });
  });

  it('reads a sale by the player as from persona, with the purchase', async () => {
    const landed = pass([instance('c-gem', 'i-gem', you), instance('c-cu', 'i-copper', keeperAt, 20)], [buy('Ash', 'Keeper')]);
    expect(await recorded(landed)).toEqual({ gained: 2050 + 1, lost: 2050 + 2 });
  });

  it('reads null on a pass transfer and gain that is no buy', async () => {
    const landed = pass([instance('c-gem', 'i-gem', you)], [
      { op: 'transfer', item: 'Gem', quantity: 1, owner: 'Ash', to: 'Keeper' },
      { op: 'gain', item: 'Gem', quantity: 1, owner: '', to: 'Ash' },
    ]);
    expect(await recorded(landed)).toEqual({ gained: 1 + 4, lost: 2 });
  });
});

describe('the Gift Raises a Stat template', () => {
  beforeEach(() => {
    ids = 0;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const template = BUILT_IN_TEMPLATES.find((t) => t.id === 'builtin-item-gift-raises-stat');
  const filled = fillTemplate(template?.code ?? '', defaultSlotValues(parseTemplateSlots(template?.code ?? '', 'itemScript').slots));
  const ring: Item = { ...gem, id: 'i-ring', name: 'Ring', scripts: [{ id: 'ring-0', timing: 'gained', code: filled }] };
  // A box whose own gain moves the player's Ring to Keeper: a script's move.
  const box: Item = {
    id: 'i-box', name: 'Gift Box', stackable: false, statEffects: [], traitEffects: [], equipRequires: [],
    scripts: [{ id: 'box-0', timing: 'gained', code: "items.Ring.instances.find((i) => i.owner === 'Ash').moveTo(entities.Keeper);" }],
  };
  const items = [ring, box, copper];
  const affectionAfter = async (start: ItemInstance[], ops: InventoryPassOp[]) => {
    const out = await runOn(pass(start, ops, {}, items), items, [], [tally('affection', 'Affection')]);
    return out.result?.owners?.['e-keeper']?.stats.find((s) => s.id === 'affection')?.value ?? 0;
  };
  const wrenAt = { kind: 'entity', id: 'e-wren' } as const;
  const hand = (owner: string, to: string): InventoryPassOp => ({ op: 'transfer', item: 'Ring', quantity: 1, owner, to });

  it('raises the receiver’s stat for the player’s gift', async () => {
    expect(await affectionAfter([instance('c-ring', 'i-ring', you)], [hand('Ash', 'Keeper')])).toBe(1);
  });

  it('raises nothing for a shop buy', async () => {
    const start = [instance('c-ring', 'i-ring', vault), instance('c-cu', 'i-copper', keeperAt, 20)];
    expect(await affectionAfter(start, [{ op: 'buy', item: 'Ring', quantity: 1, owner: 'Vault', to: 'Keeper' }])).toBe(0);
  });

  it('raises nothing for a sale by the player', async () => {
    const start = [instance('c-ring', 'i-ring', you), instance('c-cu', 'i-copper', keeperAt, 20)];
    expect(await affectionAfter(start, [{ op: 'buy', item: 'Ring', quantity: 1, owner: 'Ash', to: 'Keeper' }])).toBe(0);
  });

  it('raises nothing for a cast-to-cast transfer', async () => {
    expect(await affectionAfter([instance('c-ring', 'i-ring', wrenAt)], [hand('Wren', 'Keeper')])).toBe(0);
  });

  it('raises nothing for a script’s grant of a new item (Q8)', async () => {
    const opener: Item = { ...box, id: 'i-opener', name: 'Gift Crate', scripts: [{ id: 'opener-0', timing: 'gained', code: 'items.Ring.give(entities.Keeper);' }] };
    const out = await runOn(pass([instance('c-crate', 'i-opener', you)], [{ op: 'transfer', item: 'Gift Crate', quantity: 1, owner: 'Ash', to: 'Keeper' }], {}, [...items, opener]),
      [...items, opener], [], [tally('affection', 'Affection')]);
    expect(out.instances.filter((i) => i.item.kind === 'item' && i.item.itemId === 'i-ring')).toHaveLength(1);
    expect(out.result?.owners?.['e-keeper']?.stats.find((s) => s.id === 'affection')?.value ?? 0).toBe(0);
  });

  it('raises nothing for a script’s move of the player’s item', async () => {
    const start = [instance('c-ring', 'i-ring', you), instance('c-box', 'i-box', keeperAt)];
    expect(await affectionAfter(start, [{ op: 'transfer', item: 'Gift Box', quantity: 1, owner: 'Keeper', to: 'Ash' }])).toBe(0);
  });
});
