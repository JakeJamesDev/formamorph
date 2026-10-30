import { describe, expect, it } from 'vitest';
import { applyInventoryOps, settleInventory, timedEffectViews, timedKey, withoutOrphanTimedTraits, type InventoryOp, type InventorySettleWorld } from '.';
import { activeOwnedTraitIds } from '@/lib/ownedTraitsInPlay';
import { seedStatBases, type TraitRuntimeState, type TraitWorld } from '@/lib/traitRuntime';
import type { Item, ItemCopy, ItemCopyWhere, ItemEffectLedger, ItemStatEffect, ItemTraitEffect, PlayerStat, StatChange, Trait } from '@/types';

const stat = (id: string, value: number, max = 10): PlayerStat => ({ id, name: id[0].toUpperCase() + id.slice(1), value, min: 0, max } as PlayerStat);
let r = 0;
const hours = (n: number) => ({ kind: 'time', hours: n }) as const;
const PERMANENT = { kind: 'permanent' } as const;
const after = (statId: string, amount: number, duration: ItemStatEffect['duration'], facet: ItemStatEffect['facet'] = 'value'): ItemStatEffect =>
  ({ id: `s${r++}`, statId, facet, timing: 'used', duration, amount, op: 'add' });
const grantAfter = (traitId: string, duration: ItemTraitEffect['duration']): ItemTraitEffect =>
  ({ id: `t${r++}`, traitId, timing: 'used', duration });
const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const trait = (id: string, statChanges: StatChange[] = []): Trait =>
  ({ id, name: id[0].toUpperCase() + id.slice(1), statChanges, playerToggle: true });

const hasted = trait('hasted', [{ statId: 'speed', value: 3, type: 'starting' }]);
const might = item('might', 'Potion of Might', { uses: 1, statEffects: [after('strength', 2, hours(2))] });
const elixir = item('elixir', 'Elixir', { uses: 1, statEffects: [after('strength', 1, PERMANENT)] });
const giant = item('giant', 'Giant Draught', { uses: 1, statEffects: [after('strength', 5, hours(1), 'max')] });
const haste = item('haste', 'Haste Tonic', { uses: 1, traitEffects: [grantAfter('hasted', hours(2))] });
const wand = item('wand', 'Ash Wand', { uses: 3, whenEmpty: { kind: 'stays' }, statEffects: [after('strength', 1, hours(1))] });
const flask = item('flask', 'Triple Flask', { uses: 3, whenEmpty: { kind: 'gone' } });
const rock = item('rock', 'Rock');
const items = [might, elixir, giant, haste, wand, flask, rock];

const hero = { kind: 'entity', id: 'hero' } as const;
const room = { kind: 'location', id: 'room' } as const;
const owners = [{ id: 'hero', name: 'Hero', traits: [hasted], groups: [] }];
const traitWorld = (copies: readonly ItemCopy[] = []): TraitWorld => ({
  traits: [], groups: [], entities: [{ id: 'hero', name: 'Hero' }, { id: 'ally', name: 'Ally' }], persona: { source: 'world', entityId: 'hero' },
  global: { traits: [], groups: [] }, owners, items, itemCopies: copies,
});
const world = (list: readonly Item[] = items): InventorySettleWorld => ({ items: list, traits: { ...traitWorld(), items: list } });

interface Play { copies: readonly ItemCopy[]; traits: TraitRuntimeState; ledger: ItemEffectLedger | undefined; log: string[]; skipped: string[]; now: number }

const start = (stats: PlayerStat[]): Play => ({
  copies: [],
  traits: { stats: [], traits: [], disabledTraitIds: [], appliedValues: {}, entityStats: { hero: seedStatBases(stats) }, ownedTraits: { hero: { chosen: [] } } },
  ledger: undefined, log: [], skipped: [], now: 0,
});

