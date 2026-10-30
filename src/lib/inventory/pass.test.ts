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
    const raw = JSON.stringify({ operations: [
      { op: 'transfer', item: 'Iron Sword', quantity: 1, owner: 'you', to: 'Mara' },
      { op: 'change', item: 'Iron Sword', quantity: 1, owner: 'Mara', to: '', state: 'bloodied' },
      { op: 'use', item: 'Moonleaf', quantity: 1, owner: 'you', to: '', after: 'used up' },
    ] });
    expect(followsResponseSchema(raw, inventoryPassSchema().schema)).toBe(true);
    expect(parseInventoryReply(raw)).toEqual([
      op('transfer', 'Iron Sword', { owner: 'you', to: 'Mara' }),
      op('change', 'Iron Sword', { owner: 'Mara', state: 'bloodied' }),
      op('use', 'Moonleaf', { owner: 'you', after: 'used up' }),
    ]);
  });

  it('rejects an unknown op such as consume, and an unknown after, in the schema check', () => {
    const row = { item: 'x', quantity: 1, owner: '', to: '', state: '' };
    for (const bad of [{ ...row, op: 'sell' }, { ...row, op: 'consume' }, { ...row, op: 'use', after: 'eaten' }]) {
      expect(followsResponseSchema(JSON.stringify({ operations: [bad] }), inventoryPassSchema().schema)).toBe(false);
    }
  });

  it('reads the text lines, skipping prose and NONE, with a missing quantity as 1', () => {
    expect(parseInventoryLines('Here are the changes:\n- gain | Rusty Key |  |  | you\nuse | Tonic | 2 | you |\nNONE'))
      .toEqual([op('gain', 'Rusty Key', { to: 'you' }), op('use', 'Tonic', { quantity: 2, owner: 'you' })]);
  });

  it('reads the state and after fields from a text line, and after however the model joins it', () => {
    expect(parseInventoryLines('change | Lantern | 1 | you |  | lit |\nuse | Honey Cake | 1 | you |  |  | Used_Up\nuse | Note | 1 | you |  |  | kept'))
      .toEqual([
        op('change', 'Lantern', { owner: 'you', state: 'lit' }),
        op('use', 'Honey Cake', { owner: 'you', state: '', after: 'used up' }),
        op('use', 'Note', { owner: 'you', state: '', after: 'kept' }),
      ]);
  });

  it('tells a state the reply left out from an empty one', () => {
    expect(parseInventoryReply(JSON.stringify({ operations: [{ op: 'change', item: 'Lantern', quantity: 1, owner: 'you', to: '' }] }))[0])
      .not.toHaveProperty('state');
    expect(parseInventoryReply(JSON.stringify({ operations: [{ op: 'change', item: 'Lantern', quantity: 1, owner: 'you', to: '', state: '' }] }))[0])
      .toHaveProperty('state', '');
    expect(parseInventoryLines('change | Lantern | 1 | you |')[0]).not.toHaveProperty('state');
  });

  it('drops a line whose op is unknown, such as consume', () => {
    expect(parseInventoryLines('consume | Tonic | 1 | you |')).toEqual([]);
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

  it('applies each of the operations through the validator', () => {
    const start = [
      copy('s', 'sword', you), copy('t', 'tonic', you, { quantity: 3 }), copy('r', 'ring', cellar, { visibility: 'hidden' }),
    ];
    const result = run(start, [
      op('gain', 'Tonic', { to: 'Mara' }),
      op('equip', 'Iron Sword', { owner: 'you' }),
      op('unequip', 'Iron Sword', { owner: 'Ash' }),
      op('use', 'Tonic', { owner: 'you' }),
      op('lose', 'Tonic', { owner: 'you' }),
      op('reveal', 'Cursed Ring', { owner: 'here' }),
      op('transfer', 'Cursed Ring', { owner: 'Cellar', to: 'you' }),
    ]);
    expect(result.diagnostics).toEqual([]);
    expect(result.itemUses).toEqual([{ itemId: 'tonic', where: you, hidden: false }]);
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
      op('use', 'Iron Sword', { owner: 'you' }),
      op('lose', 'Tonic', { owner: 'you' }),
    ]);
    expect(result.diagnostics).toEqual([
      'Inventory (pass) skipped transfer "Tonic": no one present is "Odette"',
      'Inventory (pass) skipped equip: Item Copy t has no slot',
      'Inventory (pass) skipped use "Iron Sword": none at "you"',
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

  it('skips a gain whose source is its own recipient, the item that owner already holds', () => {
    const result = run([copy('t', 'tonic', you)], [op('gain', 'Tonic', { owner: 'you', to: 'you' })]);
    expect(result.copies.map(({ where, quantity }) => ({ where, quantity }))).toEqual([{ where: you, quantity: 1 }]);
    expect(result.diagnostics).toEqual(['Inventory (pass) skipped gain "Tonic": it comes from "you", who receives it']);
  });

  it('adds one more copy for a gain from this place of an item the recipient already holds', () => {
    const result = run([copy('t', 'tonic', you)], [op('gain', 'Tonic', { owner: 'here', to: 'you' })]);
    expect(result.copies.map(({ where, quantity }) => ({ where, quantity }))).toEqual([{ where: you, quantity: 2 }]);
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

  it('uses up a runtime item the scene already holds when after is empty', () => {
    const key: RuntimeItem = { id: 'k', name: 'Moonleaf' };
    const start: ItemCopy[] = [{ id: 'm', item: { kind: 'runtime', runtimeItemId: 'k' }, where: you, quantity: 2, visibility: 'visible' }];
    const result = run(start, [op('use', 'moonleaf', { owner: 'you' })], { runtimeItems: [key] });
    expect(result.copies[0].quantity).toBe(1);
    expect(result.itemUses).toEqual([]);
  });
});

describe('the pass\'s use, after and change (Q6, Q7, Q10)', () => {
  const letter = item('letter', 'Sealed Letter', { uses: 1, whenEmpty: { kind: 'changesState', state: 'opened' } });
  const cloak = item('cloak', 'Oilskin Cloak');
  const note: RuntimeItem = { id: 'k', name: 'Torn Note' };
  const items = [letter, cloak, tonic];
  const noteCopy = (quantity: number): ItemCopy => ({ id: 'm', item: { kind: 'runtime', runtimeItemId: 'k' }, where: you, quantity, visibility: 'visible' });
  const pass = (copies: ItemCopy[], ops: InventoryPassOp[]) =>
    applyInventoryPass(copies, ops, scene({ items, runtimeItems: [note] }), { world: { items }, newId: ids() });
  const states = (copies: ItemCopy[]) => copies.map((c) => ({ id: c.id, quantity: c.quantity, state: c.state?.state }));

  it('keeps a runtime item a use leaves kept, and removes one a use leaves used up', () => {
    expect(pass([noteCopy(2)], [op('use', 'Torn Note', { owner: 'you', after: 'kept' })]).copies).toEqual([noteCopy(2)]);
    expect(pass([noteCopy(2)], [op('use', 'Torn Note', { owner: 'you', after: 'used up' })]).copies).toEqual([noteCopy(1)]);
  });

  it('uses a charged copy before a spent one beside it', () => {
    const wand = item('wand', 'Wand', { uses: 3, whenEmpty: { kind: 'stays' } });
    const spent = copy('a', 'wand', you, { state: { uses: 0 } });
    const result = applyInventoryPass([spent, copy('b', 'wand', you)], [op('use', 'Wand', { owner: 'you' })],
      scene({ items: [wand] }), { world: { items: [wand] }, newId: ids() });
    expect(result.diagnostics).toEqual([]);
    expect(result.copies.map((c) => ({ id: c.id, uses: c.state?.uses }))).toEqual([{ id: 'a', uses: 0 }, { id: 'b', uses: 2 }]);
  });

  it('follows an authored item\'s When Empty whatever after says', () => {
    for (const after of ['used up', 'kept', undefined] as const) {
      const result = pass([copy('l', 'letter', you)], [op('use', 'Sealed Letter', { owner: 'you', after })]);
      expect(result.diagnostics).toEqual([]);
      expect(states(result.copies)).toEqual([{ id: 'l', quantity: 1, state: 'opened' }]);
    }
    expect(pass([copy('t', 'tonic', you, { quantity: 2 })], [op('use', 'Tonic', { owner: 'you', after: 'kept' })]).copies)
      .toEqual([copy('t', 'tonic', you, { quantity: 1 })]);
  });

  it('sets the named copy\'s State, splitting one off a stack', () => {
    const result = pass([copy('c', 'cloak', you, { quantity: 2 })], [op('change', 'oilskin cloak', { owner: 'you', state: 'soaked' })]);
    expect(result.diagnostics).toEqual([]);
    expect(states(result.copies)).toEqual([{ id: 'c', quantity: 1, state: undefined }, { id: 'n0', quantity: 1, state: 'soaked' }]);
  });

  it('changes as many copies as the quantity names, passing over one already at that State', () => {
    const start = [copy('a', 'cloak', you, { state: { state: 'Soaked' } }), copy('b', 'cloak', you, { quantity: 2 })];
    const result = pass(start, [op('change', 'Oilskin Cloak', { owner: 'you', state: 'soaked', quantity: 2 })]);
    expect(result.diagnostics).toEqual([]);
    expect(result.copies.reduce((n, c) => n + (c.state?.state?.toLowerCase() === 'soaked' ? c.quantity : 0), 0)).toBe(3);
  });

  it('skips a change to the State every copy already has, with a diagnostic', () => {
    const start = [copy('a', 'cloak', you, { state: { state: 'soaked' } })];
    const result = pass(start, [op('change', 'Oilskin Cloak', { owner: 'you', state: 'Soaked ' })]);
    expect(result.copies).toEqual(start);
    expect(result.diagnostics).toEqual(['Inventory (pass) skipped change "Oilskin Cloak": every one at "you" is already Soaked']);
  });

  it('reads a name copied with its Items Here marks as the name before them', () => {
    const start = [copy('a', 'cloak', you, { quantity: 2, state: { state: 'damp' } })];
    const result = pass(start, [op('change', 'Oilskin Cloak (damp, ×2)', { owner: 'you', state: 'soaked' })]);
    expect(result.diagnostics).toEqual([]);
    expect(states(result.copies)).toEqual([{ id: 'a', quantity: 1, state: 'damp' }, { id: 'n0', quantity: 1, state: 'soaked' }]);
  });

  it('changes a runtime item\'s State, and skips a change to an item the owner lacks', () => {
    const result = pass([noteCopy(1)], [op('change', 'Torn Note', { owner: 'you', state: 'damp' }), op('change', 'Oilskin Cloak', { owner: 'you', state: 'wet' })]);
    expect(states(result.copies)).toEqual([{ id: 'm', quantity: 1, state: 'damp' }]);
    expect(result.diagnostics).toEqual(['Inventory (pass) skipped change "Oilskin Cloak": none at "you"']);
  });

  it('changes a copy lying here and a hidden one (Q33), the visible one first', () => {
    const start = [copy('h', 'cloak', cellar, { visibility: 'hidden' }), copy('v', 'cloak', cellar)];
    const one = pass(start, [op('change', 'Oilskin Cloak', { owner: 'here', state: 'torn' })]);
    expect(one.diagnostics).toEqual([]);
    expect(states(one.copies)).toEqual([{ id: 'h', quantity: 1, state: undefined }, { id: 'v', quantity: 1, state: 'torn' }]);
    const both = pass(start, [op('change', 'Oilskin Cloak', { owner: 'Cellar', state: 'torn', quantity: 2 })]);
    expect(both.copies.map((c) => [c.visibility, c.state?.state])).toEqual([['hidden', 'torn'], ['visible', 'torn']]);
  });

  it('skips a change that names no state, and clears the State on an empty one', () => {
    const start = [copy('a', 'cloak', you, { state: { state: 'soaked' } })];
    const missing = pass(start, [{ op: 'change', item: 'Oilskin Cloak', quantity: 1, owner: 'you', to: '' }]);
    expect(missing.copies).toEqual(start);
    expect(missing.diagnostics).toEqual(['Inventory (pass) skipped change "Oilskin Cloak": it names no state']);
    expect(states(pass(start, [op('change', 'Oilskin Cloak', { owner: 'you', state: '' })]).copies)).toEqual([{ id: 'a', quantity: 1, state: undefined }]);
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
