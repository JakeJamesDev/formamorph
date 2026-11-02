import { describe, expect, it } from 'vitest';
import type { SlotOwner } from '@/lib/bodies';
import { seedWorldEntityStats } from '@/lib/entityStats';
import { blankItem } from '@/lib/items';
import type { Currency, Entity, EntityStatValues, ItemCopy, Placement, PlayerStat, Stat, StatGroup, StatLink } from '@/types';
import { balanceOf, balanceRows, balanceText, type BalanceState } from './currency';

const ITEMS = [blankItem('copper', 'Copper'), blankItem('gold', 'Gold'), blankItem('ruby', 'Ruby'), blankItem('rope', 'Rope')];
const COIN: Currency = { id: 'coin', name: 'Coin', backing: { kind: 'coins', coins: [{ itemId: 'copper', worth: 1 }, { itemId: 'gold', worth: 100 }] } };
const GEMS: Currency = { id: 'gems', name: 'Gems', backing: { kind: 'coins', coins: [{ itemId: 'ruby', worth: 1 }] } };
const CREDITS: Currency = { id: 'credits', name: 'Credits', backing: { kind: 'stat', statId: 'funds' } };
const GOATS: Currency = { id: 'goats', name: 'Goats', backing: { kind: 'name' } };

const YOU: SlotOwner = { kind: 'you' };
const MERCHANT: SlotOwner = { kind: 'entity', id: 'merchant' };
let next = 0;
const copy = (itemId: string, where: ItemCopy['where'], quantity: number, over: Partial<ItemCopy> = {}): ItemCopy =>
  ({ id: `c${next++}`, item: { kind: 'item', itemId }, where, quantity, visibility: 'visible', ...over });
const placed = (itemId: string, where: Placement['where'], hidden = false): Placement =>
  ({ id: `p${next++}`, where, quantity: 1, ...(hidden && { hidden }), source: { kind: 'item', itemId } });
const row = (id: string, value: number): Pick<PlayerStat, 'id' | 'value'> => ({ id, value });
const state = (over: Partial<BalanceState> = {}): BalanceState => ({ copies: [], placements: [], globalStats: [], statsOf: () => [], ...over });

describe('Balance by coins', () => {
  it('adds each coin stack at the owner by its worth, and leaves other owners and items out', () => {
    expect(balanceOf(COIN, YOU, state({
      copies: [copy('copper', YOU, 5), copy('gold', YOU, 2), copy('rope', YOU, 3), copy('gold', MERCHANT, 9), copy('gold', { kind: 'location', id: 'yard' }, 9)],
    }))).toEqual({ tracked: true, amount: 205 });
  });

  it('leaves out a hidden coin', () => {
    expect(balanceOf(COIN, YOU, state({ copies: [copy('copper', YOU, 5), copy('gold', YOU, 1, { visibility: 'hidden' })] })))
      .toEqual({ tracked: true, amount: 5 });
  });

  it('leaves out an unidentified coin', () => {
    expect(balanceOf(COIN, YOU, state({ copies: [copy('copper', YOU, 5), copy('gold', YOU, 1, { state: { unidentified: true } })] })))
      .toEqual({ tracked: true, amount: 5 });
  });

  it('counts a Bound coin', () => {
    const bound = { ...blankItem('copper', 'Copper'), bound: true };
    const rows = balanceRows([COIN], state({ copies: [copy(bound.id, YOU, 3)] }), [bound]);
    expect(rows).toEqual([{ currencyId: 'coin', name: 'Coin', amount: '3 Copper' }]);
  });

  it('leaves out a runtime item', () => {
    const runtime: ItemCopy = { ...copy('copper', YOU, 5), item: { kind: 'runtime', runtimeItemId: 'copper' } };
    expect(balanceOf(COIN, YOU, state({ copies: [runtime] }))).toEqual({ tracked: true, amount: 0 });
  });

  it('reads the player with no coins as 0, not untracked', () => {
    expect(balanceOf(COIN, YOU, state())).toEqual({ tracked: true, amount: 0 });
  });

  it('reads an entity with no Placement of a coin as untracked, even holding coins it gained in play', () => {
    expect(balanceOf(COIN, MERCHANT, state({ copies: [copy('gold', MERCHANT, 4)] }))).toEqual({ tracked: false });
  });

  it('reads a merchant who spent an authored purse as 0, so they can run out', () => {
    expect(balanceOf(COIN, MERCHANT, state({ placements: [placed('gold', MERCHANT)] }))).toEqual({ tracked: true, amount: 0 });
  });

  it('tracks a hidden purse, and reads its coins only once they are revealed', () => {
    const placements = [placed('gold', MERCHANT, true)];
    expect(balanceOf(COIN, MERCHANT, state({ placements, copies: [copy('gold', MERCHANT, 2, { visibility: 'hidden' })] }))).toEqual({ tracked: true, amount: 0 });
    expect(balanceOf(COIN, MERCHANT, state({ placements, copies: [copy('gold', MERCHANT, 2)] }))).toEqual({ tracked: true, amount: 200 });
  });

  it.each<[string, Placement]>([
    ['another Currency’s coin', placed('ruby', MERCHANT)],
    ['an item that is no coin', placed('rope', MERCHANT)],
    ['another owner', placed('gold', { kind: 'entity', id: 'guard' })],
    ['a location', placed('gold', { kind: 'location', id: 'merchant' })],
  ])('reads a Placement of %s as no authored balance', (_case, placement) => {
    expect(balanceOf(COIN, MERCHANT, state({ placements: [placement] }))).toEqual({ tracked: false });
  });
});

