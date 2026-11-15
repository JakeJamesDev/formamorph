import { beforeEach, describe, expect, it } from 'vitest';
import { applyInventoryOps, seedItemInstances, type InventoryOp } from '.';
import type { Item, ItemInstance, RuntimeItem } from '@/types';

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
function run(instances: readonly ItemInstance[], ops: InventoryOp[]) {
  return applyInventoryOps(instances, ops, { world: { items }, source: 'pass', newId: () => `n${n++}`, runtimeItems: [cake] });
}
const gain = (itemId: string, quantity = 1, to: ItemInstance['where'] = hero): InventoryOp => ({ kind: 'gain', itemId, quantity, to });
const change = (instanceId: string, state: string): InventoryOp => ({ kind: 'change', instanceId, state });
const rows = (instances: readonly ItemInstance[]) => instances.map((c) => ({ quantity: c.quantity, state: c.state?.state, uses: c.state?.uses }));

describe('seeding State', () => {
  it('starts each placed and gained instance with its item’s State, and none for an item without one', () => {
    const seeded = seedItemInstances({
      items, placements: [{ id: 'p1', source: { kind: 'item', itemId: 'lantern' }, where: hero, quantity: 2 }, { id: 'p2', source: { kind: 'item', itemId: 'cloak' }, where: hero, quantity: 1 }],
    }, undefined, () => 's');
    expect(seeded.map((c) => c.state)).toEqual([{ state: 'unlit' }, undefined]);
    const { instances } = run([], [gain('letter'), gain('cake')]);
    expect(instances.map((c) => c.state)).toEqual([{ state: 'sealed' }, undefined]);
  });
});

describe('change', () => {
  it('sets the State of a lone instance in place', () => {
    const { instances } = run([], [gain('cloak'), change('n0', 'soaked')]);
    expect(instances).toMatchObject([{ id: 'n0', quantity: 1, state: { state: 'soaked' } }]);
  });

  it('splits one instance off a stack, then merges it into a stack it now matches', () => {
    const { instances: lit } = run([], [gain('lantern', 3), change('n0', 'lit')]);
    expect(rows(lit)).toEqual([{ quantity: 2, state: 'unlit', uses: undefined }, { quantity: 1, state: 'lit', uses: undefined }]);
    const { instances } = run(lit, [change(lit[0].id, 'lit')]);
    expect(rows(instances)).toEqual([{ quantity: 1, state: 'unlit', uses: undefined }, { quantity: 2, state: 'lit', uses: undefined }]);
  });

  it('stacks States that differ only in case and spaces, keeping the text the stack had', () => {
    const { instances: lit } = run([], [gain('lantern', 2), change('n0', 'lit')]);
    const { instances } = run(lit, [change(lit[0].id, '  LIT ')]);
    expect(rows(instances)).toEqual([{ quantity: 2, state: 'lit', uses: undefined }]);
  });

  it('never stacks instances of one item with different States', () => {
    const { instances } = run([], [gain('lantern'), change('n0', 'lit'), gain('lantern')]);
    expect(rows(instances)).toEqual([{ quantity: 1, state: 'lit', uses: undefined }, { quantity: 1, state: 'unlit', uses: undefined }]);
  });

  it('clears the State with a blank word, merging into a stack that has none', () => {
    const { instances: soaked } = run([], [gain('cloak', 2), change('n0', 'soaked')]);
    const { instances } = run(soaked, [change(soaked[1].id, '   ')]);
    expect(instances).toEqual([{ id: 'n0', item: { kind: 'item', itemId: 'cloak' }, where: hero, quantity: 2, visibility: 'visible' }]);
  });

  it('skips a change to the State the instance already has, in any case', () => {
    const { instances, diagnostics } = run([], [gain('lantern'), change('n0', 'Unlit')]);
    expect(rows(instances)).toEqual([{ quantity: 1, state: 'unlit', uses: undefined }]);
    expect(diagnostics).toEqual(['Inventory (pass) skipped change: Item Instance n0 is already Unlit']);
  });

  it('changes a runtime instance, a hidden instance and an instance lying at a location', () => {
    const { instances } = run([], [
      gain('cake'), { kind: 'gain', itemId: 'cloak', quantity: 1, to: hero, visibility: 'hidden' }, gain('cloak', 1, room),
      change('n0', 'stale'), change('n1', 'torn'), change('n2', 'soaked'),
    ]);
    expect(instances.map((c) => c.state?.state)).toEqual(['stale', 'torn', 'soaked']);
  });

  it('fires no script event', () => {
    expect(run([], [gain('lantern'), change('n0', 'lit')]).events.map((e) => e.timing)).toEqual(['gained']);
  });
});

describe('Changes State', () => {
  it('sets the State word on the last use and keeps the instance at zero uses, which refuses another use', () => {
    const { instances: opened } = run([], [gain('letter', 2), { kind: 'use', instanceId: 'n0' }]);
    expect(rows(opened)).toEqual([{ quantity: 1, state: 'sealed', uses: undefined }, { quantity: 1, state: 'opened', uses: 0 }]);
    const { diagnostics } = run(opened, [{ kind: 'use', instanceId: opened[1].id }]);
    expect(diagnostics).toEqual([`Inventory (pass) skipped use: Item Instance ${opened[1].id} has no uses left`]);
  });

  it('seeds a Becomes result with its own starting State', () => {
    const { instances } = run([], [gain('potion'), { kind: 'use', instanceId: 'n0' }]);
    expect(instances).toMatchObject([{ item: { itemId: 'bottle' }, state: { state: 'empty' } }]);
  });
});
