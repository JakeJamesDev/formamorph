import type { SlotOwner } from '@/lib/bodies';
import { copiesAt } from '@/lib/inventory';
import { isSpendable, isUnidentified } from '@/lib/items';
import type { Currency, CurrencyItem, Item, ItemCopy, Placement, PlayerStat } from '@/types';

/** Why money can't be read or moved. A refused step changes nothing. */
export interface Refusal {
  settled: false;
  reason: string;
}

export const refuse = (reason: string): Refusal => ({ settled: false, reason });

export const isRefusal = <T extends object>(result: T | Refusal): result is Refusal => 'settled' in result && result.settled === false;

/** A whole number above zero, as a Currency Item's worth must be. */
export const isWholeWorth = (worth: unknown): worth is number => typeof worth === 'number' && Number.isInteger(worth) && worth > 0;

/** Whether `amount` can move in `currency`: Items move only as whole base units. */
export const fitsBacking = (amount: number, currency: Currency): boolean => currency.backing.kind !== 'items' || Number.isInteger(amount);

/** The Currency `item` is priced in. Undefined when it has none, or its Currency is gone. */
export const currencyOf = (item: Pick<Item, 'currencyId'>, currencies: readonly Currency[]): Currency | undefined =>
  (item.currencyId === undefined ? undefined : currencies.find((currency) => currency.id === item.currencyId));

export type ItemName = Pick<Item, 'id' | 'name'>;

/** One row's share of a value, or one Value field: the row's item, its name, and how many. */
export interface CurrencyItemAmount {
  itemId: string;
  name: string;
  worth: number;
  count: number;
}

const isWholeValue = (value: number): boolean => Number.isInteger(value) && value >= 0;

/** The Currency Items of `currency`, in author order. Empty for any other backing. */
export const itemsOf = (currency: Currency): readonly CurrencyItem[] => (currency.backing.kind === 'items' ? currency.backing.items : []);

/** The rows of `currency` whose item exists, largest worth first. Empty for any other backing. */
export const usableItems = (currency: Currency, items: readonly ItemName[]): Omit<CurrencyItemAmount, 'count'>[] =>
  itemsOf(currency)
    .flatMap((row) => {
      const item = items.find((other) => other.id === row.itemId);
      return item ? [{ itemId: row.itemId, name: item.name, worth: row.worth }] : [];
    })
    .sort((a, b) => b.worth - a.worth);

/**
 * `value` in base units as one count per row, largest first, zero counts kept. Null when it cannot read as
 * rows: a Currency with no Items, a value that is not a whole number from zero, or no usable Item worth 1.
 */
export function itemFields(value: number, currency: Currency, items: readonly ItemName[]): CurrencyItemAmount[] | null {
  const rows = usableItems(currency, items);
  if (!isWholeValue(value) || rows[rows.length - 1]?.worth !== 1) return null;
  let rest = value;
  return rows.map((row) => {
    const count = Math.floor(rest / row.worth);
    rest -= count * row.worth;
    return { ...row, count };
  });
}

/** The Currency Items that make `value`, largest first, zero counts left out. Zero reads as none of the smallest Item. Null as `itemFields`. */
export function breakdown(value: number, currency: Currency, items: readonly ItemName[]): CurrencyItemAmount[] | null {
  const fields = itemFields(value, currency, items);
  if (!fields) return null;
  const held = fields.filter((row) => row.count > 0);
  return held.length > 0 ? held : fields.slice(-1);
}

/** The Value stored for the counts of `fields`, in base units. */
export const valueOfItems = (fields: readonly Pick<CurrencyItemAmount, 'worth' | 'count'>[]): number =>
  fields.reduce((sum, row) => sum + row.worth * row.count, 0);

/** The Breakdown as text, such as "1 Gold, 5 Copper". Null when `value` has no Breakdown. */
export function breakdownText(value: number, currency: Currency, items: readonly ItemName[]): string | null {
  const rows = breakdown(value, currency, items);
  return rows && rows.map((row) => `${row.count} ${row.name}`).join(', ');
}

/** `amount` in base units as text: its Breakdown, else the number and the Currency's name. */
const amountText = (amount: number, currency: Currency, items: readonly ItemName[]): string =>
  breakdownText(amount, currency, items) ?? `${amount} ${currency.name}`;

/** What `item` is worth as text, such as "40 Gold" or "1 Gold, 5 Copper". Null without a Value and a Currency. */
export const worthText = (item: Pick<Item, 'value' | 'currencyId'>, currencies: readonly Currency[], items: readonly ItemName[]): string | null => {
  const currency = currencyOf(item, currencies);
  if (!currency || item.value === undefined) return null;
  return amountText(item.value, currency, items);
};

