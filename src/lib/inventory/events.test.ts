import { describe, expect, it } from 'vitest';
import { bodyFixture } from '@/test/bodyFixture';
import { applyInventoryOps, type InventoryCall, type InventoryOp } from '.';
import type { Item, ItemInstance } from '@/types';

const item = (id: string, over: Partial<Item> = {}): Item =>
  ({ id, name: id, statEffects: [], traitEffects: [], equipRequires: [], ...over });

const potion = item('potion', { uses: 1 });
const ring = item('ring', { stackable: false, slotRule: { mode: 'either', slotIds: ['finger'] } });
const wand = item('wand', { uses: 3, whenEmpty: { kind: 'stays' } });
const you = { kind: 'you' } as const;
const bram = { kind: 'entity', id: 'bram' } as const;
const cellar = { kind: 'location', id: 'cellar' } as const;

const instance = (id: string, itemId: string, over: Partial<ItemInstance> = {}): ItemInstance =>
  ({ id, item: { kind: 'item', itemId }, where: you, quantity: 1, visibility: 'visible', ...over });

const call = (source: InventoryCall['source'] = 'script'): InventoryCall => {
  let i = 0;
  return { world: { items: [potion, ring, wand], slots: [{ id: 'finger', name: 'Finger' }], bodies: [bodyFixture({ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'finger' }] })] }, source, newId: () => `n${i++}` };
};
const events = (instances: ItemInstance[], ops: InventoryOp[], source?: InventoryCall['source']) =>
  applyInventoryOps(instances, ops, call(source)).events.map(({ timing, instanceId, where, quantity }) => [timing, instanceId, where, quantity]);

describe('applyInventoryOps events (Q33, Q134–Q140)', () => {
  it('fires When Gained at the owner, on the stack the gain merged into', () => {
    expect(events([instance('a', 'potion', { quantity: 2 })], [{ kind: 'gain', itemId: 'potion', quantity: 3, to: you }]))
      .toEqual([['gained', 'a', you, 3]]);
    expect(events([], [{ kind: 'gain', itemId: 'ring', quantity: 2, to: cellar }])).toEqual([['gained', 'n0', cellar, 2]]);
  });

  it('fires When Lost then When Gained for a move, and When Unequipped first for an equipped instance', () => {
    const worn = instance('r', 'ring', { equipped: { slotId: 'finger', order: 1 } });
    expect(events([worn], [{ kind: 'transfer', instanceId: 'r', to: cellar }]))
      .toEqual([['unequipped', 'r', you, 1], ['lost', 'r', you, 1], ['gained', 'r', cellar, 1]]);
    expect(events([instance('a', 'potion', { quantity: 4 })], [{ kind: 'lose', instanceId: 'a', quantity: 3 }])).toEqual([['lost', 'a', you, 3]]);
  });

  it('fires When Equipped on the instance split off a stack, and When Unequipped for a swap-out', () => {
    const stack = instance('s', 'ring', { quantity: 1 });
    const worn = instance('w', 'ring', { equipped: { slotId: 'finger', order: 1 } });
    expect(events([stack, worn], [{ kind: 'equip', instanceId: 's' }]))
      .toEqual([['unequipped', 'w', you, 1], ['equipped', 's', you, 1]]);
    expect(events([instance('p', 'ring', { quantity: 2 })], [{ kind: 'equip', instanceId: 'p' }])).toEqual([['equipped', 'n0', you, 1]]);
  });

  it('fires When Used only, even for the last use, and nothing for reveal or set uses', () => {
    expect(events([instance('a', 'potion')], [{ kind: 'use', instanceId: 'a' }])).toEqual([['used', 'a', you, 1]]);
    expect(events([instance('h', 'potion', { visibility: 'hidden' })], [{ kind: 'reveal', instanceId: 'h' }])).toEqual([]);
    expect(events([instance('w', 'wand', { state: { uses: 1 } })], [{ kind: 'setUses', instanceId: 'w', uses: 3 }])).toEqual([]);
  });

  it('fires When Used on the used instance and When Gained on its Becomes result, never When Lost (Q28)', () => {
    const flask = item('flask', { uses: 1, whenEmpty: { kind: 'becomes', itemId: 'wand' } });
    const world = { items: [flask, wand] };
    let i = 0;
    const result = applyInventoryOps([instance('f', 'flask')], [{ kind: 'use', instanceId: 'f' }], { world, source: 'panel', newId: () => `n${i++}` });
    expect(result.events.map((e) => [e.timing, e.itemId, e.instanceId])).toEqual([['used', 'flask', 'f'], ['gained', 'wand', 'n0']]);
  });

  it('fires nothing for a runtime item or a skipped operation', () => {
    const runtime: ItemInstance = { id: 'x', item: { kind: 'runtime', runtimeItemId: 'rt' }, where: bram, quantity: 1, visibility: 'visible' };
    expect(events([runtime], [{ kind: 'lose', instanceId: 'x' }])).toEqual([]);
    expect(events([], [{ kind: 'lose', instanceId: 'missing' }])).toEqual([]);
  });
});

describe('applyInventoryOps setUses (Q41, Q47)', () => {
  it('recharges an Item Instance within the item’s maximum', () => {
    const empty = instance('w', 'wand', { state: { uses: 0 } });
    const set = (uses: number) => applyInventoryOps([empty], [{ kind: 'setUses', instanceId: 'w', uses }], call()).instances[0].state;
    expect(set(2)).toEqual({ uses: 2 });
    expect(set(9)).toEqual({ uses: 3 });
    expect(set(-1)).toEqual({ uses: 0 });
  });

  it('skips an item with no Uses with a diagnostic', () => {
    const result = applyInventoryOps([instance('a', 'ring')], [{ kind: 'setUses', instanceId: 'a', uses: 2 }], call());
    expect(result.diagnostics).toEqual(['Inventory (script) skipped setUses: Item Instance a has no Uses']);
  });

  it('lets a script remove a Bound Item Instance the panel cannot (Q58)', () => {
    const bound = { world: { items: [item('seal', { bound: true })] } };
    const held = [instance('b', 'seal')];
    expect(applyInventoryOps(held, [{ kind: 'lose', instanceId: 'b' }], { ...call('script'), ...bound }).instances).toEqual([]);
    expect(applyInventoryOps(held, [{ kind: 'lose', instanceId: 'b' }], { ...call('panel'), ...bound }).instances).toEqual(held);
  });
});
