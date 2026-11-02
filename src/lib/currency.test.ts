import { describe, expect, it } from 'vitest';
import type { Currency, Entity, Stat, StatGroup, StatLink } from '@/types';
import { copyWorthText, currencyOf, currencyStatGroups, defaultCurrencyPatch, parseCurrencies, worthText } from './currency';

const STAT_CURRENCY: Currency = { id: 'credits', name: 'Credits', backing: { kind: 'stat', statId: 'funds' } };
const NAME_CURRENCY: Currency = { id: 'goats', name: 'Goats', backing: { kind: 'name' } };
const ITEM_CURRENCY: Currency = { id: 'coin', name: 'Coin', backing: { kind: 'items', items: [{ itemId: 'copper', worth: 1 }, { itemId: 'gold', worth: 100 }] } };

describe('parseCurrencies', () => {
  it('keeps each valid backing, in order', () => {
    const list = [NAME_CURRENCY, STAT_CURRENCY, ITEM_CURRENCY];
    expect(parseCurrencies(list)).toEqual(list);
  });

  it('reads anything but a list as none', () => {
    expect(parseCurrencies(undefined)).toEqual([]);
    expect(parseCurrencies({ id: 'x' })).toEqual([]);
  });

  it.each([
    ['no id', { name: 'A', backing: { kind: 'name' } }],
    ['no name', { id: 'a', backing: { kind: 'name' } }],
    ['no backing', { id: 'a', name: 'A' }],
    ['an unknown backing', { id: 'a', name: 'A', backing: { kind: 'text', text: 'silver' } }],
    ['a stat backing with no stat', { id: 'a', name: 'A', backing: { kind: 'stat' } }],
    ['a stat backing with a blank stat', { id: 'a', name: 'A', backing: { kind: 'stat', statId: '' } }],
    ['an items backing with no rows', { id: 'a', name: 'A', backing: { kind: 'items' } }],
    ['the old coins backing', { id: 'a', name: 'A', backing: { kind: 'coins', coins: [{ itemId: 'copper', worth: 1 }] } }],
    ['an items backing under the old coins key', { id: 'a', name: 'A', backing: { kind: 'items', coins: [{ itemId: 'copper', worth: 1 }] } }],
    ['a non-record', 'credits'],
  ])('drops a Currency with %s and keeps its neighbors', (_case, bad) => {
    expect(parseCurrencies([NAME_CURRENCY, bad, STAT_CURRENCY])).toEqual([NAME_CURRENCY, STAT_CURRENCY]);
  });

  it('drops an item row that has no item or a worth that is not a whole number above zero', () => {
    const rows = [{ itemId: 'copper', worth: 1 }, { worth: 5 }, { itemId: 'tin', worth: 0 }, { itemId: 'lead', worth: 1.5 }, { itemId: 'gold', worth: 100 }];
    expect(parseCurrencies([{ id: 'c', name: 'C', backing: { kind: 'items', items: rows } }])[0].backing)
      .toEqual({ kind: 'items', items: [{ itemId: 'copper', worth: 1 }, { itemId: 'gold', worth: 100 }] });
  });

  it('strips fields a Currency does not have', () => {
    expect(parseCurrencies([{ ...NAME_CURRENCY, junk: 1 }])).toEqual([NAME_CURRENCY]);
  });
});

describe('worth', () => {
  const currencies = [STAT_CURRENCY, NAME_CURRENCY];

  it('reads the Value with the Currency name', () => {
    expect(worthText({ value: 40, currencyId: 'credits' }, currencies, [])).toBe('40 Credits');
    expect(worthText({ value: 0, currencyId: 'goats' }, currencies, [])).toBe('0 Goats');
  });

  it('is nothing without a Value, without a Currency, or with a Currency that is gone', () => {
    expect(worthText({ currencyId: 'credits' }, currencies, [])).toBeNull();
    expect(worthText({ value: 40 }, currencies, [])).toBeNull();
    expect(worthText({ value: 40, currencyId: 'gone' }, currencies, [])).toBeNull();
    expect(currencyOf({ currencyId: 'gone' }, currencies)).toBeUndefined();
  });

  it('stays off an unidentified copy', () => {
    const item = { value: 40, currencyId: 'credits' };
    expect(copyWorthText({}, item, currencies, [])).toBe('40 Credits');
    expect(copyWorthText({ state: { unidentified: true } }, item, currencies, [])).toBeNull();
    expect(copyWorthText({}, undefined, currencies, [])).toBeNull();
  });
});

