import { describe, expect, it } from 'vitest';
import { followsResponseSchema } from '@/lib/aiRequest/responseSchema';
import {
  applyInventoryPass, inventoryPassSchema, parseInventoryLines, parseInventoryReply, withoutOrphanCopies, type PassScene,
} from '.';
import type { InventoryPassOp, Item, ItemCopy, RuntimeItem, Slot } from '@/types';

const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const ids = () => { let i = 0; return () => `n${i++}`; };

const hand: Slot = { id: 'hand', name: 'Hand' };
const sword = item('sword', 'Iron Sword', { stackable: false, slotId: 'hand' });
const tonic = item('tonic', 'Tonic', { uses: 1 });
const ring = item('ring', '{Cursed} Ring');
const you = { kind: 'you' } as const;
const mara = { kind: 'entity', id: 'mara' } as const;
const cellar = { kind: 'location', id: 'cellar' } as const;

const copy = (id: string, itemId: string, where: ItemCopy['where'], over: Partial<ItemCopy> = {}): ItemCopy =>
  ({ id, item: { kind: 'item', itemId }, where, quantity: 1, visibility: 'visible', ...over });
const op = (kind: InventoryPassOp['op'], name: string, over: Partial<InventoryPassOp> = {}): InventoryPassOp =>
  ({ op: kind, item: name, quantity: 1, owner: '', to: '', ...over });

const scene = (over: Partial<PassScene> = {}): PassScene => ({
  items: [sword, tonic, ring], runtimeItems: [], playerNames: ['Ash'],
  owners: [{ id: 'mara', name: 'Mara' }], location: { id: 'cellar', name: 'Cellar' },
  resolve: (text) => text.replace('{Cursed}', 'Cursed'), ...over,
});
const run = (copies: ItemCopy[], ops: InventoryPassOp[], over: Partial<PassScene> = {}) =>
  applyInventoryPass(copies, ops, scene(over), { world: { items: [sword, tonic, ring], slots: [hand] }, newId: ids() });

describe('parseInventoryReply', () => {
  it('reads the schema reply, and a reply the schema shapes passes the schema check', () => {
    const raw = JSON.stringify({ operations: [{ op: 'transfer', item: 'Iron Sword', quantity: 1, owner: 'you', to: 'Mara' }] });
    expect(followsResponseSchema(raw, inventoryPassSchema().schema)).toBe(true);
    expect(parseInventoryReply(raw)).toEqual([op('transfer', 'Iron Sword', { owner: 'you', to: 'Mara' })]);
  });

  it('rejects an operation outside the seven in the schema check', () => {
    const raw = JSON.stringify({ operations: [{ op: 'sell', item: 'x', quantity: 1, owner: '', to: '' }] });
    expect(followsResponseSchema(raw, inventoryPassSchema().schema)).toBe(false);
  });

  it('reads the text lines, skipping prose and NONE, with a missing quantity as 1', () => {
    expect(parseInventoryLines('Here are the changes:\n- gain | Rusty Key |  |  | you\nconsume | Tonic | 2 | you |\nNONE'))
      .toEqual([op('gain', 'Rusty Key', { to: 'you' }), op('consume', 'Tonic', { quantity: 2, owner: 'you' })]);
  });

  it('drops an operation on an item named "nothing", which a schema reply writes for a turn with no change', () => {
    const raw = JSON.stringify({ operations: [{ op: 'gain', item: 'Nothing', quantity: 1, owner: 'you', to: 'you' }] });
    expect(parseInventoryReply(raw)).toEqual([]);
  });

  it('falls back to the lines when the reply is not JSON', () => {
    expect(parseInventoryReply('lose | Tonic | 1 | you |')).toEqual([op('lose', 'Tonic', { owner: 'you' })]);
  });
});