/** Every writer's path: the validator, then the inventory settle with its uses at the play's clock. */
function act(play: Play, ops: InventoryOp[], list: readonly Item[] = items): Play {
  let n = play.copies.length;
  const { copies, itemUses, diagnostics } = applyInventoryOps(play.copies, ops, { world: { items: list }, source: 'panel', newId: () => `c${n++}-${play.now}` });
  const settled = settleInventory({ copies, previous: play.copies, traits: play.traits, ledger: play.ledger, itemUses, now: play.now }, world(list));
  return { ...play, copies: settled.copies, traits: settled.traits, ledger: settled.ledger, log: settled.log, skipped: diagnostics };
}
/** The clock advances, then the turn commit settles. */
const advance = (play: Play, by: number, list: readonly Item[] = items): Play => act({ ...play, now: play.now + by }, [], list);
const gain = (itemId: string, quantity = 1, to: ItemCopyWhere = hero): InventoryOp => ({ kind: 'gain', itemId, quantity, to });
const copiesOf = (play: Play, itemId: string) => play.copies.filter((c) => c.item.kind === 'item' && c.item.itemId === itemId);
const use = (play: Play, itemId: string, at = 0): InventoryOp => ({ kind: 'use', copyId: copiesOf(play, itemId)[at].id });
const heroStat = (play: Play, id: string) => play.traits.entityStats!.hero.find((s) => s.id === id)!;
const on = (play: Play) => activeOwnedTraitIds(play.traits.ownedTraits ?? {}).hero ?? [];

describe('using an item', () => {
  it('leaves two of a stack of three and starts its After Use effects', () => {
    let play = act(start([stat('strength', 3)]), [gain('might', 3)]);
    play = act(play, [use(play, 'might')]);
    expect(copiesOf(play, 'might').map((c) => c.quantity)).toEqual([2]);
    expect(heroStat(play, 'strength').value).toBe(5);
    expect(play.log).toContain('Potion of Might: Strength +2');
  });

  it('removes the last one of a stack', () => {
    let play = act(start([stat('strength', 3)]), [gain('might')]);
    play = act(play, [use(play, 'might')]);
    expect(copiesOf(play, 'might')).toEqual([]);
  });

  it('skips an item that can’t be used, and one lying at a location', () => {
    let play = act(start([]), [gain('rock'), gain('might', 1, room)]);
    play = act(play, [use(play, 'rock'), use(play, 'might')]);
    expect(play.skipped).toEqual([
      `Inventory (panel) skipped use: Item Copy ${copiesOf(play, 'rock')[0].id} can't be used`,
      `Inventory (panel) skipped use: Item Copy ${copiesOf(play, 'might')[0].id} has no owner`,
    ]);
    expect(copiesOf(play, 'might')[0].quantity).toBe(1);
  });
});

