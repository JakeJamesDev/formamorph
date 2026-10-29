import { describe, expect, it } from 'vitest';
import { applyInventoryOps, type InventoryCall } from '.';
import type { Item, ItemCopy } from '@/types';

const item = (id: string, over: Partial<Item> = {}): Item =>
  ({ id, name: id, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const ids = () => { let i = 0; return () => `n${i++}`; };
const you = { kind: 'you' } as const;
const cellar = { kind: 'location', id: 'cellar' } as const;
const copy = (id: string, itemId: string, over: Partial<ItemCopy> = {}): ItemCopy =>
  ({ id, item: { kind: 'item', itemId }, where: you, quantity: 1, visibility: 'visible', ...over });

const call = (over: Partial<InventoryCall> = {}): InventoryCall => ({
  world: { items: [item('coin'), item('ring', { stackable: false, slotId: 'finger' })], slots: [{ id: 'finger', name: 'Finger' }] },
  source: 'pass', newId: ids(), ...over,
});

describe('reveal', () => {
  it('makes a hidden Item Copy visible and merges it into the visible stack of the same item', () => {
    const { copies, diagnostics } = applyInventoryOps(
      [copy('a', 'coin', { quantity: 2 }), copy('b', 'coin', { quantity: 3, visibility: 'hidden' })],
      [{ kind: 'reveal', copyId: 'b' }], call(),
    );
    expect(diagnostics).toEqual([]);
    expect(copies).toEqual([copy('a', 'coin', { quantity: 5 })]);
  });

  it('keeps hidden and visible rows of one item apart until the reveal (Q65)', () => {
    const { copies } = applyInventoryOps(
      [copy('b', 'coin', { visibility: 'hidden' })],
      [{ kind: 'gain', itemId: 'coin', quantity: 1, to: you }], call(),
    );
    expect(copies.map((c) => [c.id, c.visibility])).toEqual([['b', 'hidden'], ['n0', 'visible']]);
  });

  it('reveals part of a row and merges that part into the visible stack', () => {
    const { copies } = applyInventoryOps(
      [copy('a', 'coin'), copy('b', 'coin', { quantity: 3, visibility: 'hidden' })],
      [{ kind: 'reveal', copyId: 'b', quantity: 2 }], call(),
    );
    expect(copies.map((c) => [c.id, c.quantity, c.visibility])).toEqual([['a', 3, 'visible'], ['b', 1, 'hidden']]);
  });

  it('reveals a hidden Item Copy lying at the present location', () => {
    const { copies } = applyInventoryOps(
      [copy('r', 'ring', { where: cellar, visibility: 'hidden' })], [{ kind: 'reveal', copyId: 'r' }],
      call({ presence: { locationId: 'cellar', entityIds: new Set() } }),
    );
    expect(copies).toEqual([copy('r', 'ring', { where: cellar })]);
  });

  it('keeps a revealed equipped Item Copy equipped and unmerged', () => {
    const worn = { slotId: 'finger', order: 1 };
    const { copies } = applyInventoryOps(
      [copy('r', 'ring', { visibility: 'hidden', equipped: worn })], [{ kind: 'reveal', copyId: 'r' }], call(),
    );
    expect(copies).toEqual([copy('r', 'ring', { equipped: worn })]);
  });

  it('lets a swap-out unequip a hidden equipped Item Copy, which stays hidden and carried (Q112)', () => {
    const { copies } = applyInventoryOps(
      [copy('old', 'ring', { visibility: 'hidden', equipped: { slotId: 'finger', order: 1 } }), copy('new', 'ring')],
      [{ kind: 'equip', copyId: 'new' }], call({ source: 'panel' }),
    );
    expect(copies).toEqual([
      copy('old', 'ring', { visibility: 'hidden' }), copy('new', 'ring', { equipped: { slotId: 'finger', order: 2 } }),
    ]);
  });

  it('skips a visible Item Copy, a bad quantity and an absent location, and still applies the rest', () => {
    const { copies, diagnostics } = applyInventoryOps(
      [copy('a', 'coin'), copy('b', 'coin', { visibility: 'hidden', where: cellar }), copy('c', 'ring', { visibility: 'hidden' })],
      [{ kind: 'reveal', copyId: 'a' }, { kind: 'reveal', copyId: 'c', quantity: 2 }, { kind: 'reveal', copyId: 'b' }, { kind: 'reveal', copyId: 'c' }],
      call({ presence: { locationId: 'hall', entityIds: new Set() } }),
    );
    expect(diagnostics).toHaveLength(3);
    expect(copies.map((c) => [c.id, c.visibility])).toEqual([['a', 'visible'], ['b', 'hidden'], ['c', 'visible']]);
  });
});