describe('defaultCurrencyPatch', () => {
  it('names the first Currency, and nothing in a world with none', () => {
    expect(defaultCurrencyPatch([NAME_CURRENCY, STAT_CURRENCY])).toEqual({ currencyId: 'goats' });
    expect(defaultCurrencyPatch([])).toEqual({});
  });
});

describe('currencyStatGroups', () => {
  const stat = (id: string, groupId?: string): Stat => ({ id, name: id, type: 'number', description: '', min: 0, max: 9, regen: 0, descriptors: [], ...(groupId && { groupId }) }) as Stat;
  const link = (id: string, originalId: string, kind: 'stat' | 'group' = 'stat'): StatLink => ({ id, originalId, kind, originalName: originalId, groupId: null });
  const persona = (id: string, over: Partial<Entity> = {}): Entity => ({ id, name: id, persona: true, ...over }) as Entity;
  const statGroups: StatGroup[] = [
    { id: 'bp', name: 'Blueprints', system: 'blueprints', parentId: null },
    { id: 'wealth', name: 'Wealth', parentId: 'bp' },
  ] as StatGroup[];
  const idsOf = (groups: ReturnType<typeof currencyStatGroups>) => groups.flatMap((group) => group.stats.map((s) => s.id));

  it('lists a stat every Persona links once, under its original id', () => {
    const groups = currencyStatGroups({
      stats: [stat('renown'), stat('gold', 'bp')], statGroups,
      entities: [persona('a', { statLinks: [link('l1', 'gold')] }), persona('b', { statLinks: [link('l2', 'gold')] })],
    });
    expect(groups.map((group) => group.kind)).toEqual(['global', 'linked']);
    expect(idsOf(groups)).toEqual(['renown', 'gold']);
  });

  it('reaches a stat through a linked group', () => {
    const groups = currencyStatGroups({
      stats: [stat('gold', 'wealth')], statGroups, entities: [persona('a', { statLinks: [link('l1', 'wealth', 'group')] })],
    });
    expect(idsOf(groups)).toEqual(['gold']);
  });

  it('leaves out a Blueprint stat no Persona links, and one only a non-Persona links', () => {
    const groups = currencyStatGroups({
      stats: [stat('gold', 'bp'), stat('debt', 'bp')], statGroups,
      entities: [persona('a', { statLinks: [link('l1', 'gold')] }), { id: 'npc', name: 'npc', statLinks: [link('l2', 'debt')] } as Entity],
    });
    expect(idsOf(groups)).toEqual(['gold']);
  });

  it('lists a Persona’s own stat under that Persona, and an entity’s own stat not at all', () => {
    const groups = currencyStatGroups({
      stats: [], statGroups: [],
      entities: [persona('a', { stats: [stat('credits')] }), { id: 'npc', name: 'npc', stats: [stat('hoard')] } as Entity],
    });
    expect(groups).toEqual([expect.objectContaining({ kind: 'persona', persona: expect.objectContaining({ id: 'a' }), stats: [expect.objectContaining({ id: 'credits' })] })]);
  });

  it('lists an id two Personas own once, under the first', () => {
    const groups = currencyStatGroups({
      stats: [], statGroups: [], entities: [persona('a', { stats: [stat('gold')] }), persona('b', { stats: [stat('gold')] })],
    });
    expect(idsOf(groups)).toEqual(['gold']);
  });

  it('has no group for a heading with no stats', () => {
    expect(currencyStatGroups({ stats: [], statGroups: [], entities: [persona('a')] })).toEqual([]);
  });
});
