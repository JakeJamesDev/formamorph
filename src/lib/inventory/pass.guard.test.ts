import { describe, expect, it } from 'vitest';
import { addAction, toggleHidden, toldActions, type ListedActionFacts, type ToldAction } from '@/lib/actionList';
import { applyInventoryPass, type PassScene } from '.';
import type { InventoryPassOp, Item, ItemInstance, RuntimeItem } from '@/types';

const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const ids = () => { let i = 0; return () => `n${i++}`; };

const tonic = item('tonic', 'Tonic', { uses: 1 });
const coin = item('coin', 'Coin', { uses: 1 });
const you = { kind: 'you' } as const;
const mara = { kind: 'entity', id: 'mara' } as const;
const cellar = { kind: 'location', id: 'cellar' } as const;
const lantern: RuntimeItem = { id: 'rt-lantern', name: 'Lantern' };

const instance = (id: string, ref: ItemInstance['item'], where: ItemInstance['where'], quantity = 1): ItemInstance =>
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

const run = (instances: ItemInstance[], ops: InventoryPassOp[], told: ToldAction[]) => {
  const scene: PassScene = {
    items: [tonic, coin], runtimeItems: [lantern], playerNames: ['Ash'],
    owners: [{ id: 'mara', name: 'Mara' }, { id: 'bram', name: 'Bram' }], location: { id: 'cellar', name: 'Cellar' }, told,
  };
  return applyInventoryPass(instances, ops, scene, { world: { items: [tonic, coin], slots: [], bodies: [] }, newId: ids() });
};

const held = (instances: readonly ItemInstance[], itemId: string, where: ItemInstance['where']) =>
  instances.filter((c) => c.item.kind === 'item' && c.item.itemId === itemId && JSON.stringify(c.where) === JSON.stringify(where))
    .reduce((n, c) => n + c.quantity, 0);