describe('Balance by stat', () => {
  const blueprint = (id: string): Stat => ({
    id, name: id, type: 'number', description: '', min: 0, max: 100, value: 30, regen: 0, descriptors: [], groupId: 'bp',
  });
  const statGroups: StatGroup[] = [{ id: 'bp', name: 'Blueprints', system: 'blueprints' } as StatGroup];
  const link = (originalId: string): StatLink => ({ id: `l-${originalId}`, originalId, kind: 'stat', originalName: originalId, groupId: null });
  const statsFrom = (values: EntityStatValues) => (owner: SlotOwner) => (owner.kind === 'entity' ? values[owner.id] ?? [] : values.hero ?? []);

  it('reads a Persona’s and an entity’s stat through their Stat Links, each its own', () => {
    const entities = [{ id: 'hero', name: 'Hero', statLinks: [link('funds')] }, { id: 'merchant', name: 'Merchant', statLinks: [link('funds')] }] as Entity[];
    const values = seedWorldEntityStats({ stats: [blueprint('funds')], statGroups, entities });
    values.merchant = values.merchant.map((stat) => ({ ...stat, value: 75 }));
    const seeded = state({ statsOf: statsFrom(values) });
    expect(balanceOf(CREDITS, YOU, seeded)).toEqual({ tracked: true, amount: 30 });
    expect(balanceOf(CREDITS, MERCHANT, seeded)).toEqual({ tracked: true, amount: 75 });
  });

  it('reads an owner who lacks the stat as untracked', () => {
    const entities = [{ id: 'hero', name: 'Hero' }, { id: 'merchant', name: 'Merchant', statLinks: [link('funds')] }] as Entity[];
    const values = seedWorldEntityStats({ stats: [blueprint('funds')], statGroups, entities });
    expect(balanceOf(CREDITS, YOU, state({ statsOf: statsFrom(values) }))).toEqual({ tracked: false });
    expect(balanceOf(CREDITS, { kind: 'entity', id: 'guard' }, state({ statsOf: statsFrom(values) }))).toEqual({ tracked: false });
  });

  it('reads a stat at 0 as 0, not untracked', () => {
    expect(balanceOf(CREDITS, YOU, state({ statsOf: () => [row('funds', 0)] }))).toEqual({ tracked: true, amount: 0 });
  });

  it('reads a Global Stat as the player’s money, which an entity doesn’t share', () => {
    const wallet = state({ globalStats: [row('funds', 60)], statsOf: () => [row('funds', 5)] });
    expect(balanceOf(CREDITS, YOU, wallet)).toEqual({ tracked: true, amount: 60 });
    expect(balanceOf(CREDITS, MERCHANT, wallet)).toEqual({ tracked: false });
  });
});

describe('Balance by name only', () => {
  it('reads every owner as untracked', () => {
    expect(balanceOf(GOATS, YOU, state())).toEqual({ tracked: false });
    expect(balanceOf(GOATS, MERCHANT, state({ placements: [placed('gold', MERCHANT)] }))).toEqual({ tracked: false });
  });
});

describe('balanceText', () => {
  it('reads coins as their Breakdown and a stat as its rounded number and Currency name', () => {
    expect(balanceText(105, COIN, ITEMS)).toBe('1 Gold, 5 Copper');
    expect(balanceText(0, COIN, ITEMS)).toBe('0 Copper');
    expect(balanceText(40.6, CREDITS, ITEMS)).toBe('41 Credits');
  });

  it('reads a coin Currency with no worth-1 coin as its number and name', () => {
    const noBase: Currency = { id: 'c', name: 'Coin', backing: { kind: 'coins', coins: [{ itemId: 'gold', worth: 100 }] } };
    expect(balanceText(300, noBase, ITEMS)).toBe('300 Coin');
  });
});

describe('balanceRows', () => {
  it('lists each tracked Currency in world order, name-only and untracked left out', () => {
    const rows = balanceRows([CREDITS, GOATS, COIN, GEMS], state({ copies: [copy('copper', YOU, 105)], statsOf: () => [row('funds', 40.4)] }), ITEMS);
    expect(rows).toEqual([
      { currencyId: 'credits', name: 'Credits', amount: '40' },
      { currencyId: 'coin', name: 'Coin', amount: '1 Gold, 5 Copper' },
      { currencyId: 'gems', name: 'Gems', amount: '0 Ruby' },
    ]);
    expect(balanceRows([CREDITS], state(), ITEMS)).toEqual([]);
  });
});