describe('applyInventoryPass', () => {
  it('matches an authored item ignoring case and spaces, on its resolved name', () => {
    const result = run([], [op('gain', '  iron sword ', { to: 'you' }), op('gain', 'cursed ring', { to: 'you' })]);
    expect(result.copies.map((c) => c.item)).toEqual([{ kind: 'item', itemId: 'sword' }, { kind: 'item', itemId: 'ring' }]);
    expect(result.runtimeItems).toEqual([]);
  });

  it('makes one runtime item for a name the world lacks, reused the second time, and a plural is its own name', () => {
    const result = run([], [
      op('gain', 'Rusty Key', { to: 'you' }), op('gain', 'rusty key', { to: 'Mara' }), op('gain', 'iron swords', { to: 'you' }),
    ]);
    expect(result.runtimeItems.map((r) => r.name)).toEqual(['Rusty Key', 'iron swords']);
    const [key] = result.runtimeItems;
    expect(result.copies.filter((c) => c.item.kind === 'runtime' && c.item.runtimeItemId === key.id).map((c) => c.where))
      .toEqual([you, mara]);
    expect(result.copies.some((c) => c.item.kind === 'item')).toBe(false);
  });

  it('stacks a runtime item gained twice by one owner', () => {
    const result = run([], [op('gain', 'Rusty Key', { to: 'you' }), op('gain', 'Rusty Key', { to: 'you', quantity: 2 })]);
    expect(result.copies).toHaveLength(1);
    expect(result.copies[0].quantity).toBe(3);
  });

  it('makes no runtime item in a world with no authored items (Q55)', () => {
    const result = applyInventoryPass([], [op('gain', 'Rusty Key', { to: 'you' })], scene({ items: [] }),
      { world: {}, newId: ids() });
    expect(result.copies).toEqual([]);
    expect(result.runtimeItems).toEqual([]);
    expect(result.diagnostics).toEqual(['Inventory (pass) skipped gain "Rusty Key": the world has no item of that name']);
  });

  it('applies each of the seven operations through the validator', () => {
    const start = [
      copy('s', 'sword', you), copy('t', 'tonic', you, { quantity: 3 }), copy('r', 'ring', cellar, { visibility: 'hidden' }),
    ];
    const result = run(start, [
      op('gain', 'Tonic', { to: 'Mara' }),
      op('equip', 'Iron Sword', { owner: 'you' }),
      op('unequip', 'Iron Sword', { owner: 'Ash' }),
      op('consume', 'Tonic', { owner: 'you' }),
      op('lose', 'Tonic', { owner: 'you' }),
      op('reveal', 'Cursed Ring', { owner: 'here' }),
      op('transfer', 'Cursed Ring', { owner: 'Cellar', to: 'you' }),
    ]);
    expect(result.diagnostics).toEqual([]);
    expect(result.doses).toEqual([{ itemId: 'tonic', where: you, hidden: false }]);
    const at = (id: string) => result.copies.filter((c) => c.item.kind === 'item' && c.item.itemId === id)
      .map(({ where, quantity, visibility, equipped }) => ({ where, quantity, visibility, equipped: !!equipped }));
    expect(at('tonic')).toEqual([
      { where: you, quantity: 1, visibility: 'visible', equipped: false },
      { where: mara, quantity: 1, visibility: 'visible', equipped: false },
    ]);
    expect(at('sword')).toEqual([{ where: you, quantity: 1, visibility: 'visible', equipped: false }]);
    expect(at('ring')).toEqual([{ where: you, quantity: 1, visibility: 'visible', equipped: false }]);
  });

  it('skips an invalid operation with a diagnostic and still applies the valid ones (Q22)', () => {
    const result = run([copy('t', 'tonic', you)], [
      op('transfer', 'Tonic', { owner: 'you', to: 'Odette' }),
      op('equip', 'Tonic', { owner: 'you' }),
      op('consume', 'Iron Sword', { owner: 'you' }),
      op('lose', 'Tonic', { owner: 'you' }),
    ]);
    expect(result.diagnostics).toEqual([
      'Inventory (pass) skipped transfer "Tonic": no one present is "Odette"',
      'Inventory (pass) skipped equip: Item Copy t has no slot',
      'Inventory (pass) skipped consume "Iron Sword": none at "you"',
    ]);
    expect(result.copies).toEqual([]);
  });

  it('gives an item to an entity the turn discovered (Q62)', () => {
    const result = run([copy('s', 'sword', you)], [op('transfer', 'Iron Sword', { owner: 'you', to: 'the thief' })], {
      owners: [{ id: 'mara', name: 'Mara' }, { id: 'thief', name: 'The Thief' }],
    });
    expect(result.copies.map((c) => c.where)).toEqual([{ kind: 'entity', id: 'thief' }]);
  });

  it('never touches an owner who is not present', () => {
    const result = run([copy('s', 'sword', { kind: 'entity', id: 'odette' })], [op('lose', 'Iron Sword', { owner: 'Odette' })]);
    expect(result.copies).toHaveLength(1);
    expect(result.diagnostics).toEqual(['Inventory (pass) skipped lose "Iron Sword": no one present is "Odette"']);
  });

  it('moves an item lying here when a gain names it, instead of making a second one', () => {
    const result = run([copy('t', 'tonic', cellar, { quantity: 2 })], [op('gain', 'Tonic', { to: 'you' })]);
    expect(result.copies.map(({ where, quantity }) => ({ where, quantity }))).toEqual([
      { where: cellar, quantity: 1 }, { where: you, quantity: 1 },
    ]);
  });

  it('finds and moves a hidden item lying here when a gain names it', () => {
    const result = run([copy('h', 'tonic', cellar, { visibility: 'hidden', quantity: 2 })], [op('gain', 'Tonic', { to: 'you' })]);
    expect(result.diagnostics).toEqual([]);
    expect(result.copies.map(({ where, quantity, visibility }) => ({ where, quantity, visibility }))).toEqual([
      { where: cellar, quantity: 1, visibility: 'hidden' }, { where: you, quantity: 1, visibility: 'visible' },
    ]);
  });

  it('reads a name copied with its Items Here summary as the name before the colon', () => {
    const result = run([copy('h', 'tonic', mara, { equipped: { slotId: 'hand', order: 1 } })],
      [op('unequip', 'Tonic: A bitter green draught.', { owner: 'Mara' })]);
    expect(result.diagnostics).toEqual([]);
    expect(result.copies[0].equipped).toBeUndefined();
  });

  it('makes a new item for a transfer from this place of an item it never listed', () => {
    const result = run([], [op('transfer', 'Rusty Key', { owner: 'here', to: 'you' })]);
    expect(result.runtimeItems.map((r) => r.name)).toEqual(['Rusty Key']);
    expect(result.copies.map((c) => c.where)).toEqual([you]);
  });

  it('moves the item for a gain from someone who holds it, rather than copying it', () => {
    const result = run([copy('t', 'tonic', mara, { quantity: 3 })], [op('gain', 'Tonic', { owner: 'Mara', to: 'you' })]);
    expect(result.diagnostics).toEqual([]);
    expect(result.copies.map(({ where, quantity }) => ({ where, quantity }))).toEqual([
      { where: mara, quantity: 2 }, { where: you, quantity: 1 },
    ]);
  });

  it('adds a copy for a gain from someone who does not hold the item', () => {
    const result = run([copy('t', 'tonic', you)], [op('gain', 'Tonic', { owner: 'Mara', to: 'you' })]);
    expect(result.copies.map(({ where, quantity }) => ({ where, quantity }))).toEqual([{ where: you, quantity: 2 }]);
  });

  it('makes no second item where the same one already lies', () => {
    const result = run([copy('t', 'tonic', cellar)], [op('gain', 'Tonic', { to: 'here' })]);
    expect(result.copies).toEqual([copy('t', 'tonic', cellar)]);
    expect(result.diagnostics).toEqual(['Inventory (pass) skipped gain "Tonic": it already lies at "here"']);
  });

  it('spreads a quantity over several Item Copies of an item that does not stack', () => {
    const result = run([copy('a', 'sword', you), copy('b', 'sword', you), copy('c', 'sword', you)],
      [op('transfer', 'Iron Sword', { owner: 'you', to: 'Mara', quantity: 2 })]);
    expect(result.copies.map((c) => c.where)).toEqual([you, mara, mara]);
  });

  it('reveals only a hidden Item Copy, leaving a visible one of the same item alone', () => {
    const result = run([copy('v', 'tonic', cellar), copy('h', 'tonic', cellar, { visibility: 'hidden' })],
      [op('reveal', 'Tonic', { owner: 'here' })]);
    expect(result.copies).toEqual([copy('v', 'tonic', cellar, { quantity: 2 })]);
  });

  it('consumes a runtime item the scene already holds', () => {
    const key: RuntimeItem = { id: 'k', name: 'Moonleaf' };
    const start: ItemCopy[] = [{ id: 'm', item: { kind: 'runtime', runtimeItemId: 'k' }, where: you, quantity: 2, visibility: 'visible' }];
    const result = run(start, [op('consume', 'moonleaf', { owner: 'you' })], { runtimeItems: [key] });
    expect(result.copies[0].quantity).toBe(1);
    expect(result.doses).toEqual([]);
  });
});

describe('runtime Item Copy orphans', () => {
  it('drops a runtime Item Copy whose runtime item the save no longer lists, and keeps a listed one', () => {
    const kept: ItemCopy = { id: 'a', item: { kind: 'runtime', runtimeItemId: 'k' }, where: you, quantity: 1, visibility: 'visible' };
    const lost: ItemCopy = { ...kept, id: 'b', item: { kind: 'runtime', runtimeItemId: 'gone' } };
    const { copies, dropped } = withoutOrphanCopies([kept, lost], {
      itemIds: new Set(), entityIds: new Set(), locationIds: new Set(), runtimeItemIds: new Set(['k']),
    });
    expect(copies).toEqual([kept]);
    expect(dropped).toEqual([lost]);
  });
});