describe('timed effects', () => {
  it('ends a two-hour effect once the clock passes two hours, reversing exactly what it moved', () => {
    let play = act(start([stat('strength', 9)]), [gain('might')]);
    play = act(play, [use(play, 'might')]);
    // The cap held the raise to 1, so expiry gives back 1.
    expect(heroStat(play, 'strength').value).toBe(10);
    play = advance(play, 1);
    expect(heroStat(play, 'strength').value).toBe(10);
    expect(Object.keys(play.ledger?.timed ?? {})).toHaveLength(1);
    play = advance(play, 1);
    expect(heroStat(play, 'strength').value).toBe(9);
    expect(play.ledger?.timed).toBeUndefined();
    expect(play.log).toContain('Potion of Might: Strength -1');
  });

  it('never ends a Permanent effect, and applies it on every use', () => {
    let play = act(start([stat('strength', 3)]), [gain('elixir', 2)]);
    play = act(play, [use(play, 'elixir')]);
    play = act(play, [use(play, 'elixir')]);
    play = advance(play, 10000);
    expect(heroStat(play, 'strength').value).toBe(5);
    expect(play.ledger?.timed).toBeUndefined();
  });

  it('applies a use once when it sets off an unequip', () => {
    const sword = item('sword', 'Sword', { slotId: 'hand', equipRequires: [{ all: [{ kind: 'stat', id: 'strength', operator: '>=', value: 5, unit: 'raw' }] }] });
    const sap = item('sap', 'Weakening Sap', { uses: 1, statEffects: [after('strength', -1, PERMANENT)] });
    const list = [...items, sword, sap];
    let n = 0;
    const slots = [{ id: 'hand', name: 'Hand' }];
    let play = act(start([stat('strength', 5)]), [gain('sword'), gain('sap')], list);
    const equipped = applyInventoryOps(play.copies, [{ kind: 'equip', copyId: copiesOf(play, 'sword')[0].id }], { world: { items: list, slots }, source: 'panel', newId: () => `e${n++}` });
    play = { ...play, copies: equipped.copies };
    play = act(play, [use(play, 'sap')], list);
    expect(copiesOf(play, 'sword')[0].equipped).toBeUndefined();
    expect(heroStat(play, 'strength').value).toBe(4);
  });

  it('restarts the timer on a second use and does not stack the effect', () => {
    let play = act(start([stat('strength', 3)]), [gain('might', 2)]);
    play = act(play, [use(play, 'might')]);
    play = advance(play, 1);
    play = act(play, [use(play, 'might')]);
    expect(heroStat(play, 'strength').value).toBe(5);
    play = advance(play, 1.5);
    expect(heroStat(play, 'strength').value).toBe(5);
    play = advance(play, 0.5);
    expect(heroStat(play, 'strength').value).toBe(3);
  });

  it('raises a bound while it runs and drops it at the end', () => {
    let play = act(start([stat('strength', 3)]), [gain('giant')]);
    play = act(play, [use(play, 'giant')]);
    expect(heroStat(play, 'strength').max).toBe(15);
    play = advance(play, 1);
    expect(heroStat(play, 'strength').max).toBe(10);
  });

  it('grants a trait while it runs, refreshes it on a second use, and switches it off at the end', () => {
    let play = act(start([stat('speed', 1)]), [gain('haste', 2)]);
    play = act(play, [use(play, 'haste')]);
    expect(on(play)).toEqual(['hasted']);
    expect(heroStat(play, 'speed').value).toBe(4);
    play = advance(play, 1);
    play = act(play, [use(play, 'haste')]);
    play = advance(play, 1.5);
    expect(on(play)).toEqual(['hasted']);
    play = advance(play, 0.5);
    expect(on(play)).toEqual([]);
    expect(heroStat(play, 'speed').value).toBe(1);
    expect(play.log).toContain('Trait switched off: Hasted (by Haste Tonic)');
  });

  it('grants a Permanent trait for good, and skips a trait the owner lacks', () => {
    const vow = item('vow', 'Vow Scroll', { uses: 1, traitEffects: [grantAfter('hasted', PERMANENT), grantAfter('missing', hours(1))] });
    const list = [...items, vow];
    let play = act(start([stat('speed', 1)]), [gain('vow')], list);
    play = act(play, [use(play, 'vow')], list);
    expect(play.log).toContain('Item Vow Scroll: owner hero has no trait missing');
    play = advance(play, 10000, list);
    expect(on(play)).toEqual(['hasted']);
    expect(play.ledger?.firstObtainTraits).toEqual({ hero: ['hasted'] });
  });

  it('lists the owner\'s running effects for the panel, soonest end first, hidden ones unnamed', () => {
    let play = act(start([stat('strength', 3), stat('speed', 1)]), [gain('might'), gain('haste')]);
    play = act(play, [use(play, 'haste')]);
    play = advance(play, 0.5);
    play = act(play, [use(play, 'might')]);
    const hiddenMight: ItemCopy = { id: 'hx', item: { kind: 'item', itemId: 'giant' }, where: hero, quantity: 1, visibility: 'hidden' };
    play = act({ ...play, copies: [...play.copies, hiddenMight] }, [{ kind: 'use', copyId: 'hx' }]);
    const names = { stat: (_o: string, id: string) => id.toUpperCase(), trait: (_o: string, id: string) => `Trait ${id}` };
    expect(timedEffectViews(play.ledger, items, ['hero'], play.now, names).map((v) => [v.itemName, v.effect, v.hoursLeft])).toEqual([
      [null, 'Max STRENGTH +5', 1], ['Haste Tonic', 'Trait hasted', 1.5], ['Potion of Might', 'STRENGTH +2', 2],
    ]);
    expect(timedEffectViews(play.ledger, items, ['ally'], play.now, names)).toEqual([]);
  });

  it('names no item for a use from a hidden Item Copy', () => {
    const play = start([stat('strength', 3)]);
    const hidden: ItemCopy = { id: 'h', item: { kind: 'item', itemId: 'might' }, where: hero, quantity: 1, visibility: 'hidden' };
    const used = act({ ...play, copies: [hidden] }, [{ kind: 'use', copyId: 'h' }]);
    expect(used.log).toContain('An item: Strength +2');
  });

  it('survives a save round trip and still ends on time', () => {
    let play = act(start([stat('strength', 3)]), [gain('might')]);
    play = act(play, [use(play, 'might')]);
    const saved = JSON.parse(JSON.stringify({ copies: play.copies, traits: play.traits, ledger: play.ledger })) as Pick<Play, 'copies' | 'traits' | 'ledger'>;
    play = advance({ ...play, ...saved }, 2);
    expect(heroStat(play, 'strength').value).toBe(3);
  });

  it('drops a running effect whose item no longer exists and gives back what it moved', () => {
    let play = act(start([stat('strength', 3)]), [gain('might')]);
    play = act(play, [use(play, 'might')]);
    const without = items.filter((i) => i !== might);
    play = advance(play, 0, without);
    expect(heroStat(play, 'strength').value).toBe(3);
    expect(play.ledger?.timed).toBeUndefined();
  });
});

