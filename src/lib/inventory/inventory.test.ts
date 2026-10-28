import { describe, expect, it } from 'vitest';
import { copiesAt, seedItemCopies, withoutOrphanCopies, type SeedWorld } from '.';
import type { Entity, Item, ItemCopy, Placement, PlacementWhere } from '@/types';

const item = (id: string, over: Partial<Item> = {}): Item =>
  ({ id, name: id, statEffects: [], traitEffects: [], equipRequires: [], ...over });
let n = 0;
const place = (itemId: string, where: PlacementWhere, quantity = 1, hidden?: boolean): Placement =>
  ({ id: `p${n++}`, where, quantity, ...(hidden && { hidden }), source: { kind: 'item', itemId } });
const ids = () => { let i = 0; return () => `c${i++}`; };

const potion = item('potion');
const sword = item('sword', { stackable: false });
const wand = item('wand', { charges: 3 });
const bram = { id: 'bram', name: 'Bram' } as Entity;
const albus = { id: 'albus', name: 'Albus', persona: true } as Entity;
const ghost = { id: 'ghost', name: 'Ghost', persona: true, personaOnly: true } as Entity;
const self = { id: 'self', name: 'Self', customPersona: true } as Entity;
const you = { kind: 'you' } as const;

const world = (placements: Placement[], over: Partial<SeedWorld> = {}): SeedWorld => ({
  items: [potion, sword, wand], entities: [bram, albus, ghost, self], locations: [{ id: 'cellar' }], placements, ...over,
});

describe('seedItemCopies', () => {
  it('stacks a stackable item placed twice on one owner, and keeps a hidden placement its own row', () => {
    const copies = seedItemCopies(world([
      place('potion', you, 2), place('potion', you, 3), place('potion', you, 1, true),
    ]), undefined, ids());
    expect(copies).toEqual([
      { id: 'c0', item: { kind: 'item', itemId: 'potion' }, where: you, quantity: 5, visibility: 'visible' },
      { id: 'c1', item: { kind: 'item', itemId: 'potion' }, where: you, quantity: 1, visibility: 'hidden' },
    ]);
  });

  it('keeps stacks on different owners apart', () => {
    const copies = seedItemCopies(world([
      place('potion', { kind: 'entity', id: 'bram' }), place('potion', { kind: 'location', id: 'cellar' }),
    ]), undefined, ids());
    expect(copies.map((c) => c.where)).toEqual([{ kind: 'entity', id: 'bram' }, { kind: 'location', id: 'cellar' }]);
  });

  it('makes one Item Copy per unit of an item that does not stack, each charged item with full charges', () => {
    const copies = seedItemCopies(world([place('sword', you, 2), place('wand', you, 2)]), undefined, ids());
    expect(copies.map((c) => [c.item, c.quantity, c.state])).toEqual([
      [{ kind: 'item', itemId: 'sword' }, 1, undefined],
      [{ kind: 'item', itemId: 'sword' }, 1, undefined],
      [{ kind: 'item', itemId: 'wand' }, 1, { charges: 3 }],
      [{ kind: 'item', itemId: 'wand' }, 1, { charges: 3 }],
    ]);
    expect(new Set(copies.map((c) => c.id)).size).toBe(4);
    expect(copies.every((c) => c.equipped === undefined)).toBe(true);
  });

  it("puts a played world entity's placements on the you owner, stacked with the persona items", () => {
    const placements = [place('potion', { kind: 'entity', id: 'albus' }, 2), place('potion', you, 1)];
    expect(seedItemCopies(world(placements), { source: 'world', entityId: 'albus' }, ids()))
      .toEqual([{ id: 'c0', item: { kind: 'item', itemId: 'potion' }, where: you, quantity: 3, visibility: 'visible' }]);
    // Unplayed, the same Persona entity keeps them as its own.
    expect(seedItemCopies(world(placements), { source: 'none' }, ids()).map((c) => c.where))
      .toEqual([{ kind: 'entity', id: 'albus' }, you]);
  });

  it('gives the Custom Persona entity its placements as the player under None and a library persona only', () => {
    const placements = [place('potion', { kind: 'entity', id: 'self' })];
    expect(seedItemCopies(world(placements), { source: 'none' }, ids()).map((c) => c.where)).toEqual([you]);
    expect(seedItemCopies(world(placements), { source: 'library', entityId: 'lib' }, ids()).map((c) => c.where)).toEqual([you]);
    expect(seedItemCopies(world(placements), { source: 'world', entityId: 'albus' }, ids())).toEqual([]);
  });

  it('skips an unplayed persona-only entity, and plays it when it is the persona', () => {
    const placements = [place('potion', { kind: 'entity', id: 'ghost' })];
    expect(seedItemCopies(world(placements), { source: 'none' }, ids())).toEqual([]);
    expect(seedItemCopies(world(placements), { source: 'world', entityId: 'ghost' }, ids()).map((c) => c.where)).toEqual([you]);
  });

  it('skips a placement whose item, entity or location is gone, or whose quantity is not positive', () => {
    expect(seedItemCopies(world([
      place('gone', you), place('potion', { kind: 'entity', id: 'gone' }), place('potion', { kind: 'location', id: 'gone' }),
      place('potion', you, 0),
    ]), undefined, ids())).toEqual([]);
  });
});

const copy = (id: string, over: Partial<ItemCopy> = {}): ItemCopy =>
  ({ id, item: { kind: 'item', itemId: 'potion' }, where: you, quantity: 1, visibility: 'visible', ...over });

describe('copiesAt', () => {
  it("lists one owner's Item Copies, or the ones lying at one location", () => {
    const copies = [
      copy('a'), copy('b', { where: { kind: 'entity', id: 'bram' } }), copy('c', { where: { kind: 'entity', id: 'albus' } }),
      copy('d', { where: { kind: 'location', id: 'bram' } }),
    ];
    expect(copiesAt(copies, you).map((c) => c.id)).toEqual(['a']);
    expect(copiesAt(copies, { kind: 'entity', id: 'bram' }).map((c) => c.id)).toEqual(['b']);
    expect(copiesAt(copies, { kind: 'location', id: 'bram' }).map((c) => c.id)).toEqual(['d']);
  });
});

describe('withoutOrphanCopies', () => {
  const targets = { itemIds: new Set(['potion']), entityIds: new Set(['bram']), locationIds: new Set(['cellar']) };

  it('drops the Item Copies of a deleted item, owner entity or location, and names them', () => {
    const kept = [copy('a'), copy('b', { where: { kind: 'entity', id: 'bram' } }), copy('c', { where: { kind: 'location', id: 'cellar' } })];
    const lost = [
      copy('x', { item: { kind: 'item', itemId: 'gone' } }), copy('y', { where: { kind: 'entity', id: 'gone' } }),
      copy('z', { where: { kind: 'location', id: 'gone' } }),
    ];
    const result = withoutOrphanCopies([...kept, ...lost], targets);
    expect(result.copies).toEqual(kept);
    expect(result.dropped.map((c) => c.id)).toEqual(['x', 'y', 'z']);
  });

  it('returns the same array when nothing is orphaned', () => {
    const copies = [copy('a')];
    expect(withoutOrphanCopies(copies, targets)).toEqual({ copies, dropped: [] });
    expect(withoutOrphanCopies(copies, targets).copies).toBe(copies);
  });
});
