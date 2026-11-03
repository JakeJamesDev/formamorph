import { describe, expect, it } from 'vitest';
import { blankItem } from '@/lib/items';
import type { Currency, CurrencyItem, Item } from '@/types';
import { breakdown, breakdownText, itemFields, copyWorthFacts, valueOfItems, worthText } from './currency';
import { addCurrencyItem, currencyItemChoices, lacksBaseItem, setItemWorth } from './currency/rows';

const ITEMS: Item[] = [blankItem('copper', 'Copper'), blankItem('silver', 'Silver'), blankItem('gold', 'Gold'), blankItem('rope', 'Rope')];
const rows = (...pairs: [string, number][]): CurrencyItem[] => pairs.map(([itemId, worth]) => ({ itemId, worth }));
const currency = (rows: CurrencyItem[]): Currency => ({ id: 'coin', name: 'Coin', backing: { kind: 'items', items: rows } });
const MONEY = currency(rows(['gold', 100], ['copper', 1], ['silver', 10]));

describe('Breakdown', () => {
  it.each([
    [105, '1 Gold, 5 Copper'],
    [100, '1 Gold'],
    [250, '2 Gold, 5 Silver'],
    [7, '7 Copper'],
    [10, '1 Silver'],
    [0, '0 Copper'],
    [12345, '123 Gold, 4 Silver, 5 Copper'],
  ])('reads %i as %s, largest Item first, with gaps and zero counts left out', (value, text) => {
    expect(breakdownText(value, MONEY, ITEMS)).toBe(text);
  });

  it('keeps every item in the Value fields, zeros included, largest first', () => {
    expect(itemFields(105, MONEY, ITEMS)?.map((row) => [row.name, row.count])).toEqual([['Gold', 1], ['Silver', 0], ['Copper', 5]]);
  });

  it('lets the top item take any size of value', () => {
    expect(breakdown(1_000_000, MONEY, ITEMS)?.[0]).toMatchObject({ name: 'Gold', count: 10_000 });
  });

  it('lands the remainder on the worth-1 item when worths do not divide one another', () => {
    const odd = currency(rows(['gold', 7], ['copper', 1]));
    expect(breakdownText(20, odd, ITEMS)).toBe('2 Gold, 6 Copper');
  });

  it.each([
    ['a fraction', 2.5],
    ['a negative', -3],
    ['not a number', Number.NaN],
  ])('has none for a Value that is %s', (_case, value) => {
    expect(breakdown(value, MONEY, ITEMS)).toBeNull();
  });

  it('has none without a worth-1 item, or for a Currency with no items or another backing', () => {
    expect(breakdown(5, currency(rows(['gold', 100])), ITEMS)).toBeNull();
    expect(breakdown(5, currency([]), ITEMS)).toBeNull();
    expect(breakdown(5, { id: 'n', name: 'Goats', backing: { kind: 'name' } }, ITEMS)).toBeNull();
  });

  it('counts a row whose item is gone as absent', () => {
    const dangling = currency(rows(['gold', 100], ['ghost', 10], ['copper', 1]));
    expect(breakdownText(115, dangling, ITEMS)).toBe('1 Gold, 15 Copper');
    expect(breakdown(115, currency(rows(['gold', 100], ['ghost', 1])), ITEMS)).toBeNull();
  });

  it('turns the counts back into the stored Value', () => {
    const fields = itemFields(0, MONEY, ITEMS) ?? [];
    expect(valueOfItems(fields.map((row) => ({ ...row, count: { Gold: 1, Silver: 0, Copper: 5 }[row.name] ?? 0 })))).toBe(105);
  });

  it('keeps the stored total when an item changes worth, and shifts the breakdown', () => {
    const retuned = currency(rows(['gold', 50], ['silver', 10], ['copper', 1]));
    expect(breakdownText(105, retuned, ITEMS)).toBe('2 Gold, 5 Copper');
    expect(breakdownText(105, MONEY, ITEMS)).toBe('1 Gold, 5 Copper');
  });
});