describe('the Inventory pass guard (Q7, Q44, Q45)', () => {
  // The panel already used one Tonic; two are left.
  const tonics = () => [instance('t', tonicRef, you, 2)];

  it('drops a use that reports a shown use, and logs it', () => {
    const result = run(tonics(), [op('use', 'Tonic', { owner: 'you', after: 'used up' })], sent([used]));
    expect(held(result.instances, 'tonic', you)).toBe(2);
    expect(result.ops).toEqual([]);
    expect(result.diagnostics).toContain('Inventory (pass) skipped use "Tonic": the player already did it');
  });

  it('lands a second use beyond the shown count', () => {
    const twoOps = run(tonics(), [op('use', 'Tonic', { owner: 'you', after: 'used up' }), op('use', 'Tonic', { owner: 'Ash', after: 'used up' })], sent([used]));
    expect(held(twoOps.instances, 'tonic', you)).toBe(1);
    const oneOp = run(tonics(), [op('use', 'Tonic', { owner: 'you', quantity: 2, after: 'used up' })], sent([used]));
    expect(held(oneOp.instances, 'tonic', you)).toBe(1);
    expect(oneOp.ops).toEqual([op('use', 'Tonic', { owner: 'you', quantity: 1, after: 'used up' })]);
    expect(oneOp.diagnostics).toContain('Inventory (pass) skipped 1 of 2 of use "Tonic": the player already did it');
  });

  it('guards as many uses as the entry repeats', () => {
    const result = run(tonics(), [op('use', 'Tonic', { owner: 'you', quantity: 2, after: 'used up' })], sent([used, used]));
    expect(held(result.instances, 'tonic', you)).toBe(2);
  });

  it('drops nothing for a hidden entry (Q21)', () => {
    const result = run(tonics(), [op('use', 'Tonic', { owner: 'you', after: 'used up' })], sent([used], [0]));
    expect(held(result.instances, 'tonic', you)).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });

  it('guards nothing for another owner or another item', () => {
    const instances = [...tonics(), instance('m', tonicRef, mara), instance('c', coinRef, you)];
    const result = run(instances, [op('use', 'Tonic', { owner: 'Mara', after: 'used up' }), op('use', 'Coin', { owner: 'you', after: 'used up' })], sent([used]));
    expect([held(result.instances, 'tonic', mara), held(result.instances, 'coin', you)]).toEqual([0, 0]);
  });

  it('drops a transfer, gain or lose that reports a shown give, to that receiver only', () => {
    const gave: ListedActionFacts = { kind: 'give', item: { key: 'item:coin', name: 'Coin' }, quantity: 2, to: { id: 'mara', name: 'Mara' } };
    const coins = () => [instance('c', coinRef, you, 5), instance('cm', coinRef, mara, 2)];
    for (const reply of [op('transfer', 'Coin', { owner: 'you', to: 'Mara', quantity: 2 }), op('gain', 'Coin', { owner: 'you', to: 'Mara', quantity: 2 }), op('lose', 'Coin', { owner: 'you', quantity: 2 })]) {
      const result = run(coins(), [reply], sent([gave]));
      expect([reply.op, held(result.instances, 'coin', you)]).toEqual([reply.op, 5]);
    }
    const toBram = run(coins(), [op('transfer', 'Coin', { owner: 'you', to: 'Bram', quantity: 2 })], sent([gave]));
    expect(held(toBram.instances, 'coin', you)).toBe(3);
  });

  it('drops a move to this place that reports a shown drop, and a take from it that reports a pick up', () => {
    const dropped: ListedActionFacts = { kind: 'drop', item: { key: 'item:coin', name: 'Coin' }, quantity: 1, place: 'cellar' };
    const afterDrop = run([instance('c', coinRef, you, 2), instance('cc', coinRef, cellar)], [op('transfer', 'Coin', { owner: 'you', to: 'here' })], sent([dropped]));
    expect(held(afterDrop.instances, 'coin', you)).toBe(2);
    const picked: ListedActionFacts = { kind: 'pickup', item: { key: 'item:coin', name: 'Coin' }, quantity: 1, place: 'cellar' };
    for (const reply of [op('gain', 'Coin', { owner: 'Cellar', to: 'you' }), op('gain', 'Coin', { to: 'you' }), op('transfer', 'Coin', { owner: 'here', to: 'you' })]) {
      const result = run([instance('c', coinRef, you, 1), instance('cc', coinRef, cellar)], [reply], sent([picked]));
      expect([reply, held(result.instances, 'coin', you)]).toEqual([reply, 1]);
    }
    // A character handing the player one is not the pick up.
    const handed = run([instance('c', coinRef, you, 1), instance('cm', coinRef, mara)], [op('gain', 'Coin', { owner: 'Mara', to: 'you' })], sent([picked]));
    expect(held(handed.instances, 'coin', you)).toBe(2);
  });

  it('drops an equip or unequip that reports a shown one', () => {
    const worn = (): ItemInstance[] => [{ ...instance('t', tonicRef, you), equipped: { slotId: 'hand', order: 0 } }];
    const unequipped: ListedActionFacts = { kind: 'unequip', item: { key: 'item:tonic', name: 'Tonic' }, copyId: 't' };
    const reply = [op('unequip', 'Tonic', { owner: 'you' })];
    expect(run(worn(), reply, sent([unequipped])).instances[0].equipped).toBeTruthy();
    expect(run(worn(), reply, []).instances[0].equipped).toBeFalsy();
    const equipped: ListedActionFacts = { kind: 'equip', item: { key: 'item:tonic', name: 'Tonic' }, copyId: 't' };
    const result = run(tonics(), [op('equip', 'Tonic', { owner: 'you' })], sent([equipped]));
    expect([result.ops, result.diagnostics]).toEqual([[], ['Inventory (pass) skipped equip "Tonic": the player already did it']]);
  });

  it('matches a runtime item by its name', () => {
    const lit: ListedActionFacts = { kind: 'use', item: { key: 'runtime:rt-lantern', name: 'Lantern' }, copyId: 'l' };
    const result = run([instance('l', { kind: 'runtime', runtimeItemId: 'rt-lantern' }, you)], [op('use', 'lantern', { owner: 'you', after: 'used up' })], sent([lit]));
    expect(result.instances).toHaveLength(1);
    expect(result.ops).toEqual([]);
  });

  it('never guards a stat, trait, travel or persona entry', () => {
    const others = sent([
      { kind: 'travel', from: null, to: { id: 'cellar', name: 'Cellar' } },
      { kind: 'trait', trait: { id: 'tonic', name: 'Tonic' }, owner: null, enabled: true },
    ]);
    const result = run(tonics(), [op('use', 'Tonic', { owner: 'you', after: 'used up' })], others);
    expect(held(result.instances, 'tonic', you)).toBe(1);
  });
});
