import { describe, expect, it } from 'vitest';
import { bodyFixture } from '@/test/bodyFixture';
import { applyInventoryOps, type InventoryCall } from '.';
import type { Item, ItemInstance } from '@/types';

const item = (id: string, over: Partial<Item> = {}): Item =>
  ({ id, name: id, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const ids = () => { let i = 0; return () => `n${i++}`; };
const you = { kind: 'you' } as const;
const cellar = { kind: 'location', id: 'cellar' } as const;
const instance = (id: string, itemId: string, over: Partial<ItemInstance> = {}): ItemInstance =>
  ({ id, item: { kind: 'item', itemId }, where: you, quantity: 1, visibility: 'visible', ...over });

const call = (over: Partial<InventoryCall> = {}): InventoryCall => ({
  world: { items: [item('coin'), item('ring', { stackable: false, slotRule: { mode: 'either', slotIds: ['finger'] } })], slots: [{ id: 'finger', name: 'Finger' }], bodies: [bodyFixture({ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'finger' }] })] },
  source: 'pass', newId: ids(), ...over,
});

describe('reveal', () => {
  it('makes a hidden Item Instance visible and merges it into the visible stack of the same item', () => {
    const { instances, diagnostics } = applyInventoryOps(
      [instance('a', 'coin', { quantity: 2 }), instance('b', 'coin', { quantity: 3, visibility: 'hidden' })],
      [{ kind: 'reveal', instanceId: 'b' }], call(),
    );
    expect(diagnostics).toEqual([]);
    expect(instances).toEqual([instance('a', 'coin', { quantity: 5 })]);
  });

  it('keeps hidden and visible rows of one item apart until the reveal (Q65)', () => {
    const { instances } = applyInventoryOps(
      [instance('b', 'coin', { visibility: 'hidden' })],
      [{ kind: 'gain', itemId: 'coin', quantity: 1, to: you }], call(),
    );
    expect(instances.map((c) => [c.id, c.visibility])).toEqual([['b', 'hidden'], ['n0', 'visible']]);
  });

  it('reveals part of a row and merges that part into the visible stack', () => {
    const { instances } = applyInventoryOps(
      [instance('a', 'coin'), instance('b', 'coin', { quantity: 3, visibility: 'hidden' })],
      [{ kind: 'reveal', instanceId: 'b', quantity: 2 }], call(),
    );
    expect(instances.map((c) => [c.id, c.quantity, c.visibility])).toEqual([['a', 3, 'visible'], ['b', 1, 'hidden']]);
  });

  it('reveals a hidden Item Instance lying at the present location', () => {
    const { instances } = applyInventoryOps(
      [instance('r', 'ring', { where: cellar, visibility: 'hidden' })], [{ kind: 'reveal', instanceId: 'r' }],
      call({ presence: { locationId: 'cellar', entityIds: new Set() } }),
    );
    expect(instances).toEqual([instance('r', 'ring', { where: cellar })]);
  });

  it('keeps a revealed equipped Item Instance equipped and unmerged', () => {
    const worn = { slotId: 'finger', order: 1 };
    const { instances } = applyInventoryOps(
      [instance('r', 'ring', { visibility: 'hidden', equipped: worn })], [{ kind: 'reveal', instanceId: 'r' }], call(),
    );
    expect(instances).toEqual([instance('r', 'ring', { equipped: worn })]);
  });

  it('lets a swap-out unequip a hidden equipped Item Instance, which stays hidden and carried (Q112)', () => {
    const { instances } = applyInventoryOps(
      [instance('old', 'ring', { visibility: 'hidden', equipped: { slotId: 'finger', order: 1 } }), instance('new', 'ring')],
      [{ kind: 'equip', instanceId: 'new' }], call({ source: 'panel' }),
    );
    expect(instances).toEqual([
      instance('old', 'ring', { visibility: 'hidden' }), instance('new', 'ring', { equipped: { slotId: 'finger', order: 2 } }),
    ]);
  });

  it('skips a visible Item Instance, a bad quantity and an absent location, and still applies the rest', () => {
    const { instances, diagnostics } = applyInventoryOps(
      [instance('a', 'coin'), instance('b', 'coin', { visibility: 'hidden', where: cellar }), instance('c', 'ring', { visibility: 'hidden' })],
      [{ kind: 'reveal', instanceId: 'a' }, { kind: 'reveal', instanceId: 'c', quantity: 2 }, { kind: 'reveal', instanceId: 'b' }, { kind: 'reveal', instanceId: 'c' }],
      call({ presence: { locationId: 'hall', entityIds: new Set() } }),
    );
    expect(diagnostics).toHaveLength(3);
    expect(instances.map((c) => [c.id, c.visibility])).toEqual([['a', 'visible'], ['b', 'hidden'], ['c', 'visible']]);
  });
});
