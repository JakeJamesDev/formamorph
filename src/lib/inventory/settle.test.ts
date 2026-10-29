import { describe, expect, it } from 'vitest';
import { applyInventoryOps, equipRequirement, settleInventory, type InventoryOp, type InventorySettleWorld } from '.';
import { groupPickStates } from '@/lib/traitGates';
import { activeOwnedTraitIds } from '@/lib/ownedTraitsInPlay';
import { applyCodeTraitSwitches, seedStatBases, switchPlayerTrait, traitGateInput, type TraitRuntimeState, type TraitWorld } from '@/lib/traitRuntime';
import type {
  Item, ItemCopy, ItemCopyWhere, ItemEffectLedger, ItemStatEffect, ItemTraitEffect, PlayerStat, Slot, StatChange, Trait, TraitGroup,
  TraitRequirementRow,
} from '@/types';

const stat = (id: string, value: number, max = 10): PlayerStat => ({ id, name: id[0].toUpperCase() + id.slice(1), value, min: 0, max } as PlayerStat);
let r = 0;
const statRow = (statId: string, amount: number, timing: ItemStatEffect['timing'] = 'equipped'): ItemStatEffect =>
  ({ id: `s${r++}`, statId, facet: 'value', timing, amount, op: 'add' });
const grant = (traitId: string, timing: ItemTraitEffect['timing']): ItemTraitEffect => ({ id: `t${r++}`, traitId, timing });
const needs = (statId: string, value: number): TraitRequirementRow[] =>
  [{ all: [{ kind: 'stat', id: statId, operator: '>=', value, unit: 'raw' }] }];
const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, stackable: false, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const trait = (id: string, over: Partial<Trait> = {}, statChanges: StatChange[] = []): Trait =>
  ({ id, name: id[0].toUpperCase() + id.slice(1), statChanges, playerToggle: true, ...over });

const hand: Slot = { id: 'hand', name: 'Hand', capacity: 2 };
const body: Slot = { id: 'body', name: 'Body' };
const finger: Slot = { id: 'finger', name: 'Finger' };
const stance: TraitGroup = { id: 'stance', name: 'Stance', parentId: null, maxPicks: 1 } as TraitGroup;

const cursed = trait('cursed', {}, [{ statId: 'luck', value: -1, type: 'starting' }]);
const brave = trait('brave', { groupId: 'stance' });
const bold = trait('bold', { groupId: 'stance' }, [{ statId: 'luck', value: 1, type: 'starting' }]);
const blessed = trait('blessed', { requires: needs('luck', 3) });
const fated = trait('fated', { mode: 'alwaysOn', requires: needs('luck', 99) });
const heroTraits = [cursed, brave, bold, blessed, fated];

const ring = item('ring', 'Cursed Ring', { traitEffects: [grant('cursed', 'owned')] });
const idol = item('idol', 'Idol', { traitEffects: [grant('cursed', 'owned')] });
const charm = item('charm', 'Bold Charm', { traitEffects: [grant('bold', 'owned')] });
const halo = item('halo', 'Halo', { traitEffects: [grant('blessed', 'owned')] });
const relic = item('relic', 'Relic', { traitEffects: [grant('cursed', 'firstObtain')] });
const fate = item('fate', 'Fate Coin', { traitEffects: [grant('fated', 'owned')] });
const strongSword = item('strong', 'Strong Sword', { slotId: 'hand', equipRequires: needs('strength', 5), statEffects: [statRow('strength', 2)] });
const weakSword = item('weak', 'Cursed Sword', { slotId: 'hand', equipRequires: needs('strength', 5), statEffects: [statRow('strength', -2)] });
const band = item('band', 'Iron Band', { slotId: 'finger', statEffects: [statRow('strength', 2)] });
const signet = item('signet', 'Signet', { slotId: 'finger', equipRequires: needs('strength', 5) });
const gauntlet = item('gauntlet', 'Gauntlet', { slotId: 'body', equipRequires: needs('luck', 1), statEffects: [statRow('strength', 2)] });
const items = [ring, idol, charm, halo, relic, fate, strongSword, weakSword, gauntlet, band, signet];

