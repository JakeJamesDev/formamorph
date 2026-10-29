import { describe, expect, it } from 'vitest';
import { applyInventoryOps, itemEffectLine, settleItemEffects, type InventoryOp, type ItemEffectWorld } from '.';
import { seedStatBases } from '@/lib/traitRuntime';
import type { EntityStatValues, Item, ItemCopy, ItemEffectLedger, ItemStatEffect, PlayerStat, Slot } from '@/types';

const stat = (id: string, value: number, max = 10, min = 0): PlayerStat =>
  ({ id, name: id[0].toUpperCase() + id.slice(1), value, min, max } as PlayerStat);
let r = 0;
const row = (statId: string, amount: number, timing: ItemStatEffect['timing'], facet: ItemStatEffect['facet'] = 'value'): ItemStatEffect =>
  ({ id: `r${r++}`, statId, facet, timing, amount, op: 'add' });
const item = (id: string, over: Partial<Item> = {}): Item =>
  ({ id, name: id === 'sword' ? 'Iron Sword' : id, statEffects: [], traitEffects: [], equipRequires: [], ...over });

const hand: Slot = { id: 'hand', name: 'Hand' };
const ring: Slot = { id: 'ring', name: 'Ring', capacity: 2 };
const sword = item('sword', { stackable: false, slotId: 'hand', statEffects: [row('strength', 2, 'equipped')] });
const amulet = item('amulet', { statEffects: [row('health', 5, 'owned', 'max')] });
const coin = item('coin', { statEffects: [row('luck', 1, 'owned')] });
const charm = item('charm', { stackable: false, statEffects: [row('luck', 1, 'owned')] });
const relic = item('relic', { statEffects: [row('health', 5, 'firstObtain', 'max'), row('luck', 1, 'firstObtain')] });
const band = item('band', { stackable: false, slotId: 'ring', statEffects: [row('luck', 1, 'equipped')] });
const items = [sword, amulet, coin, charm, relic, band];

const hero = { kind: 'entity', id: 'hero' } as const;
const world: ItemEffectWorld = { items, persona: { source: 'world', entityId: 'hero' }, entities: [{ id: 'hero' }] };
const noTraits = () => [];

/** One owner's stats, seeded as a new game seeds them. */
const statsOf = (...stats: PlayerStat[]): EntityStatValues => ({ hero: seedStatBases(stats) });

interface Play { copies: readonly ItemCopy[]; entityStats: EntityStatValues; ledger: ItemEffectLedger | undefined; lines: string[]; diagnostics: string[] }

/** Applies `ops` through the validator, then settles the effects, as every writer does. */
function act(play: Play, ...ops: InventoryOp[]): Play {
  let n = play.copies.length;
  const { copies } = applyInventoryOps(play.copies, ops, { world: { items, slots: [hand, ring] }, source: 'script', newId: () => `c${n++}` });
  const result = settleItemEffects({ copies, entityStats: play.entityStats, ledger: play.ledger }, world, noTraits);
  return {
    copies, entityStats: result.entityStats, ledger: result.ledger,
    lines: result.changes.map((c) => itemEffectLine(c)).filter((l): l is string => !!l), diagnostics: result.diagnostics,
  };
}
const start = (entityStats: EntityStatValues): Play => ({ copies: [], entityStats, ledger: undefined, lines: [], diagnostics: [] });
const heroStat = (play: Play, id: string) => play.entityStats.hero.find((s) => s.id === id)!;
const copyOf = (play: Play, itemId: string) => play.copies.find((c) => c.item.kind === 'item' && c.item.itemId === itemId)!;

