import { describe, expect, it } from 'vitest';
import { applyInventoryOps, type InventoryCall, type InventoryOp } from '.';
import type { Item, ItemCopy } from '@/types';

const item = (id: string, over: Partial<Item> = {}): Item =>
  ({ id, name: id, statEffects: [], traitEffects: [], equipRequires: [], ...over });

const potion = item('potion', { consumable: true });
const ring = item('ring', { stackable: false, slotId: 'finger' });
const wand = item('wand', { charges: 3 });
const you = { kind: 'you' } as const;
const bram = { kind: 'entity', id: 'bram' } as const;
const cellar = { kind: 'location', id: 'cellar' } as const;

const copy = (id: string, itemId: string, over: Partial<ItemCopy> = {}): ItemCopy =>
  ({ id, item: { kind: 'item', itemId }, where: you, quantity: 1, visibility: 'visible', ...over });

const call = (source: InventoryCall['source'] = 'script'): InventoryCall => {
  let i = 0;
  return { world: { items: [potion, ring, wand], slots: [{ id: 'finger', name: 'Finger' }] }, source, newId: () => `n${i++}` };
};
const events = (copies: ItemCopy[], ops: InventoryOp[], source?: InventoryCall['source']) =>
  applyInventoryOps(copies, ops, call(source)).events.map(({ timing, copyId, where, quantity }) => [timing, copyId, where, quantity]);

describe('applyInventoryOps events (Q33, Q134–Q140)', () => {
  it('fires When Gained at the owner, on the stack the gain merged into', () => {
    expect(events([copy('a', 'potion', { quantity: 2 })], [{ kind: 'gain', itemId: 'potion', quantity: 3, to: you }]))
      .toEqual([['gained', 'a', you, 3]]);
    expect(events([], [{ kind: 'gain', itemId: 'ring', quantity: 2, to: cellar }])).toEqual([['gained', 'n0', cellar, 2]]);
  });

  it('fires When Lost then When Gained for a move, and When Unequipped first for an equipped copy', () => {
    const worn = copy('r', 'ring', { equipped: { slotId: 'finger', order: 1 } });
    expect(events([worn], [{ kind: 'transfer', copyId: 'r', to: cellar }]))
      .toEqual([['unequipped', 'r', you, 1], ['lost', 'r', you, 1], ['gained', 'r', cellar, 1]]);
    expect(events([copy('a', 'potion', { quantity: 4 })], [{ kind: 'lose', copyId: 'a', quantity: 3 }])).toEqual([['lost', 'a', you, 3]]);
  });

  it('fires When Equipped on the copy split off a stack, and When Unequipped for a swap-out', () => {
    const stack = copy('s', 'ring', { quantity: 1 });
    const worn = copy('w', 'ring', { equipped: { slotId: 'finger', order: 1 } });
    expect(events([stack, worn], [{ kind: 'equip', copyId: 's' }]))
      .toEqual([['unequipped', 'w', you, 1], ['equipped', 's', you, 1]]);
    expect(events([copy('p', 'ring', { quantity: 2 })], [{ kind: 'equip', copyId: 'p' }])).toEqual([['equipped', 'n0', you, 1]]);
  });

  it('fires When Consumed only, even for the last dose, and nothing for reveal or set charges', () => {
    expect(events([copy('a', 'potion')], [{ kind: 'consume', copyId: 'a' }])).toEqual([['consumed', 'a', you, 1]]);
    expect(events([copy('h', 'potion', { visibility: 'hidden' })], [{ kind: 'reveal', copyId: 'h' }])).toEqual([]);
    expect(events([copy('w', 'wand', { state: { charges: 1 } })], [{ kind: 'setCharges', copyId: 'w', charges: 3 }])).toEqual([]);
  });

  it('fires nothing for a runtime item or a skipped operation', () => {
    const runtime: ItemCopy = { id: 'x', item: { kind: 'runtime', runtimeItemId: 'rt' }, where: bram, quantity: 1, visibility: 'visible' };
    expect(events([runtime], [{ kind: 'lose', copyId: 'x' }])).toEqual([]);
    expect(events([], [{ kind: 'lose', copyId: 'missing' }])).toEqual([]);
  });
});

describe('applyInventoryOps setCharges (Q41, Q47)', () => {
  it('recharges an Item Copy within the item’s maximum', () => {
    const empty = copy('w', 'wand', { state: { charges: 0 } });
    const set = (charges: number) => applyInventoryOps([empty], [{ kind: 'setCharges', copyId: 'w', charges }], call()).copies[0].state;
    expect(set(2)).toEqual({ charges: 2 });
    expect(set(9)).toEqual({ charges: 3 });
    expect(set(-1)).toEqual({ charges: 0 });
  });

  it('skips an item with no charges with a diagnostic', () => {
    const result = applyInventoryOps([copy('a', 'potion')], [{ kind: 'setCharges', copyId: 'a', charges: 2 }], call());
    expect(result.diagnostics).toEqual(['Inventory (script) skipped setCharges: Item Copy a has no charges']);
  });

  it('lets a script remove a Bound Item Copy the panel cannot (Q58)', () => {
    const bound = { world: { items: [item('seal', { bound: true })] } };
    const held = [copy('b', 'seal')];
    expect(applyInventoryOps(held, [{ kind: 'lose', copyId: 'b' }], { ...call('script'), ...bound }).copies).toEqual([]);
    expect(applyInventoryOps(held, [{ kind: 'lose', copyId: 'b' }], { ...call('panel'), ...bound }).copies).toEqual(held);
  });
});
