import { describe, expect, it } from 'vitest';
import { startingCopies, type StartWorld } from '.';
import { parsePlacements } from '@/lib/items';
import type { Entity, Item, Placement } from '@/types';

const dagger: Item = { id: 'dagger', name: 'Dagger', stackable: false, statEffects: [], traitEffects: [], equipRequires: [], slotRule: { mode: 'either', slotIds: ['main', 'off'] } };
const you = { kind: 'you' } as const;
const place = (over: Partial<Placement> = {}): Placement =>
  ({ id: 'p', where: you, quantity: 1, equipped: true, source: { kind: 'item', itemId: 'dagger' }, ...over });
const ids = () => { let i = 0; return () => `c${i++}`; };

const world = (placements: Placement[]): StartWorld => ({
  items: [dagger], entities: [{ id: 'self', name: 'Self', customPersona: true } as Entity], locations: [], placements,
  slots: [{ id: 'main', name: 'Main Hand' }, { id: 'off', name: 'Off Hand' }],
  bodies: [{ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'main' }, { slotId: 'off' }] }],
});
const slots = (placements: Placement[]) => startingCopies(world(placements), undefined, ids()).map((c) => c.equipped?.slotId);

describe('startingCopies with a placement slot', () => {
  it('starts the copy in the named slot', () => {
    expect(slots([place({ slotId: 'off' })])).toEqual(['off']);
  });

  it('takes the first free slot when none is named', () => {
    expect(slots([place()])).toEqual(['main']);
  });

  it('falls back to the first free slot when the rule no longer lists the named one', () => {
    expect(slots([place({ slotId: 'tail' })])).toEqual(['main']);
  });

  it('swaps out the earlier copy when a later placement names a full slot', () => {
    expect(slots([place({ slotId: 'off' }), place({ id: 'q', slotId: 'off' })])).toEqual([undefined, 'off']);
  });

  it('keeps both when the named slot has room for two', () => {
    const wide = world([place({ slotId: 'off' }), place({ id: 'q', slotId: 'off' })]);
    wide.bodies = [{ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'main' }, { slotId: 'off', capacity: 2 }] }];
    expect(startingCopies(wide, undefined, ids()).map((c) => c.equipped?.slotId)).toEqual(['off', 'off']);
  });

  it('keeps both when each names its own slot', () => {
    expect(slots([place({ slotId: 'off' }), place({ id: 'q', slotId: 'main' })])).toEqual(['off', 'main']);
  });
});

describe('parsePlacements slotId', () => {
  const raw = (over: object) => [{ id: 'p', where: you, quantity: 1, source: { kind: 'item', itemId: 'dagger' }, ...over }];

  it('keeps a string slot on an equipped owner placement', () => {
    expect(parsePlacements(raw({ equipped: true, slotId: 'off' }))[0].slotId).toBe('off');
  });

  it('drops a slot that is not a string, or has no Equipped, or sits at a location', () => {
    expect(parsePlacements(raw({ equipped: true, slotId: 3 }))[0].slotId).toBeUndefined();
    expect(parsePlacements(raw({ slotId: 'off' }))[0].slotId).toBeUndefined();
    expect(parsePlacements(raw({ where: { kind: 'location', id: 'gate' }, equipped: true, slotId: 'off' }))[0].slotId).toBeUndefined();
  });
});
