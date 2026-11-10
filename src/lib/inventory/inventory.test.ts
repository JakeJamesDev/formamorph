import { describe, expect, it } from 'vitest';
import { bodyFixture } from '@/test/bodyFixture';
import {
  applyInventoryOps, copiesAt, seedItemCopies, statEffectItems, withoutOrphanCopies, type InventoryCall, type SeedWorld,
} from '.';
import { presentEntityIds } from '@/lib/entityPresence';
import type { Entity, Item, ItemCopy, Placement, PlacementWhere } from '@/types';

const item = (id: string, over: Partial<Item> = {}): Item =>
  ({ id, name: id, statEffects: [], traitEffects: [], equipRequires: [], ...over });
let n = 0;
const place = (itemId: string, where: PlacementWhere, quantity = 1, hidden?: boolean): Placement =>
  ({ id: `p${n++}`, where, quantity, ...(hidden && { hidden }), source: { kind: 'item', itemId } });
const ids = () => { let i = 0; return () => `c${i++}`; };

const potion = item('potion');
const sword = item('sword', { stackable: false });
const wand = item('wand', { uses: 3, whenEmpty: { kind: 'stays' } });
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

  it('makes one Item Copy per unit of an item that does not stack, each item with Uses at full uses', () => {
    const copies = seedItemCopies(world([place('sword', you, 2), place('wand', you, 2)]), undefined, ids());
    expect(copies.map((c) => [c.item, c.quantity, c.state])).toEqual([
      [{ kind: 'item', itemId: 'sword' }, 1, undefined],
      [{ kind: 'item', itemId: 'sword' }, 1, undefined],
      [{ kind: 'item', itemId: 'wand' }, 1, { uses: 3 }],
      [{ kind: 'item', itemId: 'wand' }, 1, { uses: 3 }],
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

describe('statEffectItems', () => {
  const boost = { id: 's', statId: 'hp', facet: 'value', timing: 'equipped', amount: 1, op: 'add' } as const;
  const effectItems = ['mine', 'held', 'floor', 'secret', 'away', 'elsewhere'].map((id) => item(id, { statEffects: [boost] }));
  const scene = { locationId: 'cellar', entityIds: ['bram'] };
  const of = (itemId: string, where: ItemCopy['where'], over: Partial<ItemCopy> = {}) =>
    copy(itemId, { item: { kind: 'item', itemId }, where, ...over });

  it('names visible copies held by you or a present entity, or lying here, and leaves out hidden ones and other places', () => {
    const copies = [
      of('mine', you), of('held', { kind: 'entity', id: 'bram' }), of('floor', { kind: 'location', id: 'cellar' }),
      of('secret', you, { visibility: 'hidden' }), of('away', { kind: 'entity', id: 'albus' }), of('elsewhere', { kind: 'location', id: 'attic' }),
    ];
    expect(statEffectItems(copies, effectItems, scene).map((i) => i.id)).toEqual(['mine', 'held', 'floor']);
  });

  it('names an item once a visible copy is present, beside a hidden one, and never one without stat effects', () => {
    const copies = [of('secret', you, { visibility: 'hidden' }), of('secret', { kind: 'location', id: 'cellar' }), copy('potion')];
    expect(statEffectItems(copies, [...effectItems, potion], scene).map((i) => i.id)).toEqual(['secret']);
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

describe('applyInventoryOps', () => {
  const hand = { id: 'hand', name: 'Hand' };
  const head = { id: 'head', name: 'Head' };
  const humanoid = bodyFixture({ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'hand', capacity: 2 }, { slotId: 'head' }] });
  const dagger = item('dagger', { slotRule: { mode: 'either', slotIds: ['hand'] } });
  const helm = item('helm', { stackable: false, slotRule: { mode: 'either', slotIds: ['head'] } });
  const crown = item('crown', { stackable: false, slotRule: { mode: 'either', slotIds: ['head'] }, bound: true });
  const items = [potion, sword, wand, dagger, helm, crown];
  const call = (over: Partial<InventoryCall> = {}): InventoryCall =>
    ({ world: { items, slots: [hand, head], bodies: [humanoid] }, source: 'panel', newId: ids(), ...over });
  const of = (itemId: string, id: string, over: Partial<ItemCopy> = {}) => copy(id, { item: { kind: 'item', itemId }, ...over });
  const bramWhere = { kind: 'entity', id: 'bram' } as const;
  const cellar = { kind: 'location', id: 'cellar' } as const;
  const presence = { locationId: 'cellar', entityIds: new Set(['bram']) };

  it('equips one dagger from a stack of five and leaves four in the stack', () => {
    const { copies } = applyInventoryOps([of('dagger', 'd', { quantity: 5 })], [{ kind: 'equip', copyId: 'd' }], call());
    expect(copies).toEqual([
      of('dagger', 'd', { quantity: 4 }),
      of('dagger', 'c0', { equipped: { slotId: 'hand', order: 1 } }),
    ]);
  });

  it('swaps out the item equipped there longest, and it stays owned', () => {
    const start = [of('helm', 'old', { equipped: { slotId: 'head', order: 3 } }), of('helm', 'new')];
    const { copies } = applyInventoryOps(start, [{ kind: 'equip', copyId: 'new' }], call());
    expect(copies).toEqual([of('helm', 'old'), of('helm', 'new', { equipped: { slotId: 'head', order: 4 } })]);
  });

  it('unequips the longest equipped first when a slot is full, and the dagger rejoins its stack', () => {
    const start = [
      of('dagger', 'late', { equipped: { slotId: 'hand', order: 5 } }),
      of('dagger', 'early', { equipped: { slotId: 'hand', order: 2 } }),
      of('dagger', 'pack'),
    ];
    const { copies } = applyInventoryOps(start, [{ kind: 'equip', copyId: 'pack' }], call());
    expect(copies.filter((c) => c.equipped).map((c) => c.equipped?.order).sort()).toEqual([5, 6]);
    expect(copies.filter((c) => !c.equipped).map((c) => c.quantity)).toEqual([1]);
  });

  it('keeps an item equipped while the slot has room', () => {
    const start = [of('dagger', 'a', { equipped: { slotId: 'hand', order: 1 } }), of('dagger', 'b')];
    const { copies } = applyInventoryOps(start, [{ kind: 'equip', copyId: 'b' }], call());
    expect(copies.every((c) => c.equipped)).toBe(true);
  });

  it("keeps another owner's equipped items out of the swap", () => {
    const start = [of('helm', 'theirs', { where: bramWhere, equipped: { slotId: 'head', order: 1 } }), of('helm', 'mine')];
    const { copies } = applyInventoryOps(start, [{ kind: 'equip', copyId: 'mine' }], call());
    expect(copies.every((c) => c.equipped)).toBe(true);
  });

  it('merges a swapped-out copy into the stack it equips from, then splits one off', () => {
    const start = [
      of('dagger', 'a', { equipped: { slotId: 'hand', order: 1 } }), of('dagger', 'b', { equipped: { slotId: 'hand', order: 2 } }),
      of('dagger', 's'),
    ];
    const { copies } = applyInventoryOps(start, [{ kind: 'equip', copyId: 's' }], call());
    expect(copies.find((c) => c.id === 's')).toEqual(of('dagger', 's'));
    expect(copies.filter((c) => c.equipped).map((c) => c.equipped?.order)).toEqual([2, 3]);
  });

  it('unequips into the matching carried stack, never into another visibility', () => {
    const start = [
      of('dagger', 'e', { equipped: { slotId: 'hand', order: 1 } }), of('dagger', 'stack', { quantity: 2 }),
      of('dagger', 'hid', { visibility: 'hidden' }),
    ];
    const { copies } = applyInventoryOps(start, [{ kind: 'unequip', copyId: 'e' }], call());
    expect(copies).toEqual([of('dagger', 'stack', { quantity: 3 }), of('dagger', 'hid', { visibility: 'hidden' })]);
  });

  it('drops part of a stack at the location, and the rest stays carried', () => {
    const { copies } = applyInventoryOps(
      [copy('p', { quantity: 5 })], [{ kind: 'transfer', copyId: 'p', to: cellar, quantity: 2 }], call({ presence }),
    );
    expect(copies).toEqual([copy('p', { quantity: 3 }), copy('c0', { where: cellar, quantity: 2 })]);
  });

  it('gives a whole equipped copy: it unequips and merges into the receiver stack', () => {
    const start = [of('dagger', 'e', { equipped: { slotId: 'hand', order: 1 } }), of('dagger', 'theirs', { where: bramWhere })];
    const { copies } = applyInventoryOps(start, [{ kind: 'transfer', copyId: 'e', to: bramWhere }], call({ presence }));
    expect(copies).toEqual([of('dagger', 'theirs', { where: bramWhere, quantity: 2 })]);
  });

  it('keeps each copy of an item that does not stack its own row', () => {
    const start = [of('wand', 'w1', { state: { uses: 1 } }), of('wand', 'w2', { where: bramWhere, state: { uses: 3 } })];
    const { copies } = applyInventoryOps(start, [{ kind: 'transfer', copyId: 'w1', to: bramWhere }], call());
    expect(copies.map((c) => c.state?.uses)).toEqual([3, 1]);
  });

  it('refuses a panel drop or give of a Bound copy, and lets the pass and scripts move it', () => {
    const start = [of('crown', 'k')];
    const ops = [{ kind: 'transfer', copyId: 'k', to: cellar } as const];
    const panel = applyInventoryOps(start, ops, call());
    expect(panel.copies).toEqual(start);
    expect(panel.diagnostics).toEqual(['Inventory (panel) skipped transfer: Item Copy k is Bound']);
    expect(applyInventoryOps(start, [{ kind: 'lose', copyId: 'k' }], call()).copies).toEqual(start);
    for (const source of ['pass', 'script'] as const) {
      expect(applyInventoryOps(start, ops, call({ source })).copies).toEqual([of('crown', 'k', { where: cellar })]);
      expect(applyInventoryOps(start, [{ kind: 'lose', copyId: 'k' }], call({ source })).copies).toEqual([]);
    }
    expect(applyInventoryOps(start, [{ kind: 'equip', copyId: 'k' }], call()).copies[0].equipped).toBeDefined();
  });

  it('lets the panel pick up a Bound copy lying here', () => {
    const lying = [of('crown', 'k', { where: cellar })];
    const { copies, diagnostics } = applyInventoryOps(lying, [{ kind: 'transfer', copyId: 'k', to: { kind: 'you' } }], call({ presence }));
    expect(diagnostics).toEqual([]);
    expect(copies).toEqual([of('crown', 'k')]);
  });

  it('refuses an owner or location that is not present', () => {
    const away = { locationId: 'hall', entityIds: new Set<string>() };
    const start = [copy('p'), copy('b', { where: bramWhere })];
    const result = applyInventoryOps(start, [
      { kind: 'transfer', copyId: 'p', to: bramWhere },
      { kind: 'transfer', copyId: 'p', to: cellar },
      { kind: 'lose', copyId: 'b' },
      { kind: 'gain', itemId: 'potion', quantity: 1, to: cellar },
    ], call({ presence: away }));
    expect(result.copies).toEqual(start);
    expect(result.diagnostics).toEqual([
      'Inventory (panel) skipped transfer: entity bram is not present',
      'Inventory (panel) skipped transfer: location cellar is not present',
      'Inventory (panel) skipped lose: Item Copy b is not present',
      'Inventory (panel) skipped gain: location cellar is not present',
    ]);
  });

  it('skips an invalid operation with a diagnostic and applies the rest', () => {
    const result = applyInventoryOps([copy('p', { quantity: 2 }), of('helm', 'h')], [
      { kind: 'lose', copyId: 'p', quantity: 1 },
      { kind: 'equip', copyId: 'p' },
      { kind: 'lose', copyId: 'missing' },
      { kind: 'lose', copyId: 'p', quantity: 9 },
      { kind: 'unequip', copyId: 'h' },
      { kind: 'gain', itemId: 'gone', quantity: 1, to: you },
      { kind: 'gain', itemId: 'potion', quantity: 0, to: you },
      { kind: 'transfer', copyId: 'p', to: you },
      { kind: 'equip', copyId: 'h' },
    ], call());
    expect(result.copies).toEqual([copy('p'), of('helm', 'h', { equipped: { slotId: 'head', order: 1 } })]);
    expect(result.diagnostics).toEqual([
      'Inventory (panel) skipped equip: Item Copy p has no slot',
      'Inventory (panel) skipped lose: no Item Copy missing',
      'Inventory (panel) skipped lose: quantity 9 does not fit 1',
      'Inventory (panel) skipped unequip: Item Copy h is not equipped',
      'Inventory (panel) skipped gain: no item gone',
      'Inventory (panel) skipped gain: quantity 0 is not above 0',
      'Inventory (panel) skipped transfer: Item Copy p is already at you',
    ]);
  });

  describe("the owner's Body in force", () => {
    const dog = bodyFixture({ id: 'dog', name: 'Dog', entries: [{ slotId: 'collar' }] });
    const imp = bodyFixture({ id: 'imp', name: 'Imp', entries: [{ slotId: 'hand' }] });
    const bodies = [humanoid, dog, imp];
    const withPicks = (entities: { id: string; body?: { kind: 'none' } | { kind: 'body'; id: string }; customPersona?: boolean }[], over: Partial<InventoryCall> = {}) =>
      call({ world: { items, slots: [hand, head], bodies, entities }, ...over });

    it("refuses an equip into a slot the owner's Body lacks, and the copy stays carried", () => {
      const result = applyInventoryOps(
        [of('helm', 'h', { where: bramWhere })], [{ kind: 'equip', copyId: 'h' }], withPicks([{ id: 'bram', body: { kind: 'body', id: 'dog' } }]),
      );
      expect(result.copies).toEqual([of('helm', 'h', { where: bramWhere })]);
      expect(result.diagnostics).toEqual(['Inventory (panel) skipped equip: no Head slot on entity bram']);
    });

    it('refuses every equip for an owner whose pick is None', () => {
      const result = applyInventoryOps(
        [of('dagger', 'd', { where: bramWhere })], [{ kind: 'equip', copyId: 'd' }], withPicks([{ id: 'bram', body: { kind: 'none' } }]),
      );
      expect(result.copies[0].equipped).toBeUndefined();
      expect(result.diagnostics).toEqual(['Inventory (panel) skipped equip: no Hand slot on entity bram']);
    });

    it("reads capacity from the owner's Body entry: one Hand swaps out where two Hands keep both", () => {
      const start = [of('dagger', 'a', { where: bramWhere, equipped: { slotId: 'hand', order: 1 } }), of('dagger', 'b', { where: bramWhere })];
      const two = applyInventoryOps(start, [{ kind: 'equip', copyId: 'b' }], withPicks([{ id: 'bram' }])).copies;
      expect(two.every((c) => c.equipped)).toBe(true);
      const one = applyInventoryOps(start, [{ kind: 'equip', copyId: 'b' }], withPicks([{ id: 'bram', body: { kind: 'body', id: 'imp' } }])).copies;
      expect(one.filter((c) => c.equipped).map((c) => c.quantity)).toEqual([1]);
    });

    it('equips the played Persona through the Custom Persona pick under None, and a world persona through its own', () => {
      const entities = [{ id: 'me', customPersona: true, body: { kind: 'body', id: 'dog' } as const }, { id: 'knight' }];
      const none = applyInventoryOps([of('helm', 'h')], [{ kind: 'equip', copyId: 'h' }], withPicks(entities, { persona: { source: 'none' } }));
      expect(none.diagnostics).toEqual(['Inventory (panel) skipped equip: no Head slot on you']);
      const knight = applyInventoryOps(
        [of('helm', 'h')], [{ kind: 'equip', copyId: 'h' }], withPicks(entities, { persona: { source: 'world', entityId: 'knight' } }),
      );
      expect(knight.copies[0].equipped).toEqual({ slotId: 'head', order: 1 });
    });

    it('gives no owner a slot in a world with no Bodies', () => {
      const result = applyInventoryOps([of('helm', 'h')], [{ kind: 'equip', copyId: 'h' }], call({ world: { items, slots: [hand, head] } }));
      expect(result.diagnostics).toEqual(['Inventory (panel) skipped equip: no Head slot on you']);
    });
  });

  it('refuses to equip a copy lying at a location, or one already equipped', () => {
    const result = applyInventoryOps(
      [of('helm', 'here', { where: cellar }), of('helm', 'on', { equipped: { slotId: 'head', order: 1 } })],
      [{ kind: 'equip', copyId: 'here' }, { kind: 'equip', copyId: 'on' }], call(),
    );
    expect(result.diagnostics).toEqual([
      'Inventory (panel) skipped equip: Item Copy here has no owner',
      'Inventory (panel) skipped equip: Item Copy on is already equipped',
    ]);
  });

  it('gains into a stack, or one copy each with full uses for an item that does not stack', () => {
    const { copies } = applyInventoryOps([copy('p', { quantity: 2 })], [
      { kind: 'gain', itemId: 'potion', quantity: 3, to: you },
      { kind: 'gain', itemId: 'wand', quantity: 2, to: bramWhere },
    ], call());
    expect(copies).toEqual([
      copy('p', { quantity: 5 }),
      of('wand', 'c1', { where: bramWhere, state: { uses: 3 } }),
      of('wand', 'c2', { where: bramWhere, state: { uses: 3 } }),
    ]);
  });

  it('never changes the Item Copies it was given', () => {
    const start = [of('dagger', 'd', { quantity: 5 })];
    const frozen = structuredClone(start);
    applyInventoryOps(start, [{ kind: 'equip', copyId: 'd' }, { kind: 'lose', copyId: 'd', quantity: 1 }], call());
    expect(start).toEqual(frozen);
  });
});

describe('presentEntityIds', () => {
  it('reads positions over authored membership', () => {
    const cast = [
      { id: 'a', name: 'A', locations: ['cellar'] }, { id: 'b', name: 'B', locations: ['cellar'] },
      { id: 'c', name: 'C', locations: ['hall'] },
    ] as Entity[];
    expect(presentEntityIds(cast, { positions: { b: 'hall', c: 'cellar' }, groups: {} }, 'cellar')).toEqual(['a', 'c']);
    expect(presentEntityIds(cast, { positions: {}, groups: {} }, null)).toEqual([]);
  });
});

describe('a use on a target', () => {
  const call: InventoryCall = { world: { items: [potion, wand] }, source: 'script', newId: ids() };
  const copy = (id: string, itemId: string): ItemCopy => ({ id, item: { kind: 'item', itemId }, where: you, quantity: 1, visibility: 'visible' });

  it('carries the target copy, as it stood, on the used event', () => {
    const result = applyInventoryOps([copy('w', 'wand'), copy('p', 'potion')], [{ kind: 'use', copyId: 'w', targetCopyId: 'p' }], call);
    expect(result.events.map((e) => [e.timing, e.target])).toEqual([['used', copy('p', 'potion')]]);
  });

  it('uses the item on nothing when the target is missing or is the used copy itself', () => {
    for (const targetCopyId of ['gone', 'w']) {
      const result = applyInventoryOps([copy('w', 'wand')], [{ kind: 'use', copyId: 'w', targetCopyId }], call);
      expect(result.events.map((e) => e.target)).toEqual([undefined]);
      expect(result.copies.map((c) => c.state?.uses)).toEqual([2]);
      expect(result.diagnostics).toEqual([`Inventory (script) used Item Copy w on nothing: no Item Copy ${targetCopyId}`]);
    }
  });
});
