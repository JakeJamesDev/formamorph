import { describe, expect, it } from 'vitest';
import { bodyFixture } from '@/test/bodyFixture';
import { applyInventoryOps, type InventoryCall, type InventoryOp } from '.';
import { occupiedSlots } from '@/lib/items';
import type { Body, Item, ItemInstance, Slot, SlotRule } from '@/types';

const either = (...slotIds: string[]): SlotRule => ({ mode: 'either', slotIds });
const all = (...slotIds: string[]): SlotRule => ({ mode: 'all', slotIds });
const item = (id: string, slotRule: SlotRule): Item =>
  ({ id, name: id, stackable: false, slotRule, statEffects: [], traitEffects: [], equipRequires: [] });

const slots: Slot[] = [{ id: 'main', name: 'Main Hand' }, { id: 'off', name: 'Off Hand' }, { id: 'ring', name: 'Ring' }];
const bodies: Body[] = [
  bodyFixture({ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'main' }, { slotId: 'off' }, { slotId: 'ring', capacity: 2 }] }),
  bodyFixture({ id: 'oneArm', name: 'One Arm', entries: [{ slotId: 'main' }] }),
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

const instance = (itemId: string, id: string, equipped?: { slotId: string; order: number }): ItemInstance =>
  ({ id, item: { kind: 'item', itemId }, where: { kind: 'you' }, quantity: 1, visibility: 'visible', ...(equipped && { equipped }) });
const at = (slotId: string, order: number) => ({ slotId, order });
const call = (bodyId = 'humanoid'): InventoryCall => ({
  world: { items, slots, bodies: bodies.filter((b) => b.id === bodyId) }, source: 'panel', newId: () => 'new',
});
const equip = (instances: ItemInstance[], instanceId: string, slotId?: string, bodyId?: string) =>
  applyInventoryOps(instances, [{ kind: 'equip', copyId: instanceId, ...(slotId && { slotId }) } as InventoryOp], call(bodyId));
const slotOf = (instances: readonly ItemInstance[], id: string) => instances.find((c) => c.id === id)?.equipped?.slotId;

describe('Either of', () => {
  it("takes the first free slot in the item's order", () => {
    expect(slotOf(equip([instance('dagger', 'd')], 'd').instances, 'd')).toBe('main');
    expect(slotOf(equip([instance('torch', 't')], 't').instances, 't')).toBe('off');
  });

  it('skips a full slot for the next free one', () => {
    const { instances } = equip([instance('dagger', 'a', at('main', 1)), instance('dagger', 'b')], 'b');
    expect(slotOf(instances, 'a')).toBe('main');
    expect(slotOf(instances, 'b')).toBe('off');
  });

  it('skips a slot the Body lacks', () => {
    expect(slotOf(equip([instance('torch', 't')], 't', undefined, 'oneArm').instances, 't')).toBe('main');
  });

  it('takes the named slot over the first free one', () => {
    expect(slotOf(equip([instance('dagger', 'd')], 'd', 'off').instances, 'd')).toBe('off');
  });

  it('refuses a slot its rule does not name, and one the Body lacks', () => {
    const start = [instance('dagger', 'd')];
    expect(equip(start, 'd', 'ring').diagnostics).toEqual(["Inventory (panel) skipped equip: Item Instance d can't go in Ring"]);
    expect(equip(start, 'd', 'off', 'oneArm').diagnostics).toEqual(['Inventory (panel) skipped equip: no Off Hand slot on you']);
  });

  it('swaps out in the named slot when every allowed slot is full', () => {
    const start = [instance('dagger', 'a', at('main', 1)), instance('dagger', 'b', at('off', 2)), instance('dagger', 'c')];
    const { instances } = equip(start, 'c', 'off');
    expect(slotOf(instances, 'a')).toBe('main');
    expect(slotOf(instances, 'b')).toBeUndefined();
    expect(slotOf(instances, 'c')).toBe('off');
  });

  it('swaps out in the first listed slot when none is named', () => {
    const start = [instance('dagger', 'a', at('main', 1)), instance('dagger', 'b', at('off', 2)), instance('torch', 't')];
    const { instances, events } = equip(start, 't');
    expect(slotOf(instances, 'a')).toBe('main');
    expect(slotOf(instances, 'b')).toBeUndefined();
    expect(slotOf(instances, 't')).toBe('off');
    expect(events.map((e) => [e.timing, e.copyId])).toEqual([['unequipped', 'b'], ['equipped', 't']]);
  });

  it('fills a capacity slot unit by unit, then swaps out the longest equipped', () => {
    const two = equip([instance('band', 'a', at('ring', 1)), instance('band', 'b')], 'b').instances;
    expect(slotOf(two, 'a')).toBe('ring');
    expect(slotOf(two, 'b')).toBe('ring');
    const three = equip([instance('band', 'a', at('ring', 2)), instance('band', 'b', at('ring', 1)), instance('band', 'c')], 'c').instances;
    expect(slotOf(three, 'a')).toBe('ring');
    expect(slotOf(three, 'b')).toBeUndefined();
  });

  it('refuses a slot with no room for anyone, which only a hand-edited capacity of 0 gives', () => {
    const world = { items, slots, bodies: [bodyFixture({ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'main', capacity: 0 }] })] };
    const { instances, diagnostics } = applyInventoryOps([instance('dagger', 'd')], [{ kind: 'equip', copyId: 'd' }], { ...call(), world });
    expect(slotOf(instances, 'd')).toBeUndefined();
    expect(diagnostics).toEqual(['Inventory (panel) skipped equip: no room in Main Hand on you']);
  });

  it('refuses an already equipped instance, so moving is unequip then equip (Q54)', () => {
    const start = [instance('dagger', 'd', at('main', 1))];
    expect(equip(start, 'd', 'off').diagnostics).toEqual(['Inventory (panel) skipped equip: Item Instance d is already equipped']);
    const moved = applyInventoryOps(start, [{ kind: 'unequip', copyId: 'd' }, { kind: 'equip', copyId: 'd', slotId: 'off' }], call());
    expect(slotOf(moved.instances, 'd')).toBe('off');
    expect(moved.events.map((e) => e.timing)).toEqual(['unequipped', 'equipped']);
  });
});

