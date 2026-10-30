import { describe, expect, it } from 'vitest';
import { applyInventoryOps, applyInventoryPass, seedItemCopies, settleItemEffects, itemEffectLog, type InventoryCall, type PassScene } from '.';
import type { EntityStatValues, InventoryPassOp, Item, ItemCopy, PlayerStat } from '@/types';

const item = (id: string, over: Partial<Item> = {}): Item =>
  ({ id, name: id, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const ids = () => { let i = 0; return () => `n${i++}`; };
const you = { kind: 'you' } as const;
const cellar = { kind: 'location', id: 'cellar' } as const;
const copy = (id: string, itemId: string, over: Partial<ItemCopy> = {}): ItemCopy =>
  ({ id, item: { kind: 'item', itemId }, where: you, quantity: 1, visibility: 'visible', ...over });
const unknown = { state: { unidentified: true as const } };

const ring = item('ring', { name: 'Ring of Curses', unidentifiedName: 'Plain Ring', unidentifiedDescription: 'A dull band.' });
const vial = item('vial', { name: 'Elixir', unidentifiedDescription: 'A cloudy vial.' });
const coin = item('coin', { name: 'Coin' });
const call = (over: Partial<InventoryCall> = {}): InventoryCall => ({ world: { items: [ring, vial, coin] }, source: 'pass', newId: ids(), ...over });

describe('unidentified Item Copies', () => {
  it('seeds every copy of an item with an unidentified field unidentified, hidden ones included (Q15, Q16)', () => {
    const copies = seedItemCopies({
      items: [ring, vial, coin],
      placements: [
        { id: 'p1', where: you, quantity: 2, source: { kind: 'item', itemId: 'ring' } },
        { id: 'p2', where: you, quantity: 1, hidden: true, source: { kind: 'item', itemId: 'vial' } },
        { id: 'p3', where: you, quantity: 1, source: { kind: 'item', itemId: 'coin' } },
      ],
    }, undefined, ids());
    expect(copies.map((c) => [c.item.kind === 'item' && c.item.itemId, c.visibility, c.state])).toEqual([
      ['ring', 'visible', { unidentified: true }], ['vial', 'hidden', { unidentified: true }], ['coin', 'visible', undefined],
    ]);
  });

  it('gains new copies unidentified, and never stacks them with identified ones (Q18)', () => {
    const { copies } = applyInventoryOps([copy('a', 'ring', { quantity: 2 })], [{ kind: 'gain', itemId: 'ring', quantity: 1, to: you }], call());
    expect(copies.map((c) => [c.id, c.quantity, c.state])).toEqual([['a', 2, undefined], ['n0', 1, { unidentified: true }]]);
  });

  it('keeps the flag through a transfer', () => {
    const { copies } = applyInventoryOps([copy('a', 'ring', unknown)], [{ kind: 'transfer', copyId: 'a', to: cellar }], call());
    expect(copies).toEqual([copy('a', 'ring', { where: cellar, ...unknown })]);
  });

  it('identifies a visible unidentified copy and merges it into the identified stack in the same place', () => {
    const { copies, diagnostics } = applyInventoryOps(
      [copy('a', 'ring', { quantity: 2 }), copy('b', 'ring', unknown)], [{ kind: 'reveal', copyId: 'b' }], call(),
    );
    expect(diagnostics).toEqual([]);
    expect(copies).toEqual([copy('a', 'ring', { quantity: 3 })]);
  });

  it('identifies part of a stack, which splits off as its own identified row', () => {
    const { copies } = applyInventoryOps([copy('a', 'ring', { quantity: 3, ...unknown })], [{ kind: 'reveal', copyId: 'a', quantity: 1 }], call());
    expect(copies.map((c) => [c.id, c.quantity, c.state])).toEqual([['a', 2, { unidentified: true }], ['n0', 1, undefined]]);
  });

  it('keeps other state when it identifies a copy', () => {
    const wand = item('wand', { uses: 3, unidentifiedName: 'Stick' });
    const { copies } = applyInventoryOps(
      [copy('w', 'wand', { state: { uses: 2, unidentified: true } })], [{ kind: 'reveal', copyId: 'w' }], call({ world: { items: [wand] } }),
    );
    expect(copies).toEqual([copy('w', 'wand', { state: { uses: 2 } })]);
  });

  it('shows a hidden unidentified copy first and identifies it on a second reveal (Q8)', () => {
    const start = [copy('a', 'ring', { visibility: 'hidden', ...unknown })];
    const once = applyInventoryOps(start, [{ kind: 'reveal', copyId: 'a' }], call()).copies;
    expect(once).toEqual([copy('a', 'ring', unknown)]);
    expect(applyInventoryOps(once, [{ kind: 'reveal', copyId: 'a' }], call()).copies).toEqual([copy('a', 'ring')]);
  });

  it('skips a reveal of a copy that is neither hidden nor unidentified', () => {
    const { copies, diagnostics } = applyInventoryOps([copy('a', 'ring')], [{ kind: 'reveal', copyId: 'a' }], call());
    expect(diagnostics).toHaveLength(1);
    expect(copies).toEqual([copy('a', 'ring')]);
  });
});

describe('unidentified effects and log', () => {
  const str: PlayerStat = { id: 'str', name: 'Strength', type: 'number', description: '', min: 0, max: 20, value: 10, regen: 0, descriptors: [] };
  const cursed = { ...ring, statEffects: [{ id: 'r1', statId: 'str', facet: 'value' as const, timing: 'owned' as const, amount: -2, op: 'add' as const }] };
  const stats: EntityStatValues = { ash: [str] };
  const settle = (copies: ItemCopy[]) => settleItemEffects(
    { copies, entityStats: stats, ledger: undefined }, { items: [cursed], persona: { source: 'world', entityId: 'ash' }, entities: [{ id: 'ash' }] }, () => [],
  );

  it('applies the effects of an unidentified item and logs them under its unidentified name (Q17)', () => {
    const result = settle([copy('a', 'ring', unknown)]);
    expect(result.entityStats.ash[0].value).toBe(8);
    expect(itemEffectLog(result)).toEqual(['Plain Ring: Strength -2']);
  });

  it('logs the true name once any copy behind the source is identified', () => {
    expect(itemEffectLog(settle([copy('a', 'ring', unknown), copy('b', 'ring', { where: you })]))).toEqual(['Ring of Curses: Strength -2']);
  });

  it('keeps the unidentified face while the only identified copy is hidden, and names no item when all are hidden (Q39)', () => {
    expect(itemEffectLog(settle([copy('h', 'ring', { visibility: 'hidden' }), copy('a', 'ring', unknown)]))).toEqual(['Plain Ring: Strength -2']);
    expect(itemEffectLog(settle([copy('h', 'ring', { visibility: 'hidden' }), copy('a', 'ring', { visibility: 'hidden', ...unknown })])))
      .toEqual(['An item: Strength -2']);
  });

  it('names a missing stat by the face the player sees', () => {
    const noStat = settleItemEffects(
      { copies: [copy('a', 'ring', unknown)], entityStats: { ash: [] }, ledger: undefined },
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
  const pass = (copies: ItemCopy[], ops: InventoryPassOp[], items: Item[] = [ring, coin]) =>
    applyInventoryPass(copies, ops, scene(items), { world: { items }, newId: ids() });

  it('resolves the unidentified name to an unidentified copy, and the true name too', () => {
    const start = [copy('a', 'ring', unknown)];
    expect(pass(start, [op('lose', 'plain ring')]).copies).toEqual([]);
    expect(pass(start, [op('lose', 'Ring of Curses')]).copies).toEqual([]);
  });

  it('never resolves the unidentified name to an identified copy', () => {
    const { copies, diagnostics } = pass([copy('a', 'ring')], [op('lose', 'Plain Ring')]);
    expect(copies).toEqual([copy('a', 'ring')]);
    expect(diagnostics).toHaveLength(1);
  });

  it('identifies a visible unidentified copy on a reveal', () => {
    expect(pass([copy('a', 'ring', unknown)], [op('reveal', 'Plain Ring')]).copies).toEqual([copy('a', 'ring')]);
  });

  it('gains the one authored item that carries an unidentified name, unidentified (Q43)', () => {
    const { copies, runtimeItems } = pass([], [op('gain', 'Plain Ring', { owner: '', to: 'you' })]);
    expect(runtimeItems).toEqual([]);
    expect(copies).toEqual([copy('n0', 'ring', unknown)]);
  });

  it('makes a runtime item when several authored items share the unidentified name (Q43)', () => {
    const { copies, runtimeItems } = pass([], [op('gain', 'Plain Ring', { owner: '', to: 'you' })], [ring, item2]);
    expect(runtimeItems.map((r) => r.name)).toEqual(['Plain Ring']);
    expect(copies[0].item.kind).toBe('runtime');
  });
});
