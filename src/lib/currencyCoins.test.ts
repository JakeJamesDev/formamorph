import { describe, expect, it } from 'vitest';
import { blankItem } from '@/lib/items';
import type { Currency, CurrencyCoin, Item } from '@/types';
import { addCoin, breakdown, breakdownText, coinFields, coinItemChoices, copyWorthFacts, lacksBaseCoin, setCoinWorth, valueOfCoins, worthText } from './currency';

const ITEMS: Item[] = [blankItem('copper', 'Copper'), blankItem('silver', 'Silver'), blankItem('gold', 'Gold'), blankItem('rope', 'Rope')];
const rows = (...pairs: [string, number][]): CurrencyCoin[] => pairs.map(([itemId, worth]) => ({ itemId, worth }));
const currency = (coins: CurrencyCoin[]): Currency => ({ id: 'coin', name: 'Coin', backing: { kind: 'coins', coins } });
const COIN = currency(rows(['gold', 100], ['copper', 1], ['silver', 10]));

describe('Breakdown', () => {
  it.each([
    [105, '1 Gold, 5 Copper'],
    [100, '1 Gold'],
    [250, '2 Gold, 5 Silver'],
    [7, '7 Copper'],
    [10, '1 Silver'],
    [0, '0 Copper'],
    [12345, '123 Gold, 4 Silver, 5 Copper'],
  ])('reads %i as %s, largest coin first, with gaps and zero counts left out', (value, text) => {
    expect(breakdownText(value, COIN, ITEMS)).toBe(text);
  });

  it('keeps every coin in the Value fields, zeros included, largest first', () => {
    expect(coinFields(105, COIN, ITEMS)?.map((coin) => [coin.name, coin.count])).toEqual([['Gold', 1], ['Silver', 0], ['Copper', 5]]);
  });

  it('lets the top coin take any size of value', () => {
    expect(breakdown(1_000_000, COIN, ITEMS)?.[0]).toMatchObject({ name: 'Gold', count: 10_000 });
  });

  it('lands the remainder on the worth-1 coin when worths do not divide one another', () => {
    const odd = currency(rows(['gold', 7], ['copper', 1]));
    expect(breakdownText(20, odd, ITEMS)).toBe('2 Gold, 6 Copper');
  });

  it.each([
    ['a fraction', 2.5],
    ['a negative', -3],
    ['not a number', Number.NaN],
  ])('has none for a Value that is %s', (_case, value) => {
    expect(breakdown(value, COIN, ITEMS)).toBeNull();
  });

  it('has none without a worth-1 coin, or for a Currency with no coins or another backing', () => {
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
    const fields = coinFields(0, COIN, ITEMS) ?? [];
    expect(valueOfCoins(fields.map((coin) => ({ ...coin, count: { Gold: 1, Silver: 0, Copper: 5 }[coin.name] ?? 0 })))).toBe(105);
  });

  it('keeps the stored total when a coin changes worth, and shifts the breakdown', () => {
    const retuned = currency(rows(['gold', 50], ['silver', 10], ['copper', 1]));
    expect(breakdownText(105, retuned, ITEMS)).toBe('2 Gold, 5 Copper');
    expect(breakdownText(105, COIN, ITEMS)).toBe('1 Gold, 5 Copper');
  });
});

describe('worth with a coin Currency', () => {
  it('reads as the Breakdown', () => {
    expect(worthText({ value: 105, currencyId: 'coin' }, [COIN], ITEMS)).toBe('1 Gold, 5 Copper');
  });

  it('falls back to the plain number and the Currency name when the Value has no Breakdown', () => {
    expect(worthText({ value: 2.5, currencyId: 'coin' }, [COIN], ITEMS)).toBe('2.5 Coin');
    expect(worthText({ value: 5, currencyId: 'coin' }, [currency([])], ITEMS)).toBe('5 Coin');
  });

  it('shows in the popup facts', () => {
    expect(copyWorthFacts({}, { value: 105, currencyId: 'coin' }, [COIN], (text) => text, ITEMS)).toEqual(['Worth 1 Gold, 5 Copper']);
  });
});

describe('coin row rules', () => {
  it('lists Stackable items that are no coin yet, and a row keeps its own item', () => {
    const items = [...ITEMS, { ...blankItem('wand', 'Wand'), stackable: false }, { ...blankItem('flask', 'Flask'), uses: 3 }];
    const others = [currency(rows(['gold', 1]))];
    expect(coinItemChoices(items, others).map((item) => item.id)).toEqual(['copper', 'silver', 'rope']);
    expect(coinItemChoices(items, others, 'gold').map((item) => item.id)).toEqual(['copper', 'silver', 'gold', 'rope']);
    expect(coinItemChoices(items, [], 'wand').map((item) => item.id)).toContain('wand');
  });

  it('gives a new row worth 1 only while no row has it', () => {
    expect(addCoin([], 'copper', ITEMS)).toEqual(rows(['copper', 1]));
    expect(addCoin(rows(['copper', 1]), 'silver', ITEMS)).toEqual(rows(['copper', 1], ['silver', 10]));
    expect(addCoin(rows(['copper', 1], ['silver', 10]), 'gold', ITEMS)).toEqual(rows(['copper', 1], ['silver', 10], ['gold', 100]));
    expect(addCoin(rows(['silver', 10]), 'copper', ITEMS)).toEqual(rows(['silver', 10], ['copper', 1]));
  });

  it('gives a new row worth 1 when the worth-1 row’s item is gone', () => {
    expect(addCoin(rows(['ghost', 1], ['silver', 10]), 'copper', ITEMS)).toEqual(rows(['ghost', 1], ['silver', 10], ['copper', 1]));
  });

  it('refuses a worth another row has', () => {
    expect(setCoinWorth(rows(['copper', 1], ['silver', 10], ['gold', 100]), 2, 10)).toBeNull();
  });

  it('refuses a second worth-1 row', () => {
    expect(setCoinWorth(rows(['copper', 1], ['silver', 10]), 1, 1)).toBeNull();
  });

  it('refuses to move the only worth-1 row off 1', () => {
    expect(setCoinWorth(rows(['copper', 1], ['silver', 10]), 0, 5)).toBeNull();
  });

  it.each([[0], [-4], [2.5], [Number.NaN]])('refuses a worth of %s', (worth) => {
    expect(setCoinWorth(rows(['copper', 1], ['silver', 10]), 1, worth)).toBeNull();
  });

  it('applies a free whole worth, and lets a row take worth 1 when none has it', () => {
    expect(setCoinWorth(rows(['copper', 1], ['silver', 10]), 1, 25)).toEqual(rows(['copper', 1], ['silver', 25]));
    expect(setCoinWorth(rows(['silver', 10], ['gold', 100]), 0, 1)).toEqual(rows(['silver', 1], ['gold', 100]));
  });

  it('knows when no row is worth 1', () => {
    expect(lacksBaseCoin(rows(['silver', 10]), ITEMS)).toBe(true);
    expect(lacksBaseCoin(rows(['copper', 1]), ITEMS)).toBe(false);
    expect(lacksBaseCoin([], ITEMS)).toBe(true);
  });

  it('counts a worth-1 row whose item is gone as no worth-1 row', () => {
    expect(lacksBaseCoin(rows(['ghost', 1], ['silver', 10]), ITEMS)).toBe(true);
  });
});
