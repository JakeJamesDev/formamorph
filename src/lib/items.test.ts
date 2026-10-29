import { describe, expect, it } from 'vitest';
import {
  blankItem, duplicateItem, itemStackable, itemTraitOptions, itemsInSlot, parseItems, parsePlacements, wholeCount, withSlotCapacity,
  withoutItemPlacements, withoutSlotRefs,
} from './items';
import type { Item, Placement } from '@/types';

const item = (over: Partial<Item> & { id: string }): Item => ({ ...blankItem(over.id, over.name ?? over.id), ...over });

describe('itemStackable', () => {
  it('stacks by default and when switched on', () => {
    expect(itemStackable(item({ id: 'a' }))).toBe(true);
    expect(itemStackable(item({ id: 'a', stackable: true }))).toBe(true);
  });

  it('never stacks an item with charges, whatever the switch says (Q47)', () => {
    expect(itemStackable(item({ id: 'a', charges: 3, stackable: true }))).toBe(false);
  });

  it('does not stack when switched off', () => {
    expect(itemStackable(item({ id: 'a', stackable: false }))).toBe(false);
  });
});

describe('parseItems', () => {
  it('fills the lists a hand-edited item leaves out and drops records with no id', () => {
    const parsed = parseItems([{ id: 'a', name: 'Lamp' }, { name: 'No Id' }, 'junk']);
    expect(parsed).toEqual([{ id: 'a', name: 'Lamp', statEffects: [], traitEffects: [], equipRequires: [] }]);
  });

  it('reads a missing list as no items', () => {
    expect(parseItems(undefined)).toEqual([]);
  });
});

describe('duplicateItem', () => {
  it('puts a renamed copy right after the source, with fresh ids for it and its rows', () => {
    const source = item({
      id: 'lamp', name: 'Lamp',
      statEffects: [{ id: 'fx', statId: 's', facet: 'value', timing: 'owned', amount: 1, op: 'add' }],
      traitEffects: [{ id: 'tx', traitId: 't', timing: 'equipped' }],
    });
    const { items, newId } = duplicateItem([source, item({ id: 'key' })], 'lamp');
    expect(items.map((i) => i.name)).toEqual(['Lamp', 'Lamp (Copy)', 'key']);
    const copy = items[1];
    expect(copy.id).toBe(newId);
    expect(newId).not.toBe('lamp');
    expect(copy.statEffects[0].id).not.toBe('fx');
    expect(copy.traitEffects[0].id).not.toBe('tx');
    expect(items[0]).toBe(source);
  });

  it('gives the copy its own placeholders and points its chips at them', () => {
    const source = item({
      id: 'lamp', name: 'Lamp of {{ph:own-color:world:pl1}}',
      placeholders: [{ id: 'own-color', name: 'Color', values: [{ id: 'v1', text: 'brass' }] }],
    });
    const copy = duplicateItem([source], 'lamp').items[1];
    const copiedId = copy.placeholders![0].id;
    expect(copiedId).not.toBe('own-color');
    expect(copy.name).toContain(copiedId);
    expect(copy.name).not.toContain('own-color');
  });

  it('leaves the list as it was for an unknown id', () => {
    const list = [item({ id: 'lamp' })];
    expect(duplicateItem(list, 'nope').items).toEqual(list);
  });
});

describe('slot references', () => {
  const items = [item({ id: 'sword', slotId: 'hand', slotSize: 2 }), item({ id: 'ring', slotId: 'finger' })];

  it('counts the items that equip into a slot', () => {
    expect(itemsInSlot(items, 'hand')).toBe(1);
    expect(itemsInSlot(items, 'head')).toBe(0);
  });

  it('clears the slot and its size from the items that used it, and only those', () => {
    const next = withoutSlotRefs(items, 'hand');
    expect(next[0]).not.toHaveProperty('slotId');
    expect(next[0]).not.toHaveProperty('slotSize');
    expect(next[1]).toBe(items[1]);
  });

  it('keeps the list when no item uses the slot', () => {
    expect(withoutSlotRefs(items, 'head')).toBe(items);
  });
});

describe('withoutItemPlacements', () => {
  const placements: Placement[] = [
    { id: 'p1', where: { kind: 'you' }, quantity: 1, source: { kind: 'item', itemId: 'lamp' } },
    { id: 'p2', where: { kind: 'location', id: 'cellar' }, quantity: 3, source: { kind: 'item', itemId: 'bottle' } },
  ];

  it('drops the placements of a removed item', () => {
    expect(withoutItemPlacements(placements, 'lamp').map((p) => p.id)).toEqual(['p2']);
  });

  it('keeps the list when nothing places the item', () => {
    expect(withoutItemPlacements(placements, 'sword')).toBe(placements);
  });
});

describe('parsePlacements', () => {
  it('drops placements with no item source, so a later item delete never reads a missing source', () => {
    const kept = { id: 'p1', where: { kind: 'you' }, quantity: 1, source: { kind: 'item', itemId: 'lamp' } };
    expect(parsePlacements([kept, { id: 'p2', where: { kind: 'you' }, quantity: 1 }, { id: 'p3', source: { kind: 'table' } }])).toEqual([kept]);
  });
});

describe('withSlotCapacity', () => {
  it('cuts the slot sizes in a slot down to its new capacity, and only in that slot', () => {
    const items = [item({ id: 'sword', slotId: 'hand', slotSize: 2 }), item({ id: 'pike', slotId: 'back', slotSize: 2 })];
    const next = withSlotCapacity(items, 'hand', 1);
    expect(next[0].slotSize).toBe(1);
    expect(next[1]).toBe(items[1]);
  });

  it('keeps the list when every size still fits', () => {
    const items = [item({ id: 'sword', slotId: 'hand', slotSize: 2 })];
    expect(withSlotCapacity(items, 'hand', 2)).toBe(items);
  });
});

describe('wholeCount', () => {
  it('reads a typed whole number, rounds down, and reads blank or junk as none', () => {
    expect(wholeCount('3.7')).toBe(3);
    expect(wholeCount(' ')).toBeUndefined();
    expect(wholeCount('abc')).toBeUndefined();
  });
});

describe('itemTraitOptions', () => {
  it('lists each owner trait once under its owner and leaves out Automatic traits', () => {
    const t = (id: string, mode?: 'alwaysOn' | 'hidden') => ({ id, name: id, statChanges: [], ...(mode && { mode }) });
    const options = itemTraitOptions([
      { id: 'bram', name: 'Bram', traits: [t('brave'), t('fated', 'alwaysOn'), t('veiled', 'hidden')] },
      { id: 'mira', name: 'Mira', traits: [t('brave'), t('sly')] },
      { id: 'tom', name: 'Tom', traits: [t('fated', 'alwaysOn')] },
    ]);
    expect(options.map((o) => [o.name, o.traits.map((x) => x.id)])).toEqual([['Bram', ['brave']], ['Mira', ['sly']]]);
  });
});