describe('withoutOrphanTimedTraits', () => {
  it('drops a timed trait row whose item or owner is gone, and keeps the rest', () => {
    let play = act(start([stat('speed', 1), stat('strength', 3)]), [gain('haste'), gain('might')]);
    play = act(play, [use(play, 'haste'), use(play, 'might')]);
    const ledger = play.ledger!;
    expect(withoutOrphanTimedTraits(ledger, { entityIds: new Set(['hero']) }, items)).toEqual({ ledger, dropped: [] });
    const noItem = withoutOrphanTimedTraits(ledger, { entityIds: new Set(['hero']) }, items.filter((i) => i !== haste));
    expect(noItem.dropped).toEqual([timedKey('hero', 'haste', haste.traitEffects[0].id)]);
    expect(Object.values(noItem.ledger.timed ?? {}).map((e) => e.itemId)).toEqual(['might']);
    expect(withoutOrphanTimedTraits(ledger, { entityIds: new Set() }, items).dropped).toHaveLength(1);
  });
});

describe('uses and When Empty', () => {
  it('keeps a three-use wand that Stays at zero, and refuses a fourth use', () => {
    let play = act(start([stat('strength', 3)]), [gain('wand')]);
    for (let i = 0; i < 3; i += 1) play = act(play, [use(play, 'wand')]);
    expect(copiesOf(play, 'wand').map((c) => c.state?.uses)).toEqual([0]);
    play = act(play, [use(play, 'wand')]);
    expect(play.skipped).toEqual([`Inventory (panel) skipped use: Item Copy ${copiesOf(play, 'wand')[0].id} has no uses left`]);
  });

  it('removes a three-use item that is Gone after the third use', () => {
    let play = act(start([]), [gain('flask')]);
    play = act(play, [use(play, 'flask')]);
    play = act(play, [use(play, 'flask')]);
    expect(copiesOf(play, 'flask').map((c) => c.state?.uses)).toEqual([1]);
    play = act(play, [use(play, 'flask')]);
    expect(copiesOf(play, 'flask')).toEqual([]);
  });

  it('reads a blank When Empty as Gone', () => {
    const scroll = item('scroll', 'Scroll', { uses: 2 });
    const list = [...items, scroll];
    let play = act(start([]), [gain('scroll')], list);
    play = act(play, [use(play, 'scroll')], list);
    play = act(play, [use(play, 'scroll')], list);
    expect(copiesOf(play, 'scroll')).toEqual([]);
  });

  it('keeps each wand its own count when one is given away', () => {
    let play = act(start([stat('strength', 3)]), [gain('wand', 2)]);
    play = act(play, [use(play, 'wand', 0), use(play, 'wand', 0)]);
    const [spent, full] = copiesOf(play, 'wand');
    play = act(play, [{ kind: 'transfer', copyId: full.id, to: { kind: 'entity', id: 'ally' } }]);
    expect(play.copies.find((c) => c.id === spent.id)?.state?.uses).toBe(1);
    expect(play.copies.find((c) => c.id === full.id)).toMatchObject({ where: { kind: 'entity', id: 'ally' }, state: { uses: 3 } });
  });

  it('stacks an item with Uses 1 and keeps one with Uses 2 apart', () => {
    const pair = item('pair', 'Pair Charm', { uses: 2 });
    const list = [...items, pair];
    const play = act(start([]), [gain('might', 3), gain('pair', 2)], list);
    expect(copiesOf(play, 'might').map((c) => c.quantity)).toEqual([3]);
    expect(copiesOf(play, 'pair').map((c) => [c.quantity, c.state?.uses])).toEqual([[1, 2], [1, 2]]);
  });

  it('splits a spent Uses 1 copy that Stays off its stack, and merges a second spent one into it', () => {
    const lamp = item('lamp', 'Oil Lamp', { uses: 1, whenEmpty: { kind: 'stays' } });
    const list = [...items, lamp];
    let play = act(start([]), [gain('lamp', 3)], list);
    play = act(play, [use(play, 'lamp')], list);
    expect(copiesOf(play, 'lamp').map((c) => [c.quantity, c.state?.uses ?? 1])).toEqual([[2, 1], [1, 0]]);
    play = act(play, [use(play, 'lamp')], list);
    expect(copiesOf(play, 'lamp').map((c) => [c.quantity, c.state?.uses ?? 1])).toEqual([[1, 1], [2, 0]]);
    play = act(play, [use(play, 'lamp', 1)], list);
    expect(play.skipped).toEqual([`Inventory (panel) skipped use: Item Copy ${copiesOf(play, 'lamp')[1].id} has no uses left`]);
  });

  it('turns one copy of a stack into a carried copy of its Becomes target, seeded with its own Uses', () => {
    const bottle = item('bottle', 'Empty Bottle', { uses: 2, whenEmpty: { kind: 'stays' } });
    const potion = item('potion', 'Potion', { uses: 1, whenEmpty: { kind: 'becomes', itemId: 'bottle' }, statEffects: [after('strength', 1, PERMANENT)] });
    const list = [...items, bottle, potion];
    let play = act(start([stat('strength', 3)]), [gain('potion', 2)], list);
    play = act(play, [use(play, 'potion')], list);
    expect(copiesOf(play, 'potion').map((c) => c.quantity)).toEqual([1]);
    expect(copiesOf(play, 'bottle')).toMatchObject([{ where: hero, quantity: 1, state: { uses: 2 } }]);
    expect(heroStat(play, 'strength').value).toBe(4);
  });

  it('keeps a hidden copy’s Becomes result hidden', () => {
    const bottle = item('bottle', 'Empty Bottle');
    const potion = item('potion', 'Potion', { uses: 1, whenEmpty: { kind: 'becomes', itemId: 'bottle' } });
    const list = [...items, bottle, potion];
    const hidden: ItemCopy = { id: 'hp', item: { kind: 'item', itemId: 'potion' }, where: hero, quantity: 1, visibility: 'hidden' };
    const play = act({ ...start([]), copies: [hidden] }, [{ kind: 'use', copyId: 'hp' }], list);
    expect(copiesOf(play, 'bottle')).toMatchObject([{ where: hero, visibility: 'hidden' }]);
  });

  it('carries the Becomes result even when the used copy was equipped', () => {
    const shard = item('shard', 'Cracked Gem');
    const gem = item('gem', 'Focus Gem', { slotId: 'hand', stackable: false, uses: 1, whenEmpty: { kind: 'becomes', itemId: 'shard' } });
    const list = [...items, shard, gem];
    let n = 0;
    let play = act(start([]), [gain('gem')], list);
    const equipped = applyInventoryOps(play.copies, [{ kind: 'equip', copyId: copiesOf(play, 'gem')[0].id }], { world: { items: list, slots: [{ id: 'hand', name: 'Hand' }] }, source: 'panel', newId: () => `e${n++}` });
    play = { ...play, copies: equipped.copies };
    expect(copiesOf(play, 'gem')[0].equipped).toBeDefined();
    play = act(play, [use(play, 'gem')], list);
    expect(copiesOf(play, 'gem')).toEqual([]);
    expect(copiesOf(play, 'shard')).toMatchObject([{ where: hero, quantity: 1 }]);
    expect(copiesOf(play, 'shard')[0].equipped).toBeUndefined();
  });

  it('removes the copy as Gone with a diagnostic when its Becomes target is missing', () => {
    const potion = item('potion', 'Potion', { uses: 1, whenEmpty: { kind: 'becomes', itemId: 'gone-item' } });
    const list = [...items, potion];
    let play = act(start([]), [gain('potion')], list);
    const id = copiesOf(play, 'potion')[0].id;
    play = act(play, [use(play, 'potion')], list);
    expect(copiesOf(play, 'potion')).toEqual([]);
    expect(play.skipped).toEqual([`Inventory (panel) removed Item Copy ${id} as Gone: gain: no item gone-item`]);
  });

  it('fires the effects of an item with no Uses and leaves the copy as it was', () => {
    const horn = item('horn', 'War Horn', { statEffects: [after('strength', 1, PERMANENT)] });
    const list = [...items, horn];
    let play = act(start([stat('strength', 3)]), [gain('horn')], list);
    const before = copiesOf(play, 'horn');
    play = act(play, [use(play, 'horn')], list);
    play = act(play, [use(play, 'horn')], list);
    expect(copiesOf(play, 'horn')).toEqual(before);
    expect(heroStat(play, 'strength').value).toBe(5);
  });

  it('lets a When Used script alone make an item usable', () => {
    const bell = item('bell', 'Bell', { scripts: [{ id: 'b', timing: 'used', code: '' }] });
    const list = [...items, bell];
    let play = act(start([]), [gain('bell')], list);
    play = act(play, [use(play, 'bell')], list);
    expect(play.skipped).toEqual([]);
    expect(copiesOf(play, 'bell')).toHaveLength(1);
  });

  it('removes one of a runtime item on use', () => {
    const runtimeItems = [{ id: 'rt-cake', name: 'Honey Cake' }];
    let n = 0;
    const call = { world: { items }, source: 'pass' as const, newId: () => `r${n++}`, runtimeItems };
    const gained = applyInventoryOps([], [{ kind: 'gain', itemId: 'rt-cake', quantity: 2, to: hero }], call);
    const used = applyInventoryOps(gained.copies, [{ kind: 'use', copyId: gained.copies[0].id }], call);
    expect(used.copies.map((c) => c.quantity)).toEqual([1]);
    expect(used.itemUses).toEqual([]);
  });

  it('clamps setUses to the item’s Uses and merges a refilled copy back into its stack', () => {
    const lamp = item('lamp', 'Oil Lamp', { uses: 1, whenEmpty: { kind: 'stays' } });
    const list = [...items, lamp];
    let play = act(start([]), [gain('lamp', 2), gain('rock')], list);
    play = act(play, [use(play, 'lamp')], list);
    play = act(play, [{ kind: 'setUses', copyId: copiesOf(play, 'lamp')[1].id, uses: 9 }], list);
    expect(copiesOf(play, 'lamp').map((c) => [c.quantity, c.state?.uses ?? 1])).toEqual([[2, 1]]);
    const rockId = copiesOf(play, 'rock')[0].id;
    play = act(play, [{ kind: 'setUses', copyId: rockId, uses: 1 }], list);
    expect(play.skipped).toEqual([`Inventory (panel) skipped setUses: Item Copy ${rockId} has no Uses`]);
  });
});