describe('settleItemEffects', () => {
  it('raises Strength by 2 while the sword is equipped, and unequipping returns it', () => {
    let play = act(start(statsOf(stat('strength', 5))), { kind: 'gain', itemId: 'sword', quantity: 1, to: hero });
    expect(heroStat(play, 'strength').value).toBe(5);
    play = act(play, { kind: 'equip', copyId: copyOf(play, 'sword').id });
    expect(heroStat(play, 'strength').value).toBe(7);
    expect(play.lines).toEqual(['Iron Sword: Strength +2']);
    play = act(play, { kind: 'unequip', copyId: copyOf(play, 'sword').id });
    expect(heroStat(play, 'strength').value).toBe(5);
    expect(play.lines).toEqual(['Iron Sword: Strength -2']);
    expect(play.ledger).toEqual({});
  });

  it('returns exactly what a clamped gain moved', () => {
    let play = act(start(statsOf(stat('strength', 9))), { kind: 'gain', itemId: 'sword', quantity: 1, to: hero });
    play = act(play, { kind: 'equip', copyId: copyOf(play, 'sword').id });
    expect(heroStat(play, 'strength').value).toBe(10);
    play = act(play, { kind: 'unequip', copyId: copyOf(play, 'sword').id });
    expect(heroStat(play, 'strength').value).toBe(9);
  });

  it('raises the derived maximum for a While Owned max effect and records no value movement', () => {
    let play = act(start(statsOf(stat('health', 6))), { kind: 'gain', itemId: 'amulet', quantity: 1, to: hero });
    expect(heroStat(play, 'health')).toMatchObject({ value: 6, max: 15 });
    expect(Object.values(play.ledger?.applied ?? {}).map((e) => e.values)).toEqual([{}]);
    expect(play.lines).toEqual(['amulet: Max Health +5']);
    play = act(play, { kind: 'lose', copyId: copyOf(play, 'amulet').id });
    expect(heroStat(play, 'health')).toMatchObject({ value: 6, max: 10 });
  });

  it('carries a value resting at its cap up with the max, and the carry reverses through the record (Q110)', () => {
    let play = act(start(statsOf(stat('health', 10))), { kind: 'gain', itemId: 'amulet', quantity: 1, to: hero });
    expect(heroStat(play, 'health')).toMatchObject({ value: 15, max: 15 });
    // Spent below the old cap: the record still gives back only the carry.
    play = { ...play, entityStats: { hero: play.entityStats.hero.map((s) => (s.id === 'health' ? { ...s, value: 12 } : s)) } };
    play = act(play, { kind: 'lose', copyId: copyOf(play, 'amulet').id });
    expect(heroStat(play, 'health')).toMatchObject({ value: 7, max: 10 });
  });

  it('applies a While Owned effect once however many Item Copies the owner has', () => {
    let play = act(start(statsOf(stat('luck', 0))),
      { kind: 'gain', itemId: 'coin', quantity: 3, to: hero }, { kind: 'gain', itemId: 'charm', quantity: 3, to: hero });
    expect(play.copies).toHaveLength(4);
    expect(heroStat(play, 'luck').value).toBe(2);
    // Losing one of three charms keeps its effect.
    play = act(play, { kind: 'lose', copyId: copyOf(play, 'charm').id });
    expect(heroStat(play, 'luck').value).toBe(2);
  });

  it('applies While Equipped once per equipped Item Copy (Q109)', () => {
    let play = act(start(statsOf(stat('luck', 0))), { kind: 'gain', itemId: 'band', quantity: 2, to: hero });
    play = act(play, ...play.copies.map((c): InventoryOp => ({ kind: 'equip', copyId: c.id })));
    expect(heroStat(play, 'luck').value).toBe(2);
  });

  it('applies On First Obtain once per owner, and not again after the item is lost and regained', () => {
    let play = act(start(statsOf(stat('health', 6), stat('luck', 0))), { kind: 'gain', itemId: 'relic', quantity: 1, to: hero });
    expect(heroStat(play, 'health')).toMatchObject({ max: 15, baseMax: 15 });
    expect(heroStat(play, 'luck').value).toBe(1);
    play = act(play, { kind: 'lose', copyId: copyOf(play, 'relic').id });
    expect(heroStat(play, 'health').max).toBe(15);
    play = act(play, { kind: 'gain', itemId: 'relic', quantity: 1, to: hero });
    expect(heroStat(play, 'health').max).toBe(15);
    expect(heroStat(play, 'luck').value).toBe(1);
    expect(play.ledger?.firstObtained).toEqual({ hero: ['relic'] });
  });

  it('keeps On First Obtain for a you owner until a played entity with stats holds it', () => {
    const copies: ItemCopy[] = [{ id: 'r', item: { kind: 'item', itemId: 'relic' }, where: { kind: 'you' }, quantity: 1, visibility: 'visible' }];
    const none = settleItemEffects({ copies, entityStats: {}, ledger: undefined }, { items }, noTraits);
    expect(none.ledger).toEqual({});
    const played = settleItemEffects({ copies, entityStats: statsOf(stat('luck', 0)), ledger: none.ledger }, world, noTraits);
    expect(played.entityStats.hero[0].value).toBe(1);
  });

  it('skips a row whose stat the owner lacks, with one diagnostic', () => {
    let play = act(start(statsOf(stat('health', 5))), { kind: 'gain', itemId: 'coin', quantity: 1, to: hero });
    expect(play.diagnostics).toEqual(['Item coin: owner hero has no stat luck']);
    expect(play.entityStats.hero).toEqual(statsOf(stat('health', 5)).hero);
    play = act(play, { kind: 'gain', itemId: 'coin', quantity: 1, to: hero });
    expect(play.diagnostics).toEqual([]);
  });

  it('resolves a you Item Copy to the played entity, with no Global fallback (Q107)', () => {
    let play = act(start(statsOf(stat('luck', 0))), { kind: 'gain', itemId: 'coin', quantity: 1, to: { kind: 'you' } });
    expect(heroStat(play, 'luck').value).toBe(1);
    const lone = settleItemEffects({ copies: play.copies, entityStats: {}, ledger: undefined }, { items }, noTraits);
    expect(lone.diagnostics).toEqual(['Item coin: owner you has no stat luck']);
    play = act(play, { kind: 'lose', copyId: copyOf(play, 'coin').id });
    expect(heroStat(play, 'luck').value).toBe(0);
  });

  it('names no item for a hidden Item Copy (Q106)', () => {
    const copies: ItemCopy[] = [{ id: 'h', item: { kind: 'item', itemId: 'coin' }, where: hero, quantity: 1, visibility: 'hidden' }];
    const result = settleItemEffects({ copies, entityStats: statsOf(stat('luck', 0)), ledger: undefined }, world, noTraits);
    expect(result.changes.map((c) => itemEffectLine(c))).toEqual(['An item: Luck +1']);
    expect(result.entityStats.hero[0].value).toBe(1);
  });

  it('reverses the effects of an Item Copy that disappears, even when its item no longer exists', () => {
    let play = act(start(statsOf(stat('strength', 5), stat('health', 6))),
      { kind: 'gain', itemId: 'sword', quantity: 1, to: hero }, { kind: 'gain', itemId: 'amulet', quantity: 1, to: hero });
    play = act(play, { kind: 'equip', copyId: copyOf(play, 'sword').id });
    const dropped = settleItemEffects({ copies: [], entityStats: play.entityStats, ledger: play.ledger }, { ...world, items: [] }, noTraits);
    expect(dropped.entityStats.hero.map((s) => [s.id, s.value, s.max])).toEqual([['strength', 5, 10], ['health', 6, 10]]);
    expect(dropped.ledger).toEqual({});
  });

  it('changes nothing when nothing changed', () => {
    const play = act(start(statsOf(stat('luck', 0))), { kind: 'gain', itemId: 'coin', quantity: 1, to: hero });
    const again = settleItemEffects({ copies: play.copies, entityStats: play.entityStats, ledger: play.ledger }, world, noTraits);
    expect(again.entityStats).toBe(play.entityStats);
    expect(again.changes).toEqual([]);
  });
});
