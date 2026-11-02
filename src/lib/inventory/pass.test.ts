import { describe, expect, it } from 'vitest';
import { bodyFixture } from '@/test/bodyFixture';
import { followsResponseSchema } from '@/lib/aiRequest/responseSchema';
import {
  applyInventoryPass, inventoryPassSchema, parseInventoryLines, parseInventoryReply, withoutOrphanCopies, type PassMoney, type PassScene,
} from '.';
import type { Currency, InventoryPassOp, Item, ItemCopy, Placement, PlayerStat, RuntimeItem, Slot } from '@/types';

const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const ids = () => { let i = 0; return () => `n${i++}`; };

const hand: Slot = { id: 'hand', name: 'Hand' };
const sword = item('sword', 'Iron Sword', { stackable: false, slotRule: { mode: 'either', slotIds: ['hand'] } });
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
  applyInventoryPass(copies, ops, scene(over), { world: { items: [sword, tonic, ring], slots: [hand], bodies: [bodyFixture({ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'hand' }] })] }, newId: ids() });

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
      'Inventory (pass) skipped transfer "Tonic": nothing present is named "Odette"',
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
    expect(result.diagnostics).toEqual(['Inventory (pass) skipped lose "Iron Sword": nothing present is named "Odette"']);
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
    expect(result.diagnostics).toEqual(['Inventory (pass) skipped gain "Tonic": it is already at "here"']);
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

  describe('a use on a target', () => {
    const oil = item('oil', 'Lamp Oil', { uses: 1 });
    const lamp = item('lamp', 'Lantern', { uses: 3, stackable: false });
    const world = [oil, lamp];
    const use = (copies: ItemCopy[], target: string) => applyInventoryPass(copies, [op('use', 'Lamp Oil', { owner: 'you', target })],
      scene({ items: world }), { world: { items: world }, newId: ids() });
    const used = (result: ReturnType<typeof use>) => result.events.filter((e) => e.timing === 'used').map((e) => e.target?.id);

    it('names the copy the owner holds on the used event', () => {
      const result = use([copy('o', 'oil', you), copy('l', 'lamp', you)], 'lantern');
      expect(result.diagnostics).toEqual([]);
      expect(used(result)).toEqual(['l']);
    });

    it('falls back to a copy lying here, never a hidden one', () => {
      expect(used(use([copy('o', 'oil', you), copy('l', 'lamp', cellar)], 'Lantern'))).toEqual(['l']);
      expect(used(use([copy('o', 'oil', you), copy('l', 'lamp', cellar, { visibility: 'hidden' })], 'Lantern'))).toEqual([undefined]);
    });

    it('still uses the item when the target is not here, with a diagnostic', () => {
      const result = use([copy('o', 'oil', you), copy('l', 'lamp', mara)], 'Lantern');
      expect(used(result)).toEqual([undefined]);
      expect(result.copies.map((c) => c.id)).toEqual(['l']);
      expect(result.diagnostics).toEqual(['Inventory (pass) skipped target "Lantern" of use "Lamp Oil": none at "you" or here']);
    });

    it('reads a target copied with its Items Here marks, or written in to, as the item named', () => {
      const oilOn = (over: Partial<InventoryPassOp>) => applyInventoryPass([copy('o', 'oil', you), copy('l', 'lamp', you)],
        [op('use', 'Lamp Oil', { owner: 'you', ...over })], scene({ items: world }), { world: { items: world }, newId: ids() });
      expect(used(oilOn({ target: 'Lantern (3 of 3 uses left)' }))).toEqual(['l']);
      expect(used(oilOn({ to: 'the Lantern' }))).toEqual(['l']);
      expect(used(oilOn({ to: 'you' }))).toEqual([undefined]);
    });

    it('reads an item named as its own target as a plain use, with no diagnostic', () => {
      const result = applyInventoryPass([copy('l', 'lamp', you)], [op('use', 'Lantern', { owner: 'you', target: 'Lantern' })],
        scene({ items: world }), { world: { items: world }, newId: ids() });
      expect(result.diagnostics).toEqual([]);
      expect(used(result)).toEqual([undefined]);
    });

    it('reads the target from the schema reply and a text line', () => {
      const raw = JSON.stringify({ operations: [{ op: 'use', item: 'Lamp Oil', quantity: 1, owner: 'you', to: '', after: 'used up', target: 'Lantern' }] });
      expect(followsResponseSchema(raw, inventoryPassSchema().schema)).toBe(true);
      expect(parseInventoryReply(raw)).toEqual([op('use', 'Lamp Oil', { owner: 'you', after: 'used up', target: 'Lantern' })]);
      expect(parseInventoryLines('use | Lamp Oil | 1 | you |  |  | used up | Lantern\nuse | Tonic | 1 | you |  |  |  | none'))
        .toEqual([op('use', 'Lamp Oil', { owner: 'you', state: '', after: 'used up', target: 'Lantern' }), op('use', 'Tonic', { owner: 'you', state: '' })]);
    });
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

describe("the pass's named slot (Q37, Q41, Q65)", () => {
  const dagger = item('dagger', 'Dagger', { slotRule: { mode: 'either', slotIds: ['main', 'off'] } });
  const greatsword = item('greatsword', 'Greatsword', { stackable: false, slotRule: { mode: 'all', slotIds: ['main', 'off'] } });
  const hands: Slot[] = [{ id: 'main', name: 'Main Hand' }, { id: 'off', name: 'Off Hand' }, hand];
  const items = [dagger, greatsword, sword];
  const equipOn = (name: string, slot?: string, quantity = 1, itemId = name.toLowerCase()) => applyInventoryPass(
    [copy('c', itemId, you, { quantity })], [op('equip', name, { owner: 'you', quantity, ...(slot !== undefined && { slot }) })],
    scene({ items, resolve: undefined }),
    { world: { items, slots: hands, bodies: [bodyFixture({ id: 'b', name: 'B', entries: [{ slotId: 'main' }, { slotId: 'off' }] })] }, newId: ids() },
  );
  const slotsTaken = (result: ReturnType<typeof equipOn>) => result.copies.flatMap((c) => (c.equipped ? [c.equipped.slotId] : []));

  it('reads the slot from the schema reply and the ninth text field, a filler word as none', () => {
    const raw = JSON.stringify({ operations: [
      { op: 'equip', item: 'Dagger', quantity: 1, owner: 'you', to: '', slot: 'Off Hand' },
      { op: 'equip', item: 'Sword', quantity: 1, owner: 'you', to: '', slot: 'none' },
    ] });
    expect(followsResponseSchema(raw, inventoryPassSchema().schema)).toBe(true);
    expect(parseInventoryReply(raw)).toEqual([
      op('equip', 'Dagger', { owner: 'you', slot: 'Off Hand' }),
      op('equip', 'Sword', { owner: 'you' }),
    ]);
    expect(parseInventoryLines('equip | Dagger | 1 | you | | | | | Off Hand')).toEqual([op('equip', 'Dagger', { owner: 'you', state: '', slot: 'Off Hand' })]);
  });

  it('lands in the named slot, past the first free one, ignoring case', () => {
    expect(slotsTaken(equipOn('Dagger', 'off hand'))).toEqual(['off']);
  });

  it('takes the first free slot when the reply names none', () => {
    expect(slotsTaken(equipOn('Dagger'))).toEqual(['main']);
  });

  it("reads two or more of the item's own slots, joined by anything, as no name", () => {
    expect(slotsTaken(equipOn('Dagger', 'Main Hand or Off Hand'))).toEqual(['main']);
    expect(slotsTaken(equipOn('Dagger', 'off hand, main hand'))).toEqual(['main']);
    expect(slotsTaken(equipOn('Greatsword', 'main hand + off hand'))).toEqual(['main']);
    expect(slotsTaken(equipOn('Greatsword', 'Main Hand or Off Hand'))).toEqual(['main']);
  });

  it.each(['both Main Hand and Off Hand', 'Main Hand with Off Hand', 'Main Hand, Off Hand, Left Paw'])('reads %s as no name, whatever joins the two (Q65)', (slot) => {
    expect(slotsTaken(equipOn('Dagger', slot))).toEqual(['main']);
    expect(slotsTaken(equipOn('Greatsword', slot))).toEqual(['main']);
  });

  it.each(['Main Hand or Left Paw', 'Left Paw', 'Main Hand or Off Handle'])("skips %s, which holds a name the item doesn't list", (slot) => {
    const result = equipOn('Dagger', slot);
    expect(slotsTaken(result)).toEqual([]);
    expect(result.diagnostics).toEqual([`Inventory (pass) skipped equip "Dagger": no slot is named "${slot}"`]);
  });

  it('counts a shorter slot name inside a longer one only once', () => {
    const glove = item('glove', 'Glove', { slotRule: { mode: 'either', slotIds: ['hand', 'off'] } });
    const slotFor = (slot: string) => applyInventoryPass([copy('c', 'glove', you)], [op('equip', 'Glove', { owner: 'you', slot })], scene({ items: [glove], resolve: undefined }), {
      world: { items: [glove], slots: hands, bodies: [bodyFixture({ id: 'b', name: 'B', entries: [{ slotId: 'hand' }, { slotId: 'off' }] })] }, newId: ids(),
    }).copies[0].equipped?.slotId;
    expect(slotFor('Off Hand')).toBe('off');
    expect(slotFor('Off Hand or Hand')).toBe('hand');
  });

  it("skips a slot the item doesn't allow, with a diagnostic", () => {
    const result = equipOn('Dagger', 'Hand');
    expect(slotsTaken(result)).toEqual([]);
    expect(result.diagnostics).toEqual(['Inventory (pass) skipped equip: Item Copy c can\'t go in Hand']);
  });

  it('skips a name no slot has, with a diagnostic', () => {
    const result = equipOn('Dagger', 'Left Paw');
    expect(slotsTaken(result)).toEqual([]);
    expect(result.diagnostics).toEqual(['Inventory (pass) skipped equip "Dagger": no slot is named "Left Paw"']);
  });

  it('accepts a listed name on an All of item, which takes every slot', () => {
    const result = equipOn('Greatsword', 'Off Hand');
    expect(result.diagnostics).toEqual([]);
    expect(result.copies[0].equipped).toBeDefined();
  });

  it('holds the name to one copy of a stack, the next taking the first free slot', () => {
    expect(slotsTaken(equipOn('Dagger', 'Off Hand', 2)).sort()).toEqual(['main', 'off']);
  });
});

describe('pay', () => {
  const copper = item('copper', 'Copper');
  const gold = item('gold', 'Gold');
  const MONEY: Currency = { id: 'coin', name: 'Coin', backing: { kind: 'items', items: [{ itemId: 'copper', worth: 1 }, { itemId: 'gold', worth: 100 }] } };
  const CREDITS: Currency = { id: 'credits', name: 'Credits', backing: { kind: 'stat', statId: 'funds' } };
  const funds = (value: number, over: Partial<PlayerStat> = {}): PlayerStat =>
    ({ id: 'funds', name: 'Funds', type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [], ...over });
  const money = (over: Partial<PassMoney> = {}): PassMoney => ({
    currencies: [MONEY], placements: [], stats: { globalStats: [], entityStats: {} }, playedIds: ['hero'], statsOn: (_owner, stats) => stats, ...over,
  });
  const pay = (owner: string, to: string, price: string, currency?: string) =>
    op('pay', '', { owner, to, price, ...(currency && { currency }) });
  const settle = (copies: ItemCopy[], ops: InventoryPassOp[], moneyOver: Partial<PassMoney> = {}) =>
    applyInventoryPass(copies, ops, scene({ items: [copper, gold], playerNames: ['Ashley Vance', 'Little Bird'], money: money(moneyOver) }), { world: { items: [copper, gold] }, newId: ids() });
  const counts = (copies: readonly ItemCopy[], where: ItemCopy['where']) => Object.fromEntries(copies
    .filter((c) => JSON.stringify(c.where) === JSON.stringify(where)).map((c) => [c.item.kind === 'item' ? c.item.itemId : '', c.quantity]));

  it('parses from the schema and from the text line, with no item, and a bare-number price', () => {
    const json = JSON.stringify({ operations: [{ op: 'pay', item: '', quantity: 1, owner: 'you', to: 'Mara', price: '3 Gold', currency: 'Coin' }] });
    expect(followsResponseSchema(json, inventoryPassSchema().schema)).toBe(true);
    expect(parseInventoryReply(json)).toEqual([op('pay', '', { owner: 'you', to: 'Mara', price: '3 Gold', currency: 'Coin' })]);
    expect(parseInventoryReply(JSON.stringify({ operations: [{ op: 'pay', item: '', quantity: 1, owner: 'you', to: '', price: 40 }] })))
      .toEqual([op('pay', '', { owner: 'you', price: '40' })]);
    expect(parseInventoryLines('pay |  | 1 | you | Mara |  |  |  |  | 3 Gold | Coin'))
      .toEqual([op('pay', '', { owner: 'you', to: 'Mara', state: '', price: '3 Gold', currency: 'Coin' })]);
  });

  it("reads a pay's sum from the quantity cell of a text line", () => {
    expect(parseInventoryLines('pay | | 2 Silver | you | dock guard | | | | |'))
      .toEqual([op('pay', '', { owner: 'you', to: 'dock guard', state: '', price: '2 Silver' })]);
  });

  it('counts a hand move of money the reply repeats once, and an item move twice', () => {
    const gain = op('gain', 'Copper', { quantity: 4, to: 'you' });
    expect(counts(settle([], [gain, gain]).copies, you)).toEqual({ copper: 4 });
    expect(counts(settle([], [gain, { ...gain, owner: 'here' }]).copies, you)).toEqual({ copper: 4 });
    expect(counts(settle([], [gain, { ...gain, quantity: 2 }]).copies, you)).toEqual({ copper: 6 });
    const item2 = op('gain', 'Tonic', { to: 'you' });
    const twice = applyInventoryPass([], [item2, item2], scene({ items: [tonic, copper], money: money() }), { world: { items: [tonic, copper] }, newId: ids() });
    expect(twice.copies.reduce((sum, c) => sum + c.quantity, 0)).toBe(2);
  });

  it('reads text lines whose cells carry their field names', () => {
    expect(parseInventoryLines('op: use | item: Tonic | quantity: 2 | owner: you | to: | state: | after: used up'))
      .toEqual([op('use', 'Tonic', { quantity: 2, owner: 'you', state: '', after: 'used up' })]);
    expect(parseInventoryLines('op: pay | item: | quantity: 1 | owner: you | to: Mara | | | | | price: 3 Gold'))
      .toEqual([op('pay', '', { owner: 'you', to: 'Mara', state: '', price: '3 Gold' })]);
  });

  it('still drops an item operation with no item', () => {
    expect(parseInventoryLines('lose |  | 1 | you')).toEqual([]);
  });

  it('settles items between present owners, and a tracked entity keeps them', () => {
    const placements: Placement[] = [{ id: 'p', source: { kind: 'item', itemId: 'copper' }, where: mara, quantity: 1 }];
    const { copies, diagnostics } = settle([copy('g', 'gold', you, { quantity: 1 })], [pay('you', 'Mara', '1 Gold')], { placements });
    expect(diagnostics).toEqual([]);
    expect(counts(copies, mara)).toEqual({ gold: 1 });
    expect(counts(copies, you)).toEqual({});
  });

  it.each(['you', 'You', 'the player', 'Ashley Vance', 'Little Bird', 'Ashley'])('reads %s as the player, never as income (Q51)', (name) => {
    const { copies } = settle([copy('c', 'copper', you, { quantity: 5 })], [pay(name, '', '2 Copper')]);
    expect(counts(copies, you)).toEqual({ copper: 3 });
  });

  it.each(['you', 'Little Bird', 'Ashley'])('reads %s as the player receiving, never as money that leaves', (name) => {
    const { copies } = settle([], [pay('', name, '2 Copper')]);
    expect(counts(copies, you)).toEqual({ copper: 2 });
  });

  it.each(['the harbor guard', '', 'here', 'Cellar'])('reads a payee of "%s" as no one: the money leaves the world (Q51)', (to) => {
    const { copies, diagnostics } = settle([copy('c', 'copper', you, { quantity: 5 })], [pay('you', to, '2 Copper')]);
    expect(diagnostics).toEqual([]);
    expect(counts(copies, you)).toEqual({ copper: 3 });
    expect(copies.filter((c) => c.where.kind !== 'you')).toEqual([]);
  });

  it.each(['the harbor mayor', '', 'here'])('reads a payer of "%s" as income', (owner) => {
    expect(counts(settle([], [pay(owner, 'you', '2 Copper')]).copies, you)).toEqual({ copper: 2 });
  });

  it('refuses a pay with no party, no price, or an unknown Currency, with a diagnostic and no change', () => {
    const start = [copy('c', 'copper', you, { quantity: 5 })];
    for (const bad of [pay('', '', '1 Copper'), op('pay', '', { owner: 'you' }), pay('you', '', '1', 'Marks')]) {
      const { copies, diagnostics, events } = settle(start, [bad]);
      expect(copies).toEqual(start);
      expect(events).toEqual([]);
      expect(diagnostics).toEqual([expect.stringContaining('Inventory (pass) skipped pay')]);
    }
  });

  it('refuses a price in one Currency against a purse of another (Q26)', () => {
    const SHELLS: Currency = { id: 'shells', name: 'Shells', backing: { kind: 'items', items: [{ itemId: 'shell', worth: 1 }] } };
    const shell = item('shell', 'Shell');
    const start = [copy('s', 'shell', you, { quantity: 50 })];
    const { copies, diagnostics } = applyInventoryPass(start, [pay('you', '', '1 Copper')],
      scene({ items: [copper, gold, shell], money: money({ currencies: [MONEY, SHELLS] }) }), { world: { items: [copper, gold, shell] }, newId: ids() });
    expect(copies).toEqual(start);
    expect(diagnostics).toHaveLength(1);
  });

  it('settles a stat on the played entity, and each pay reads what the one before it left', () => {
    const stats = { globalStats: [], entityStats: { hero: [funds(50)] } };
    const result = settle([], [pay('you', '', '30', 'Credits'), pay('you', '', '30', 'Credits')], { currencies: [CREDITS], stats });
    expect(result.stats?.entityStats.hero[0].value).toBe(20);
    expect(result.diagnostics).toHaveLength(1);
  });

  it('reads a switched-off stat as untracked (Q45)', () => {
    const stats = { globalStats: [funds(50)], entityStats: {} };
    const result = settle([], [pay('you', '', '5', 'Credits')], { currencies: [CREDITS], stats, statsOn: () => [] });
    expect(result.stats?.globalStats[0].value).toBe(50);
    expect(result.diagnostics).toHaveLength(1);
  });

  it('counts a reply that pays and also moves the items by hand once', () => {
    const { copies, diagnostics } = settle([], [op('gain', 'Copper', { quantity: 4, to: 'you' }), pay('Mara', 'you', '4 Copper')]);
    expect(counts(copies, you)).toEqual({ copper: 4 });
    expect(diagnostics).toEqual([expect.stringContaining('covers this money')]);
  });

  it('charges nothing when a refused pay comes with a hand move of the items (Q56)', () => {
    const start = [copy('c', 'copper', you, { quantity: 3 })];
    const { copies, diagnostics } = settle(start, [pay('you', 'Mara', '5 Copper'), op('lose', 'Copper', { quantity: 3, owner: 'you' })]);
    expect(copies).toEqual(start);
    expect(diagnostics).toHaveLength(2);
  });

  it('runs a gain beside a pay with no price or no one on either side (Q76)', () => {
    for (const bad of [op('pay', '', { quantity: 4, owner: 'here', to: 'you' }), pay('here', '', '4 Copper')]) {
      const { copies } = settle([], [op('gain', 'Copper', { quantity: 4, owner: 'here', to: 'you' }), bad]);
      expect(counts(copies, you)).toEqual({ copper: 4 });
    }
  });

  it('hands no free money when a pay with no price names the player as payer (Q76)', () => {
    const start = [copy('c', 'copper', you, { quantity: 3 })];
    const { copies } = settle(start, [op('pay', '', { owner: 'you', to: 'Mara' }), op('gain', 'Gold', { to: 'you' })]);
    expect(copies).toEqual(start);
  });

  it('hands a broke player no free money when a refused pay comes with a gain as change (Q56)', () => {
    const start = [copy('c', 'copper', you, { quantity: 3 })];
    const { copies } = settle(start, [pay('you', 'Mara', '1 Gold'), op('gain', 'Gold', { to: 'you' })]);
    expect(copies).toEqual(start);
  });

  it('skips the hand move when the pay beside it cannot be read at all', () => {
    expect(settle([], [op('gain', 'Copper', { quantity: 4, to: 'you' }), pay('Mara', 'you', 'a fair sum')]).copies).toEqual([]);
  });

  it("leaves another Currency's items to their hand move", () => {
    const shell = item('shell', 'Shell');
    const SHELLS: Currency = { id: 'shells', name: 'Shells', backing: { kind: 'items', items: [{ itemId: 'shell', worth: 1 }] } };
    const { copies } = applyInventoryPass([], [op('gain', 'Shell', { quantity: 2, to: 'you' }), pay('', 'you', '1 Copper')],
      scene({ items: [copper, gold, shell], money: money({ currencies: [MONEY, SHELLS] }) }), { world: { items: [copper, gold, shell] }, newId: ids() });
    expect(counts(copies, you)).toEqual({ shell: 2, copper: 1 });
  });

  it('keeps an item move beside a pay', () => {
    const { copies } = applyInventoryPass([copy('s', 'sword', you)], [op('transfer', 'Iron Sword', { owner: 'you', to: 'Mara' }), pay('', 'you', '1 Copper')],
      scene({ items: [sword, copper, gold], money: money() }), { world: { items: [sword, copper, gold] }, newId: ids() });
    expect(counts(copies, mara)).toEqual({ sword: 1 });
    expect(counts(copies, you)).toEqual({ copper: 1 });
  });

  it.each([
    ['the money as the item', op('pay', 'Copper', { quantity: 3, owner: 'you' })],
    ['the money as the currency', op('pay', '', { quantity: 3, owner: 'you', currency: 'Copper' })],
    ['a price with no number', op('pay', '', { quantity: 3, owner: 'you', price: 'Copper' })],
  ])('reads %s, with how many as the quantity', (_case, reply) => {
    expect(counts(settle([copy('c', 'copper', you, { quantity: 5 })], [reply]).copies, you)).toEqual({ copper: 2 });
  });

  it('refuses money named with no amount, and never invents one', () => {
    const start = [copy('c', 'copper', you, { quantity: 5 })];
    for (const bare of [op('pay', 'Copper', { owner: 'you' }), op('pay', '', { owner: 'you', currency: 'Copper' }), op('pay', '', { owner: 'you', price: 'Copper' })]) {
      expect(settle(start, [bare]).copies).toEqual(start);
    }
  });

  it('charges the played entity whose stat is on, past one whose stat is off (Q45)', () => {
    const stats = { globalStats: [], entityStats: { other: [funds(90)], hero: [funds(50)] } };
    const result = settle([], [pay('you', '', '5', 'Credits')], {
      currencies: [CREDITS], stats, playedIds: ['other', 'hero'], statsOn: (owner, list) => (owner === 'other' ? [] : list),
    });
    expect(result.stats?.entityStats.other[0].value).toBe(90);
    expect(result.stats?.entityStats.hero[0].value).toBe(45);
  });

  it('counts a repeated lose of items twice: only a gain creates money', () => {
    const lose = op('lose', 'Copper', { owner: 'you' });
    expect(counts(settle([copy('c', 'copper', you, { quantity: 5 })], [lose, lose]).copies, you)).toEqual({ copper: 3 });
  });

  it('skips a pay in a scene with no money', () => {
    const { diagnostics } = run([], [pay('you', '', '5')]);
    expect(diagnostics).toEqual([expect.stringContaining('skipped pay')]);
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