const hero = { kind: 'entity', id: 'hero' } as const;
const you = { kind: 'you' } as const;
const owners = [{ id: 'hero', name: 'Hero', traits: heroTraits, groups: [stance] }];
const traitWorld = (copies: readonly ItemCopy[] = []): TraitWorld => ({
  traits: [], groups: [], entities: [{ id: 'hero', name: 'Hero' }], persona: { source: 'world', entityId: 'hero' },
  global: { traits: [], groups: [] }, owners, items, itemCopies: copies,
});
const world = (cap?: number): InventorySettleWorld => ({ items, traits: traitWorld(), ...(cap && { cap }) });

interface Play { copies: readonly ItemCopy[]; traits: TraitRuntimeState; ledger: ItemEffectLedger | undefined; log: string[]; skipped: string[] }

const start = (stats: PlayerStat[], picks: string[] = []): Play => ({
  copies: [],
  traits: {
    stats: [], traits: [], disabledTraitIds: [], appliedValues: {},
    entityStats: { hero: seedStatBases(stats) }, ownedTraits: { hero: { chosen: picks } },
  },
  ledger: undefined, log: [], skipped: [],
});

/** Every writer's path: the validator with the equip check, then the inventory settle. */
function act(play: Play, ops: InventoryOp[], cap?: number): Play {
  let n = play.copies.length;
  const check = equipRequirement({ traits: play.traits, ledger: play.ledger }, world());
  const { copies, diagnostics } = applyInventoryOps(play.copies, ops, {
    world: { items, slots: [hand, body, finger] }, source: 'script', newId: () => `c${n++}`, requirement: check,
  });
  const settled = settleInventory({ copies, previous: play.copies, traits: play.traits, ledger: play.ledger }, world(cap));
  return { copies: settled.copies, traits: settled.traits, ledger: settled.ledger, log: settled.log, skipped: diagnostics };
}
const gain = (itemId: string, to: ItemCopyWhere = hero): InventoryOp => ({ kind: 'gain', itemId, quantity: 1, to });
const copyOf = (play: Play, itemId: string) => play.copies.find((c) => c.item.kind === 'item' && c.item.itemId === itemId)!;
const lose = (play: Play, itemId: string): InventoryOp => ({ kind: 'lose', copyId: copyOf(play, itemId).id });
const equip = (play: Play, itemId: string): InventoryOp => ({ kind: 'equip', copyId: copyOf(play, itemId).id });
const on = (play: Play) => activeOwnedTraitIds(play.traits.ownedTraits ?? {}).hero ?? [];
const heroStat = (play: Play, id: string) => play.traits.entityStats!.hero.find((s) => s.id === id)!.value;
/** Moves a stat's value as the stat pass would. */
const withStat = (play: Play, id: string, value: number): Play => ({
  ...play,
  traits: { ...play.traits, entityStats: { hero: play.traits.entityStats!.hero.map((s) => (s.id === id ? { ...s, value } : s)) } },
});
const settle = (play: Play, cap?: number): Play => {
  const settled = settleInventory({ copies: play.copies, traits: play.traits, ledger: play.ledger }, world(cap));
  return { ...play, copies: settled.copies, traits: settled.traits, ledger: settled.ledger, log: settled.log };
};

