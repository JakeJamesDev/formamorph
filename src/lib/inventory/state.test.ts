import { beforeEach, describe, expect, it } from 'vitest';
import { applyInventoryOps, seedItemCopies, type InventoryOp } from '.';
import type { Item, ItemCopy, RuntimeItem } from '@/types';

const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...over });

const letter = item('letter', 'Letter', { uses: 1, whenEmpty: { kind: 'changesState', state: ' opened ' }, state: 'sealed' });
const lantern = item('lantern', 'Lantern', { state: 'unlit' });
const cloak = item('cloak', 'Cloak');
const potion = item('potion', 'Potion', { uses: 1, whenEmpty: { kind: 'becomes', itemId: 'bottle' } });
const bottle = item('bottle', 'Bottle', { state: 'empty' });
const items = [letter, lantern, cloak, potion, bottle];
const cake: RuntimeItem = { id: 'cake', name: 'Honey Cake' };

const hero = { kind: 'you' } as const;
const room = { kind: 'location', id: 'room' } as const;

let n = 0;
beforeEach(() => { n = 0; });
function run(copies: readonly ItemCopy[], ops: InventoryOp[]) {
  return applyInventoryOps(copies, ops, { world: { items }, source: 'pass', newId: () => `n${n++}`, runtimeItems: [cake] });
}
const gain = (itemId: string, quantity = 1, to: ItemCopy['where'] = hero): InventoryOp => ({ kind: 'gain', itemId, quantity, to });
const change = (copyId: string, state: string): InventoryOp => ({ kind: 'change', copyId, state });
const rows = (copies: readonly ItemCopy[]) => copies.map((c) => ({ quantity: c.quantity, state: c.state?.state, uses: c.state?.uses }));

describe('seeding State', () => {
  it('starts each placed and gained copy with its item’s State, and none for an item without one', () => {
    const seeded = seedItemCopies({
      items, placements: [{ id: 'p1', source: { kind: 'item', itemId: 'lantern' }, where: hero, quantity: 2 }, { id: 'p2', source: { kind: 'item', itemId: 'cloak' }, where: hero, quantity: 1 }],
    }, undefined, () => 's');
    expect(seeded.map((c) => c.state)).toEqual([{ state: 'unlit' }, undefined]);
    const { copies } = run([], [gain('letter'), gain('cake')]);
    expect(copies.map((c) => c.state)).toEqual([{ state: 'sealed' }, undefined]);
  });
});

describe('change', () => {
  it('sets the State of a lone copy in place', () => {
    const { copies } = run([], [gain('cloak'), change('n0', 'soaked')]);
    expect(copies).toMatchObject([{ id: 'n0', quantity: 1, state: { state: 'soaked' } }]);
  });

  it('splits one copy off a stack, then merges it into a stack it now matches', () => {
    const { copies: lit } = run([], [gain('lantern', 3), change('n0', 'lit')]);
    expect(rows(lit)).toEqual([{ quantity: 2, state: 'unlit', uses: undefined }, { quantity: 1, state: 'lit', uses: undefined }]);
    const { copies } = run(lit, [change(lit[0].id, 'lit')]);
    expect(rows(copies)).toEqual([{ quantity: 1, state: 'unlit', uses: undefined }, { quantity: 2, state: 'lit', uses: undefined }]);
  });

  it('stacks States that differ only in case and spaces, keeping the text the stack had', () => {
    const { copies: lit } = run([], [gain('lantern', 2), change('n0', 'lit')]);
    const { copies } = run(lit, [change(lit[0].id, '  LIT ')]);
    expect(rows(copies)).toEqual([{ quantity: 2, state: 'lit', uses: undefined }]);
  });

  it('never stacks copies of one item with different States', () => {
    const { copies } = run([], [gain('lantern'), change('n0', 'lit'), gain('lantern')]);
    expect(rows(copies)).toEqual([{ quantity: 1, state: 'lit', uses: undefined }, { quantity: 1, state: 'unlit', uses: undefined }]);
  });

  it('clears the State with a blank word, merging into a stack that has none', () => {
    const { copies: soaked } = run([], [gain('cloak', 2), change('n0', 'soaked')]);
    const { copies } = run(soaked, [change(soaked[1].id, '   ')]);
    expect(copies).toEqual([{ id: 'n0', item: { kind: 'item', itemId: 'cloak' }, where: hero, quantity: 2, visibility: 'visible' }]);
  });

  it('skips a change to the State the copy already has, in any case', () => {
    const { copies, diagnostics } = run([], [gain('lantern'), change('n0', 'Unlit')]);
    expect(rows(copies)).toEqual([{ quantity: 1, state: 'unlit', uses: undefined }]);
    expect(diagnostics).toEqual(['Inventory (pass) skipped change: Item Copy n0 is already Unlit']);
  });

  it('changes a runtime copy, a hidden copy and a copy lying at a location', () => {
    const { copies } = run([], [
      gain('cake'), { kind: 'gain', itemId: 'cloak', quantity: 1, to: hero, visibility: 'hidden' }, gain('cloak', 1, room),
      change('n0', 'stale'), change('n1', 'torn'), change('n2', 'soaked'),
    ]);
    expect(copies.map((c) => c.state?.state)).toEqual(['stale', 'torn', 'soaked']);
  });

  it('fires no script event', () => {
    expect(run([], [gain('lantern'), change('n0', 'lit')]).events.map((e) => e.timing)).toEqual(['gained']);
  });
});

describe('Changes State', () => {
  it('sets the State word on the last use and keeps the copy at zero uses, which refuses another use', () => {
    const { copies: opened } = run([], [gain('letter', 2), { kind: 'use', copyId: 'n0' }]);
    expect(rows(opened)).toEqual([{ quantity: 1, state: 'sealed', uses: undefined }, { quantity: 1, state: 'opened', uses: 0 }]);
    const { diagnostics } = run(opened, [{ kind: 'use', copyId: opened[1].id }]);
    expect(diagnostics).toEqual([`Inventory (pass) skipped use: Item Copy ${opened[1].id} has no uses left`]);
  });

  it('seeds a Becomes result with its own starting State', () => {
    const { copies } = run([], [gain('potion'), { kind: 'use', copyId: 'n0' }]);
    expect(copies).toMatchObject([{ item: { itemId: 'bottle' }, state: { state: 'empty' } }]);
  });
});
