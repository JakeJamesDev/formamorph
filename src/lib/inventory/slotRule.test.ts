import { describe, expect, it } from 'vitest';
import { applyInventoryOps, type InventoryCall, type InventoryOp } from '.';
import { occupiedSlots } from '@/lib/items';
import type { Body, Item, ItemCopy, Slot, SlotRule } from '@/types';

const either = (...slotIds: string[]): SlotRule => ({ mode: 'either', slotIds });
const all = (...slotIds: string[]): SlotRule => ({ mode: 'all', slotIds });
const item = (id: string, slotRule: SlotRule): Item =>
  ({ id, name: id, stackable: false, slotRule, statEffects: [], traitEffects: [], equipRequires: [] });

const slots: Slot[] = [{ id: 'main', name: 'Main Hand' }, { id: 'off', name: 'Off Hand' }, { id: 'ring', name: 'Ring' }];
const bodies: Body[] = [
  { id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'main' }, { slotId: 'off' }, { slotId: 'ring', capacity: 2 }] },
  { id: 'oneArm', name: 'One Arm', entries: [{ slotId: 'main' }] },
];
const items = [
  item('dagger', either('main', 'off')),
  item('torch', either('off', 'main')),
  item('band', either('ring')),
  item('greatsword', all('main', 'off')),
  item('hilt', all('off', 'main')),
  item('tusks', all('main', 'ring')),
  item('fangs', all('ring', 'main')),
];
const byId = new Map(items.map((i) => [i.id, i]));

const copy = (itemId: string, id: string, equipped?: { slotId: string; order: number }): ItemCopy =>
  ({ id, item: { kind: 'item', itemId }, where: { kind: 'you' }, quantity: 1, visibility: 'visible', ...(equipped && { equipped }) });
const at = (slotId: string, order: number) => ({ slotId, order });
const call = (bodyId = 'humanoid'): InventoryCall => ({
  world: { items, slots, bodies: bodies.filter((b) => b.id === bodyId) }, source: 'panel', newId: () => 'new',
});
const equip = (copies: ItemCopy[], copyId: string, slotId?: string, bodyId?: string) =>
  applyInventoryOps(copies, [{ kind: 'equip', copyId, ...(slotId && { slotId }) } as InventoryOp], call(bodyId));
const slotOf = (copies: readonly ItemCopy[], id: string) => copies.find((c) => c.id === id)?.equipped?.slotId;

describe('Either of', () => {
  it("takes the first free slot in the item's order", () => {
    expect(slotOf(equip([copy('dagger', 'd')], 'd').copies, 'd')).toBe('main');
    expect(slotOf(equip([copy('torch', 't')], 't').copies, 't')).toBe('off');
  });

  it('skips a full slot for the next free one', () => {
    const { copies } = equip([copy('dagger', 'a', at('main', 1)), copy('dagger', 'b')], 'b');
    expect(slotOf(copies, 'a')).toBe('main');
    expect(slotOf(copies, 'b')).toBe('off');
  });

  it('skips a slot the Body lacks', () => {
    expect(slotOf(equip([copy('torch', 't')], 't', undefined, 'oneArm').copies, 't')).toBe('main');
  });

  it('takes the named slot over the first free one', () => {
    expect(slotOf(equip([copy('dagger', 'd')], 'd', 'off').copies, 'd')).toBe('off');
  });

  it('refuses a slot its rule does not name, and one the Body lacks', () => {
    const start = [copy('dagger', 'd')];
    expect(equip(start, 'd', 'ring').diagnostics).toEqual(["Inventory (panel) skipped equip: Item Copy d can't go in Ring"]);
    expect(equip(start, 'd', 'off', 'oneArm').diagnostics).toEqual(['Inventory (panel) skipped equip: no Off Hand slot on you']);
  });

  it('swaps out in the named slot when every allowed slot is full', () => {
    const start = [copy('dagger', 'a', at('main', 1)), copy('dagger', 'b', at('off', 2)), copy('dagger', 'c')];
    const { copies } = equip(start, 'c', 'off');
    expect(slotOf(copies, 'a')).toBe('main');
    expect(slotOf(copies, 'b')).toBeUndefined();
    expect(slotOf(copies, 'c')).toBe('off');
  });

  it('swaps out in the first listed slot when none is named', () => {
    const start = [copy('dagger', 'a', at('main', 1)), copy('dagger', 'b', at('off', 2)), copy('torch', 't')];
    const { copies, events } = equip(start, 't');
    expect(slotOf(copies, 'a')).toBe('main');
    expect(slotOf(copies, 'b')).toBeUndefined();
    expect(slotOf(copies, 't')).toBe('off');
    expect(events.map((e) => [e.timing, e.copyId])).toEqual([['unequipped', 'b'], ['equipped', 't']]);
  });

  it('fills a capacity slot unit by unit, then swaps out the longest equipped', () => {
    const two = equip([copy('band', 'a', at('ring', 1)), copy('band', 'b')], 'b').copies;
    expect(slotOf(two, 'a')).toBe('ring');
    expect(slotOf(two, 'b')).toBe('ring');
    const three = equip([copy('band', 'a', at('ring', 2)), copy('band', 'b', at('ring', 1)), copy('band', 'c')], 'c').copies;
    expect(slotOf(three, 'a')).toBe('ring');
    expect(slotOf(three, 'b')).toBeUndefined();
  });

  it('refuses a slot with no room for anyone, which only a hand-edited capacity of 0 gives', () => {
    const world = { items, slots, bodies: [{ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'main', capacity: 0 }] }] };
    const { copies, diagnostics } = applyInventoryOps([copy('dagger', 'd')], [{ kind: 'equip', copyId: 'd' }], { ...call(), world });
    expect(slotOf(copies, 'd')).toBeUndefined();
    expect(diagnostics).toEqual(['Inventory (panel) skipped equip: no room in Main Hand on you']);
  });

  it('refuses an already equipped copy, so moving is unequip then equip (Q54)', () => {
    const start = [copy('dagger', 'd', at('main', 1))];
    expect(equip(start, 'd', 'off').diagnostics).toEqual(['Inventory (panel) skipped equip: Item Copy d is already equipped']);
    const moved = applyInventoryOps(start, [{ kind: 'unequip', copyId: 'd' }, { kind: 'equip', copyId: 'd', slotId: 'off' }], call());
    expect(slotOf(moved.copies, 'd')).toBe('off');
    expect(moved.events.map((e) => e.timing)).toEqual(['unequipped', 'equipped']);
  });
});