describe('All of', () => {
  it('refuses when the Body lacks any of its slots', () => {
    const { instances, diagnostics } = equip([instance('greatsword', 'g')], 'g', undefined, 'oneArm');
    expect(slotOf(instances, 'g')).toBeUndefined();
    expect(diagnostics).toEqual(['Inventory (panel) skipped equip: no Off Hand slot on you']);
  });

  it('stores the first listed slot and occupies every listed one', () => {
    const { instances } = equip([instance('hilt', 'h')], 'h');
    const worn = instances[0];
    expect(worn.equipped?.slotId).toBe('off');
    expect(occupiedSlots(worn, byId.get('hilt'))).toEqual(['off', 'main']);
  });

  it('swaps out what fills each slot', () => {
    const start = [instance('dagger', 'a', at('main', 1)), instance('torch', 'b', at('off', 2)), instance('greatsword', 'g')];
    const { instances, events } = equip(start, 'g');
    expect(slotOf(instances, 'a')).toBeUndefined();
    expect(slotOf(instances, 'b')).toBeUndefined();
    expect(events.map((e) => [e.timing, e.copyId])).toEqual([['unequipped', 'a'], ['unequipped', 'b'], ['equipped', 'g']]);
  });

  it('counts a worn All of item in every slot it occupies, so a later equip sees those units full', () => {
    const start = [instance('greatsword', 'g', at('main', 1)), instance('torch', 't')];
    const { instances } = equip(start, 't');
    expect(slotOf(instances, 'g')).toBeUndefined();
    expect(slotOf(instances, 't')).toBe('off');
  });

  it('swaps out only what it needs, longest equipped first, in a capacity slot', () => {
    const start = [instance('band', 'old', at('ring', 1)), instance('band', 'new', at('ring', 2)), instance('dagger', 'd', at('off', 3)), instance('tusks', 'x')];
    const { instances } = equip(start, 'x');
    expect(slotOf(instances, 'old')).toBeUndefined();
    expect(slotOf(instances, 'new')).toBe('ring');
    expect(slotOf(instances, 'd')).toBe('off');
    expect(slotOf(instances, 'x')).toBe('main');
  });

  it('leaves on an instance a later swap-out made room for', () => {
    // Ring is full and goes first, so the older band looks due. Main then needs the tusks gone, which frees a ring unit.
    const start = [instance('band', 'old', at('ring', 1)), instance('tusks', 'x', at('main', 2)), instance('fangs', 'f')];
    const { instances, events } = equip(start, 'f');
    expect(slotOf(instances, 'x')).toBeUndefined();
    expect(slotOf(instances, 'old')).toBe('ring');
    expect(events.map((e) => [e.timing, e.copyId])).toEqual([['unequipped', 'x'], ['equipped', 'f']]);
  });
});

describe('a save round trip', () => {
  it('keeps an Either of instance in its slot', () => {
    const { instances } = equip([instance('dagger', 'd')], 'd', 'off');
    const reloaded = JSON.parse(JSON.stringify(instances)) as ItemInstance[];
    expect(slotOf(reloaded, 'd')).toBe('off');
    expect(occupiedSlots(reloaded[0], byId.get('dagger'))).toEqual(['off']);
  });
});