describe('item trait grants', () => {
  it('turns a While Owned trait on, applies its stat changes, and reverses them when the item leaves', () => {
    let play = act(start([stat('luck', 5)]), [gain('ring')]);
    expect(on(play)).toEqual(['cursed']);
    expect(heroStat(play, 'luck')).toBe(4);
    expect(play.log).toContain('Trait switched on: Cursed (by Cursed Ring)');
    play = act(play, [lose(play, 'ring')]);
    expect(on(play)).toEqual([]);
    expect(heroStat(play, 'luck')).toBe(5);
    expect(play.log).toContain('Trait switched off: Cursed (by Cursed Ring)');
  });

  it('keeps the trait on while another item still grants it', () => {
    let play = act(start([stat('luck', 5)]), [gain('ring'), gain('idol')]);
    play = act(play, [lose(play, 'ring')]);
    expect(on(play)).toEqual(['cursed']);
    expect(heroStat(play, 'luck')).toBe(4);
  });

  it('leaves a trait the owner picked on when the granting item leaves', () => {
    let play = act(start([stat('luck', 5)], ['cursed']), [gain('ring')]);
    play = act(play, [lose(play, 'ring')]);
    expect(on(play)).toEqual(['cursed']);
    expect(play.log).toEqual([]);
  });

  it('switches off no group sibling and counts toward no Pick Count', () => {
    const play = act(start([], ['brave']), [gain('charm')]);
    expect(on(play)).toEqual(['brave', 'bold']);
    const input = traitGateInput(play.traits, traitWorld(play.copies));
    expect(groupPickStates(input).owners.hero.get('stance')).toMatchObject({ count: 1, full: true });
  });

  it('keeps a picked and granted sibling on, stats and all, when a pick retires the sibling', () => {
    const play = act(start([stat('luck', 5)], ['bold']), [gain('charm')]);
    const switched = switchPlayerTrait(play.traits, 'brave', true, traitWorld(play.copies), undefined, 'hero')!;
    expect(activeOwnedTraitIds(switched.state.ownedTraits ?? {}).hero).toEqual(['brave', 'bold']);
    expect(switched.state.entityStats!.hero.find((s) => s.id === 'luck')!.value).toBe(heroStat(play, 'luck'));
  });

  it('lets stat code pick a granted trait, so it stays when the item leaves', () => {
    let play = act(start([stat('luck', 5)]), [gain('charm')]);
    const coded = applyCodeTraitSwitches(play.traits, [{ traitId: 'bold', enabled: true, by: 'Luck', ownerId: 'hero' }], traitWorld(play.copies));
    play = act({ ...play, traits: coded.state }, [lose(play, 'charm')]);
    expect(on(play)).toEqual(['bold']);
    expect(heroStat(play, 'luck')).toBe(6);
  });

  it('refuses the player switching off a granted trait', () => {
    const play = act(start([]), [gain('charm')]);
    expect(switchPlayerTrait(play.traits, 'bold', false, traitWorld(play.copies), undefined, 'hero')).toBeNull();
  });

  it('waits on a granted trait gate that fails, and turns it on once the gate holds', () => {
    let play = act(start([stat('luck', 1)]), [gain('halo')]);
    expect(on(play)).toEqual([]);
    play = settle(withStat(play, 'luck', 4));
    expect(on(play)).toEqual(['blessed']);
    expect(play.traits.cascadeOffTraitIds?.owners?.hero ?? []).toEqual([]);
  });

  it('keeps an On First Obtain trait after the item leaves', () => {
    let play = act(start([stat('luck', 5)]), [gain('relic')]);
    play = act(play, [lose(play, 'relic')]);
    expect(on(play)).toEqual(['cursed']);
    expect(play.ledger?.firstObtainTraits).toEqual({ hero: ['cursed'] });
  });

  it('names no item for a hidden Item Copy', () => {
    let play = start([stat('luck', 5)]);
    play = { ...play, copies: [{ id: 'h', item: { kind: 'item', itemId: 'ring' }, where: hero, quantity: 1, visibility: 'hidden' }] };
    expect(settle(play).log).toContain('Trait switched on: Cursed (by An item)');
  });

  it('skips an Automatic trait and a trait the owner lacks, with a diagnostic', () => {
    const lacking = item('odd', 'Odd Stone', { traitEffects: [grant('missing', 'owned')] });
    const play = act(start([]), [gain('fate')]);
    expect(play.log).toContain('Item Fate Coin: trait Fated is Automatic');
    const odd = settleInventory(
      { copies: [{ id: 'o', item: { kind: 'item', itemId: 'odd' }, where: hero, quantity: 1, visibility: 'visible' }], traits: start([]).traits, ledger: undefined },
      { ...world(), items: [...items, lacking] },
    );
    expect(odd.log).toContain('Item Odd Stone: owner hero has no trait missing');
  });

  it('reverses the effects and grants of an Item Copy the load dropped, from the ledger it left (Q60)', () => {
    const owned = act(start([stat('luck', 5), stat('strength', 5)]), [gain('ring'), gain('strong')]);
    const play = act(owned, [equip(owned, 'strong')]);
    expect([on(play), heroStat(play, 'strength')]).toEqual([['cursed'], 7]);
    const loaded = settle({ ...play, copies: [] });
    expect([on(loaded), heroStat(loaded, 'luck'), heroStat(loaded, 'strength')]).toEqual([[], 5, 5]);
    expect(loaded.ledger).toEqual({});
  });

  it('grants a `you` Item Copy from the played entity tree', () => {
    const play = act(start([stat('luck', 5)]), [gain('ring', you)]);
    expect(on(play)).toEqual(['cursed']);
  });
});

