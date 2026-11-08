import { describe, expect, it } from 'vitest';
import { addAction, toggleHidden, toldActions, type ListedActionFacts, type ToldAction } from '@/lib/actionList';
import { applyInventoryPass, type PassScene } from '.';
import type { InventoryPassOp, Item, ItemCopy, RuntimeItem } from '@/types';

const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const ids = () => { let i = 0; return () => `n${i++}`; };

const tonic = item('tonic', 'Tonic', { uses: 1 });
const coin = item('coin', 'Coin', { uses: 1 });
const you = { kind: 'you' } as const;
const mara = { kind: 'entity', id: 'mara' } as const;
const cellar = { kind: 'location', id: 'cellar' } as const;
const lantern: RuntimeItem = { id: 'rt-lantern', name: 'Lantern' };

const copy = (id: string, ref: ItemCopy['item'], where: ItemCopy['where'], quantity = 1): ItemCopy =>
  ({ id, item: ref, where, quantity, visibility: 'visible' });
const op = (kind: InventoryPassOp['op'], name: string, over: Partial<InventoryPassOp> = {}): InventoryPassOp =>
  ({ op: kind, item: name, quantity: 1, owner: '', to: '', ...over });

const tonicRef = { kind: 'item', itemId: 'tonic' } as const;
const coinRef = { kind: 'item', itemId: 'coin' } as const;
const used: ListedActionFacts = { kind: 'use', item: { key: 'item:tonic', name: 'Tonic' }, copyId: 't' };

/** The told entries a list of `facts` sends, `hide` naming the entries the player hid. */
const sent = (facts: ListedActionFacts[], hide: number[] = []): ToldAction[] => {
  let list = facts.reduce<ReturnType<typeof addAction<null>>>((at, f, i) => addAction(at, f, null, `e${i}`), []);
  for (const at of hide) list = toggleHidden(list, list[at].id);
  return toldActions(list);
};

const run = (copies: ItemCopy[], ops: InventoryPassOp[], told: ToldAction[]) => {
  const scene: PassScene = {
    items: [tonic, coin], runtimeItems: [lantern], playerNames: ['Ash'],
    owners: [{ id: 'mara', name: 'Mara' }, { id: 'bram', name: 'Bram' }], location: { id: 'cellar', name: 'Cellar' }, told,
  };
  return applyInventoryPass(copies, ops, scene, { world: { items: [tonic, coin], slots: [], bodies: [] }, newId: ids() });
};

const held = (copies: readonly ItemCopy[], itemId: string, where: ItemCopy['where']) =>
  copies.filter((c) => c.item.kind === 'item' && c.item.itemId === itemId && JSON.stringify(c.where) === JSON.stringify(where))
    .reduce((n, c) => n + c.quantity, 0);

