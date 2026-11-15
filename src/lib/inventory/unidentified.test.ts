import { describe, expect, it } from 'vitest';
import { applyInventoryOps, applyInventoryPass, seedItemInstances, settleItemEffects, itemEffectLog, type InventoryCall, type PassScene } from '.';
import type { EntityStatValues, InventoryPassOp, Item, ItemInstance, PlayerStat } from '@/types';

const item = (id: string, over: Partial<Item> = {}): Item =>
  ({ id, name: id, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const ids = () => { let i = 0; return () => `n${i++}`; };
const you = { kind: 'you' } as const;
const cellar = { kind: 'location', id: 'cellar' } as const;
const instance = (id: string, itemId: string, over: Partial<ItemInstance> = {}): ItemInstance =>
  ({ id, item: { kind: 'item', itemId }, where: you, quantity: 1, visibility: 'visible', ...over });
const unknown = { state: { unidentified: true as const } };

const ring = item('ring', { name: 'Ring of Curses', unidentifiedName: 'Plain Ring', unidentifiedDescription: 'A dull band.' });
const vial = item('vial', { name: 'Elixir', unidentifiedDescription: 'A cloudy vial.' });
const coin = item('coin', { name: 'Coin' });
const call = (over: Partial<InventoryCall> = {}): InventoryCall => ({ world: { items: [ring, vial, coin] }, source: 'pass', newId: ids(), ...over });

describe('unidentified Item Instances', () => {
  it('seeds every instance of an item with an unidentified field unidentified, hidden ones included (Q15, Q16)', () => {
    const instances = seedItemInstances({
      items: [ring, vial, coin],
      placements: [
        { id: 'p1', where: you, quantity: 2, source: { kind: 'item', itemId: 'ring' } },
        { id: 'p2', where: you, quantity: 1, hidden: true, source: { kind: 'item', itemId: 'vial' } },
        { id: 'p3', where: you, quantity: 1, source: { kind: 'item', itemId: 'coin' } },
      ],
    }, undefined, ids());
    expect(instances.map((c) => [c.item.kind === 'item' && c.item.itemId, c.visibility, c.state])).toEqual([
      ['ring', 'visible', { unidentified: true }], ['vial', 'hidden', { unidentified: true }], ['coin', 'visible', undefined],
    ]);
  });

  it('gains new instances unidentified, and never stacks them with identified ones (Q18)', () => {
    const { instances } = applyInventoryOps([instance('a', 'ring', { quantity: 2 })], [{ kind: 'gain', itemId: 'ring', quantity: 1, to: you }], call());
    expect(instances.map((c) => [c.id, c.quantity, c.state])).toEqual([['a', 2, undefined], ['n0', 1, { unidentified: true }]]);
  });

  it('keeps the flag through a transfer', () => {
    const { instances } = applyInventoryOps([instance('a', 'ring', unknown)], [{ kind: 'transfer', copyId: 'a', to: cellar }], call());
    expect(instances).toEqual([instance('a', 'ring', { where: cellar, ...unknown })]);
  });

  it('identifies a visible unidentified instance and merges it into the identified stack in the same place', () => {
    const { instances, diagnostics } = applyInventoryOps(
      [instance('a', 'ring', { quantity: 2 }), instance('b', 'ring', unknown)], [{ kind: 'reveal', copyId: 'b' }], call(),
    );
    expect(diagnostics).toEqual([]);
    expect(instances).toEqual([instance('a', 'ring', { quantity: 3 })]);
  });

  it('identifies part of a stack, which splits off as its own identified row', () => {
    const { instances } = applyInventoryOps([instance('a', 'ring', { quantity: 3, ...unknown })], [{ kind: 'reveal', copyId: 'a', quantity: 1 }], call());
    expect(instances.map((c) => [c.id, c.quantity, c.state])).toEqual([['a', 2, { unidentified: true }], ['n0', 1, undefined]]);
  });

  it('keeps other state when it identifies an instance', () => {
    const wand = item('wand', { uses: 3, unidentifiedName: 'Stick' });
    const { instances } = applyInventoryOps(
      [instance('w', 'wand', { state: { uses: 2, unidentified: true } })], [{ kind: 'reveal', copyId: 'w' }], call({ world: { items: [wand] } }),
    );
    expect(instances).toEqual([instance('w', 'wand', { state: { uses: 2 } })]);
  });

  it('shows a hidden unidentified instance first and identifies it on a second reveal (Q8)', () => {
    const start = [instance('a', 'ring', { visibility: 'hidden', ...unknown })];
    const once = applyInventoryOps(start, [{ kind: 'reveal', copyId: 'a' }], call()).instances;
    expect(once).toEqual([instance('a', 'ring', unknown)]);
    expect(applyInventoryOps(once, [{ kind: 'reveal', copyId: 'a' }], call()).instances).toEqual([instance('a', 'ring')]);
  });

  it('skips a reveal of an instance that is neither hidden nor unidentified', () => {
    const { instances, diagnostics } = applyInventoryOps([instance('a', 'ring')], [{ kind: 'reveal', copyId: 'a' }], call());
    expect(diagnostics).toHaveLength(1);
    expect(instances).toEqual([instance('a', 'ring')]);
  });
});

describe('unidentified effects and log', () => {
  const str: PlayerStat = { id: 'str', name: 'Strength', type: 'number', description: '', min: 0, max: 20, value: 10, regen: 0, descriptors: [] };
  const cursed = { ...ring, statEffects: [{ id: 'r1', statId: 'str', facet: 'value' as const, timing: 'owned' as const, amount: -2, op: 'add' as const }] };
  const stats: EntityStatValues = { ash: [str] };
  const settle = (instances: ItemInstance[]) => settleItemEffects(
    { instances, entityStats: stats, ledger: undefined }, { items: [cursed], persona: { source: 'world', entityId: 'ash' }, entities: [{ id: 'ash' }] }, () => [],
  );

  it('applies the effects of an unidentified item and logs them under its unidentified name (Q17)', () => {
    const result = settle([instance('a', 'ring', unknown)]);
    expect(result.entityStats.ash[0].value).toBe(8);
    expect(itemEffectLog(result)).toEqual(['Plain Ring: Strength -2']);
  });

  it('logs the true name once any instance behind the source is identified', () => {
    expect(itemEffectLog(settle([instance('a', 'ring', unknown), instance('b', 'ring', { where: you })]))).toEqual(['Ring of Curses: Strength -2']);
  });

  it('keeps the unidentified face while the only identified instance is hidden, and names no item when all are hidden (Q39)', () => {
    expect(itemEffectLog(settle([instance('h', 'ring', { visibility: 'hidden' }), instance('a', 'ring', unknown)]))).toEqual(['Plain Ring: Strength -2']);
    expect(itemEffectLog(settle([instance('h', 'ring', { visibility: 'hidden' }), instance('a', 'ring', { visibility: 'hidden', ...unknown })])))
      .toEqual(['An item: Strength -2']);
  });

  it('names a missing stat by the face the player sees', () => {
    const noStat = settleItemEffects(
      { instances: [instance('a', 'ring', unknown)], entityStats: { ash: [] }, ledger: undefined },
      { items: [cursed], persona: { source: 'world', entityId: 'ash' }, entities: [{ id: 'ash' }] }, () => [],
    );
    expect(noStat.diagnostics).toEqual(['Item Plain Ring: owner ash has no stat str']);
  });
});

describe('the pass names an unidentified item by either face', () => {
  const item2 = item('ring2', { name: 'Ring of Luck', unidentifiedName: 'Plain Ring' });
  const scene = (items: Item[]): PassScene => ({ items, runtimeItems: [], playerNames: [], owners: [], location: { id: 'cellar', name: 'Cellar' } });
  const op = (kind: InventoryPassOp['op'], name: string, over: Partial<InventoryPassOp> = {}): InventoryPassOp =>
    ({ op: kind, item: name, quantity: 1, owner: 'you', to: '', state: '', ...over });
  const pass = (instances: ItemInstance[], ops: InventoryPassOp[], items: Item[] = [ring, coin]) =>
    applyInventoryPass(instances, ops, scene(items), { world: { items }, newId: ids() });

  it('resolves the unidentified name to an unidentified instance, and the true name too', () => {
    const start = [instance('a', 'ring', unknown)];
    expect(pass(start, [op('lose', 'plain ring')]).instances).toEqual([]);
    expect(pass(start, [op('lose', 'Ring of Curses')]).instances).toEqual([]);
  });

  it('never resolves the unidentified name to an identified instance', () => {
    const { instances, diagnostics } = pass([instance('a', 'ring')], [op('lose', 'Plain Ring')]);
    expect(instances).toEqual([instance('a', 'ring')]);
    expect(diagnostics).toHaveLength(1);
  });

  it('identifies a visible unidentified instance on a reveal', () => {
    expect(pass([instance('a', 'ring', unknown)], [op('reveal', 'Plain Ring')]).instances).toEqual([instance('a', 'ring')]);
  });

  it('gains the one authored item that carries an unidentified name, unidentified (Q43)', () => {
    const { instances, runtimeItems } = pass([], [op('gain', 'Plain Ring', { owner: '', to: 'you' })]);
    expect(runtimeItems).toEqual([]);
    expect(instances).toEqual([instance('n0', 'ring', unknown)]);
  });

  it('makes a runtime item when several authored items share the unidentified name (Q43)', () => {
    const { instances, runtimeItems } = pass([], [op('gain', 'Plain Ring', { owner: '', to: 'you' })], [ring, item2]);
    expect(runtimeItems.map((r) => r.name)).toEqual(['Plain Ring']);
    expect(instances[0].item.kind).toBe('runtime');
  });
});
