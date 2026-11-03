import { itemStackable } from '@/lib/items';
import type { Currency, CurrencyItem, Item } from '@/types';
import { isWholeWorth, itemsOf, type ItemName } from './index';

/** Items a Currency Item row can take: Stackable, and no Item of any Currency yet. `keep` always stays, so a row lists its own item. */
export const currencyItemChoices = (items: readonly Item[], currencies: readonly Currency[], keep?: string): Item[] => {
  const taken = new Set(currencies.flatMap((currency) => itemsOf(currency).map((row) => row.itemId)));
  return items.filter((item) => item.id === keep || (itemStackable(item) && !taken.has(item.id)));
};

/** `rows` plus a row for `itemId`. It takes worth 1 when no row has it, else ten times the largest worth. */
export const addCurrencyItem = (rows: readonly CurrencyItem[], itemId: string, items: readonly ItemName[]): CurrencyItem[] => [
  ...rows,
  { itemId, worth: lacksBaseItem(rows, items) ? 1 : Math.max(...rows.map((row) => row.worth)) * 10 },
];

/**
 * `rows` with row `index` set to `worth`, or null when that breaks a rule: a whole number above zero, no
 * worth twice, and the only worth-1 row keeps its worth.
 */
export function setItemWorth(rows: readonly CurrencyItem[], index: number, worth: number): CurrencyItem[] | null {
  if (!isWholeWorth(worth) || index < 0 || index >= rows.length) return null;
  if (rows.some((row, at) => at !== index && row.worth === worth)) return null;
  if (rows[index].worth === 1 && worth !== 1) return null;
  return rows.map((row, at) => (at === index ? { ...row, worth } : row));
}

/** True when no Currency Item worth 1 has an item, so no value has a Breakdown. */
export const lacksBaseItem = (rows: readonly CurrencyItem[], items: readonly ItemName[]): boolean =>
  !rows.some((row) => row.worth === 1 && items.some((item) => item.id === row.itemId));

/** A new item's Currency: the Default, the world's first. */
export const defaultCurrencyPatch = (currencies: readonly Currency[]): Pick<Item, 'currencyId'> =>
  (currencies[0] ? { currencyId: currencies[0].id } : {});