describe('equip requirements', () => {
  it('refuses an equip whose requirement does not hold, with a diagnostic', () => {
    let play = act(start([stat('strength', 4)]), [gain('strong')]);
    play = act(play, [equip(play, 'strong')]);
    expect(copyOf(play, 'strong').equipped).toBeUndefined();
    expect(play.skipped).toEqual(['Inventory (script) skipped equip: Strong Sword needs Hero: Strength >= 5']);
  });

  it('reads the requirement after the swap-out, so an item leaving the slot never counts', () => {
    let play = act(start([stat('strength', 3)]), [gain('band'), gain('signet')]);
    play = act(play, [equip(play, 'band')]);
    play = act(play, [equip(play, 'signet')]);
    expect(play.skipped).toEqual(['Inventory (script) skipped equip: Signet needs Hero: Strength >= 5']);
    expect(copyOf(play, 'band').equipped).toBeDefined();
    expect(copyOf(play, 'signet').equipped).toBeUndefined();
  });

  it('never lets a +Strength sword keep itself equipped', () => {
    let play = act(start([stat('strength', 5)]), [gain('strong')]);
    play = act(play, [equip(play, 'strong')]);
    expect(heroStat(play, 'strength')).toBe(7);
    play = settle(withStat(play, 'strength', 6));
    expect(copyOf(play, 'strong').equipped).toBeUndefined();
    expect(heroStat(play, 'strength')).toBe(4);
    expect(play.log).toContain('Unequipped Strong Sword: requirement no longer holds');
  });

  it('never lets a -Strength sword unequip itself', () => {
    let play = act(start([stat('strength', 6)]), [gain('weak')]);
    play = act(play, [equip(play, 'weak')]);
    expect(heroStat(play, 'strength')).toBe(4);
    play = settle(play);
    expect(copyOf(play, 'weak').equipped).toBeDefined();
  });

  it('unequips an item whose requirement stops holding and reverses its effects', () => {
    let play = act(start([stat('strength', 6)]), [gain('strong')]);
    play = act(play, [equip(play, 'strong')]);
    play = settle(withStat(play, 'strength', 4));
    expect(copyOf(play, 'strong').equipped).toBeUndefined();
    expect(heroStat(play, 'strength')).toBe(2);
    expect(play.ledger?.applied).toBeUndefined();
  });

  it('settles a two-item cascade', () => {
    let play = act(start([stat('strength', 3), stat('luck', 1)]), [gain('gauntlet'), gain('strong')]);
    play = act(play, [equip(play, 'gauntlet')]);
    play = act(play, [equip(play, 'strong')]);
    expect(heroStat(play, 'strength')).toBe(7);
    play = settle(withStat(play, 'luck', 0));
    expect(copyOf(play, 'gauntlet').equipped).toBeUndefined();
    expect(copyOf(play, 'strong').equipped).toBeUndefined();
    expect(heroStat(play, 'strength')).toBe(3);
  });

  it('stops a chain longer than the cap at the cap, with a diagnostic', () => {
    let play = act(start([stat('strength', 3), stat('luck', 1)]), [gain('gauntlet'), gain('strong')]);
    play = act(play, [equip(play, 'gauntlet')]);
    play = act(play, [equip(play, 'strong')]);
    play = settle(withStat(play, 'luck', 0), 2);
    expect(play.log).toContain('Inventory settle stopped after 2 passes');
    expect(copyOf(play, 'strong').equipped).toBeDefined();
  });
});