/** The worth an Item Copy shows the player. An unidentified copy shows none, because a price can reveal the item. */
export const copyWorthText = (copy: Pick<ItemCopy, 'state'>, item: Pick<Item, 'value' | 'currencyId'> | undefined, currencies: readonly Currency[], items: readonly ItemName[]): string | null =>
  (item && !isUnidentified(copy) ? worthText(item, currencies, items) : null);

/** The item popup's worth fact, when the copy shows one. */
export const copyWorthFacts = (copy: Pick<ItemCopy, 'state'>, item: Pick<Item, 'value' | 'currencyId'> | undefined, currencies: readonly Currency[], resolveText: (text: string) => string, items: readonly ItemName[]): string[] => {
  const worth = copyWorthText(copy, item, currencies, items);
  return worth ? [`Worth ${resolveText(worth)}`] : [];
};

/** What Balance reads. Each stat list holds the stats its reader may count, so a stat left out reads as untracked. */
export interface BalanceState {
  copies: readonly ItemCopy[];
  placements: readonly Placement[];
  globalStats: readonly Pick<PlayerStat, 'id' | 'value'>[];
  statsOf: (owner: SlotOwner) => readonly Pick<PlayerStat, 'id' | 'value'>[];
}

/** What an owner holds in a Currency. Untracked is no amount at all, which is never the same as 0. */
export type Balance = { tracked: false } | { tracked: true; amount: number };

export const UNTRACKED: Balance = { tracked: false };

/** The worth of the Currency Items at `owner`. Only visible, identified copies count, Bound ones included. */
function itemAmount(rows: readonly CurrencyItem[], owner: SlotOwner, copies: readonly ItemCopy[]): number {
  const worthOf = new Map(rows.map((row) => [row.itemId, row.worth]));
  return copiesAt(copies, owner).reduce((sum, copy) => {
    const worth = copy.item.kind === 'item' ? worthOf.get(copy.item.itemId) : undefined;
    return worth !== undefined && isSpendable(copy) ? sum + worth * copy.quantity : sum;
  }, 0);
}

/** What `owner` holds in `currency`, or that it is untracked (Q43, Q44). */
export function balanceOf(currency: Currency, owner: SlotOwner, state: BalanceState): Balance {
  const { backing } = currency;
  if (backing.kind === 'name') return UNTRACKED;
  if (backing.kind === 'items') {
    const authored = owner.kind === 'you' || state.placements.some((placement) => placement.where.kind === 'entity'
      && placement.where.id === owner.id && backing.items.some((row) => row.itemId === placement.source.itemId));
    return authored ? { tracked: true, amount: itemAmount(backing.items, owner, state.copies) } : UNTRACKED;
  }
  const held = balanceStat(backing.statId, owner, state);
  return held ? { tracked: true, amount: held.stat.value } : UNTRACKED;
}

/** The stat that holds `owner`'s money. A Global Stat is the player's alone. */
export function balanceStat<S extends Pick<PlayerStat, 'id' | 'value'>>(
  statId: string, owner: SlotOwner, state: { globalStats: readonly S[]; statsOf: (owner: SlotOwner) => readonly S[] },
): { stat: S; global: boolean } | null {
  const global = state.globalStats.find((stat) => stat.id === statId);
  if (global) return owner.kind === 'you' ? { stat: global, global: true } : null;
  const own = state.statsOf(owner).find((stat) => stat.id === statId);
  return own ? { stat: own, global: false } : null;
}

/** A Balance as text, such as "40 Credits" or "1 Gold, 5 Copper". A stat's fraction rounds, as the Stats chip's does. */
export const balanceText = (amount: number, currency: Currency, items: readonly ItemName[]): string =>
  amountText(Math.round(amount), currency, items);

/** One row of the Inventory tab's money list. */
export interface BalanceRow {
  currencyId: string;
  name: string;
  amount: string;
}

/** The player's tracked Currencies as rows. An Items amount reads as its Breakdown and a stat's as the bare number. */
export const balanceRows = (currencies: readonly Currency[], state: BalanceState, items: readonly ItemName[]): BalanceRow[] =>
  currencies.flatMap((currency) => {
    const balance = balanceOf(currency, { kind: 'you' }, state);
    if (!balance.tracked) return [];
    const whole = Math.round(balance.amount);
    return [{ currencyId: currency.id, name: currency.name, amount: breakdownText(whole, currency, items) ?? `${whole}` }];
  });

/** The ids of the stats that back a Currency. */
export const backingStatIds = (currencies: readonly Currency[]): Set<string> =>
  new Set(currencies.flatMap((currency) => (currency.backing.kind === 'stat' ? [currency.backing.statId] : [])));

/** Whether the world's money needs the Inventory pass: a name-only Currency settles nothing (Q55). */
export const currenciesSettle = (currencies: readonly Currency[]): boolean => currencies.some((currency) => currency.backing.kind !== 'name');