describe('worth with an Items Currency', () => {
  it('reads as the Breakdown', () => {
    expect(worthText({ value: 105, currencyId: 'coin' }, [MONEY], ITEMS)).toBe('1 Gold, 5 Copper');
  });

  it('falls back to the plain number and the Currency name when the Value has no Breakdown', () => {
    expect(worthText({ value: 2.5, currencyId: 'coin' }, [MONEY], ITEMS)).toBe('2.5 Coin');
    expect(worthText({ value: 5, currencyId: 'coin' }, [currency([])], ITEMS)).toBe('5 Coin');
  });

  it('shows in the popup facts', () => {
    expect(copyWorthFacts({}, { value: 105, currencyId: 'coin' }, [MONEY], (text) => text, ITEMS)).toEqual(['Worth 1 Gold, 5 Copper']);
  });
});

describe('coin row rules', () => {
  it('lists Stackable items that are no item yet, and a row keeps its own item', () => {
    const items = [...ITEMS, { ...blankItem('wand', 'Wand'), stackable: false }, { ...blankItem('flask', 'Flask'), uses: 3 }];
    const others = [currency(rows(['gold', 1]))];
    expect(currencyItemChoices(items, others).map((item) => item.id)).toEqual(['copper', 'silver', 'rope']);
    expect(currencyItemChoices(items, others, 'gold').map((item) => item.id)).toEqual(['copper', 'silver', 'gold', 'rope']);
    expect(currencyItemChoices(items, [], 'wand').map((item) => item.id)).toContain('wand');
  });

  it('gives a new row worth 1 only while no row has it', () => {
    expect(addCurrencyItem([], 'copper', ITEMS)).toEqual(rows(['copper', 1]));
    expect(addCurrencyItem(rows(['copper', 1]), 'silver', ITEMS)).toEqual(rows(['copper', 1], ['silver', 10]));
    expect(addCurrencyItem(rows(['copper', 1], ['silver', 10]), 'gold', ITEMS)).toEqual(rows(['copper', 1], ['silver', 10], ['gold', 100]));
    expect(addCurrencyItem(rows(['silver', 10]), 'copper', ITEMS)).toEqual(rows(['silver', 10], ['copper', 1]));
  });

  it('gives a new row worth 1 when the worth-1 row’s item is gone', () => {
    expect(addCurrencyItem(rows(['ghost', 1], ['silver', 10]), 'copper', ITEMS)).toEqual(rows(['ghost', 1], ['silver', 10], ['copper', 1]));
  });

  it('refuses a worth another row has', () => {
    expect(setItemWorth(rows(['copper', 1], ['silver', 10], ['gold', 100]), 2, 10)).toBeNull();
  });

  it('refuses a second worth-1 row', () => {
    expect(setItemWorth(rows(['copper', 1], ['silver', 10]), 1, 1)).toBeNull();
  });

  it('refuses to move the only worth-1 row off 1', () => {
    expect(setItemWorth(rows(['copper', 1], ['silver', 10]), 0, 5)).toBeNull();
  });

  it.each([[0], [-4], [2.5], [Number.NaN]])('refuses a worth of %s', (worth) => {
    expect(setItemWorth(rows(['copper', 1], ['silver', 10]), 1, worth)).toBeNull();
  });

  it('applies a free whole worth, and lets a row take worth 1 when none has it', () => {
    expect(setItemWorth(rows(['copper', 1], ['silver', 10]), 1, 25)).toEqual(rows(['copper', 1], ['silver', 25]));
    expect(setItemWorth(rows(['silver', 10], ['gold', 100]), 0, 1)).toEqual(rows(['silver', 1], ['gold', 100]));
  });

  it('knows when no row is worth 1', () => {
    expect(lacksBaseItem(rows(['silver', 10]), ITEMS)).toBe(true);
    expect(lacksBaseItem(rows(['copper', 1]), ITEMS)).toBe(false);
    expect(lacksBaseItem([], ITEMS)).toBe(true);
  });

  it('counts a worth-1 row whose item is gone as no worth-1 row', () => {
    expect(lacksBaseItem(rows(['ghost', 1], ['silver', 10]), ITEMS)).toBe(true);
  });
});