describe('the Inventory pass guard (Q7, Q44, Q45)', () => {
  // The panel already used one Tonic; two are left.
  const tonics = () => [copy('t', tonicRef, you, 2)];

  it('drops a use that reports a shown use, and logs it', () => {
    const result = run(tonics(), [op('use', 'Tonic', { owner: 'you', after: 'used up' })], sent([used]));
    expect(held(result.copies, 'tonic', you)).toBe(2);
    expect(result.ops).toEqual([]);
    expect(result.diagnostics).toContain('Inventory (pass) skipped use "Tonic": the player already did it');
  });

  it('lands a second use beyond the shown count', () => {
    const twoOps = run(tonics(), [op('use', 'Tonic', { owner: 'you', after: 'used up' }), op('use', 'Tonic', { owner: 'Ash', after: 'used up' })], sent([used]));
    expect(held(twoOps.copies, 'tonic', you)).toBe(1);
    const oneOp = run(tonics(), [op('use', 'Tonic', { owner: 'you', quantity: 2, after: 'used up' })], sent([used]));
    expect(held(oneOp.copies, 'tonic', you)).toBe(1);
    expect(oneOp.ops).toEqual([op('use', 'Tonic', { owner: 'you', quantity: 1, after: 'used up' })]);
    expect(oneOp.diagnostics).toContain('Inventory (pass) skipped 1 of 2 of use "Tonic": the player already did it');
  });

  it('guards as many uses as the entry repeats', () => {
    const result = run(tonics(), [op('use', 'Tonic', { owner: 'you', quantity: 2, after: 'used up' })], sent([used, used]));
    expect(held(result.copies, 'tonic', you)).toBe(2);
  });

  it('drops nothing for a hidden entry (Q21)', () => {
    const result = run(tonics(), [op('use', 'Tonic', { owner: 'you', after: 'used up' })], sent([used], [0]));
    expect(held(result.copies, 'tonic', you)).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });

  it('guards nothing for another owner or another item', () => {
    const copies = [...tonics(), copy('m', tonicRef, mara), copy('c', coinRef, you)];
    const result = run(copies, [op('use', 'Tonic', { owner: 'Mara', after: 'used up' }), op('use', 'Coin', { owner: 'you', after: 'used up' })], sent([used]));
    expect([held(result.copies, 'tonic', mara), held(result.copies, 'coin', you)]).toEqual([0, 0]);
  });

  it('drops a transfer, gain or lose that reports a shown give, to that receiver only', () => {
    const gave: ListedActionFacts = { kind: 'give', item: { key: 'item:coin', name: 'Coin' }, quantity: 2, to: { id: 'mara', name: 'Mara' } };
    const coins = () => [copy('c', coinRef, you, 5), copy('cm', coinRef, mara, 2)];
    for (const reply of [op('transfer', 'Coin', { owner: 'you', to: 'Mara', quantity: 2 }), op('gain', 'Coin', { owner: 'you', to: 'Mara', quantity: 2 }), op('lose', 'Coin', { owner: 'you', quantity: 2 })]) {
      const result = run(coins(), [reply], sent([gave]));
      expect([reply.op, held(result.copies, 'coin', you)]).toEqual([reply.op, 5]);
    }
    const toBram = run(coins(), [op('transfer', 'Coin', { owner: 'you', to: 'Bram', quantity: 2 })], sent([gave]));
    expect(held(toBram.copies, 'coin', you)).toBe(3);
  });

  it('drops a move to this place that reports a shown drop, and a take from it that reports a pick up', () => {
    const dropped: ListedActionFacts = { kind: 'drop', item: { key: 'item:coin', name: 'Coin' }, quantity: 1, place: 'cellar' };
    const afterDrop = run([copy('c', coinRef, you, 2), copy('cc', coinRef, cellar)], [op('transfer', 'Coin', { owner: 'you', to: 'here' })], sent([dropped]));
    expect(held(afterDrop.copies, 'coin', you)).toBe(2);
    const picked: ListedActionFacts = { kind: 'pickup', item: { key: 'item:coin', name: 'Coin' }, quantity: 1, place: 'cellar' };
    for (const reply of [op('gain', 'Coin', { owner: 'Cellar', to: 'you' }), op('gain', 'Coin', { to: 'you' }), op('transfer', 'Coin', { owner: 'here', to: 'you' })]) {
      const result = run([copy('c', coinRef, you, 1), copy('cc', coinRef, cellar)], [reply], sent([picked]));
      expect([reply, held(result.copies, 'coin', you)]).toEqual([reply, 1]);
    }
    // A character handing the player one is not the pick up.
    const handed = run([copy('c', coinRef, you, 1), copy('cm', coinRef, mara)], [op('gain', 'Coin', { owner: 'Mara', to: 'you' })], sent([picked]));
    expect(held(handed.copies, 'coin', you)).toBe(2);
  });

  it('drops an equip or unequip that reports a shown one', () => {
    const worn = (): ItemCopy[] => [{ ...copy('t', tonicRef, you), equipped: { slotId: 'hand', order: 0 } }];
    const unequipped: ListedActionFacts = { kind: 'unequip', item: { key: 'item:tonic', name: 'Tonic' }, copyId: 't' };
    const reply = [op('unequip', 'Tonic', { owner: 'you' })];
    expect(run(worn(), reply, sent([unequipped])).copies[0].equipped).toBeTruthy();
    expect(run(worn(), reply, []).copies[0].equipped).toBeFalsy();
    const equipped: ListedActionFacts = { kind: 'equip', item: { key: 'item:tonic', name: 'Tonic' }, copyId: 't' };
    const result = run(tonics(), [op('equip', 'Tonic', { owner: 'you' })], sent([equipped]));
    expect([result.ops, result.diagnostics]).toEqual([[], ['Inventory (pass) skipped equip "Tonic": the player already did it']]);
  });

  it('matches a runtime item by its name', () => {
    const lit: ListedActionFacts = { kind: 'use', item: { key: 'runtime:rt-lantern', name: 'Lantern' }, copyId: 'l' };
    const result = run([copy('l', { kind: 'runtime', runtimeItemId: 'rt-lantern' }, you)], [op('use', 'lantern', { owner: 'you', after: 'used up' })], sent([lit]));
    expect(result.copies).toHaveLength(1);
    expect(result.ops).toEqual([]);
  });

  it('never guards a stat, trait, travel or persona entry', () => {
    const others = sent([
      { kind: 'travel', from: null, to: { id: 'cellar', name: 'Cellar' } },
      { kind: 'trait', trait: { id: 'tonic', name: 'Tonic' }, owner: null, enabled: true },
    ]);
    const result = run(tonics(), [op('use', 'Tonic', { owner: 'you', after: 'used up' })], others);
    expect(held(result.copies, 'tonic', you)).toBe(1);
  });
});