describe('All of', () => {
  it('refuses when the Body lacks any of its slots', () => {
    const { copies, diagnostics } = equip([copy('greatsword', 'g')], 'g', undefined, 'oneArm');
    expect(slotOf(copies, 'g')).toBeUndefined();
    expect(diagnostics).toEqual(['Inventory (panel) skipped equip: no Off Hand slot on you']);
  });

  it('stores the first listed slot and occupies every listed one', () => {
    const { copies } = equip([copy('hilt', 'h')], 'h');
    const worn = copies[0];
    expect(worn.equipped?.slotId).toBe('off');
    expect(occupiedSlots(worn, byId.get('hilt'))).toEqual(['off', 'main']);
  });

  it('swaps out what fills each slot', () => {
    const start = [copy('dagger', 'a', at('main', 1)), copy('torch', 'b', at('off', 2)), copy('greatsword', 'g')];
    const { copies, events } = equip(start, 'g');
    expect(slotOf(copies, 'a')).toBeUndefined();
    expect(slotOf(copies, 'b')).toBeUndefined();
    expect(events.map((e) => [e.timing, e.copyId])).toEqual([['unequipped', 'a'], ['unequipped', 'b'], ['equipped', 'g']]);
  });

  it('counts a worn All of item in every slot it occupies, so a later equip sees those units full', () => {
    const start = [copy('greatsword', 'g', at('main', 1)), copy('torch', 't')];
    const { copies } = equip(start, 't');
    expect(slotOf(copies, 'g')).toBeUndefined();
    expect(slotOf(copies, 't')).toBe('off');
  });

  it('swaps out only what it needs, longest equipped first, in a capacity slot', () => {
    const start = [copy('band', 'old', at('ring', 1)), copy('band', 'new', at('ring', 2)), copy('dagger', 'd', at('off', 3)), copy('tusks', 'x')];
    const { copies } = equip(start, 'x');
    expect(slotOf(copies, 'old')).toBeUndefined();
    expect(slotOf(copies, 'new')).toBe('ring');
    expect(slotOf(copies, 'd')).toBe('off');
    expect(slotOf(copies, 'x')).toBe('main');
  });

  it('leaves on a copy a later swap-out made room for', () => {
    // Ring is full and goes first, so the older band looks due. Main then needs the tusks gone, which frees a ring unit.
    const start = [copy('band', 'old', at('ring', 1)), copy('tusks', 'x', at('main', 2)), copy('fangs', 'f')];
    const { copies, events } = equip(start, 'f');
    expect(slotOf(copies, 'x')).toBeUndefined();
    expect(slotOf(copies, 'old')).toBe('ring');
    expect(events.map((e) => [e.timing, e.copyId])).toEqual([['unequipped', 'x'], ['equipped', 'f']]);
  });
});

describe('a save round trip', () => {
  it('keeps an Either of copy in its slot', () => {
    const { copies } = equip([copy('dagger', 'd')], 'd', 'off');
    const reloaded = JSON.parse(JSON.stringify(copies)) as ItemCopy[];
    expect(slotOf(reloaded, 'd')).toBe('off');
    expect(occupiedSlots(reloaded[0], byId.get('dagger'))).toEqual(['off']);
  });
});
