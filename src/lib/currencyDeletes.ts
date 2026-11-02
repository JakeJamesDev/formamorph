import { coinsOf } from '@/lib/currency';
import { usedByText, type ReferenceKind } from '@/lib/usedByText';
import type { Currency, Entity, Item, Stat } from '@/types';

/** Every stat id a Currency can name: the world's stats and each entity's own. */
export const statIdsOf = (stats: readonly Stat[], entities: readonly Entity[]): Set<string> =>
  new Set([...stats.map((stat) => stat.id), ...entities.flatMap((entity) => (entity.stats ?? []).map((stat) => stat.id))]);

/** The ids in `before` that `after` lacks. */
export const goneIds = (before: ReadonlySet<string>, after: ReadonlySet<string>): Set<string> =>
  new Set([...before].filter((id) => !after.has(id)));

/** The stat ids a delete takes away: those of the world as it stands that the next lists lack. */
export const lostStatIds = (
  now: { stats: readonly Stat[]; entities: readonly Entity[] }, next: { stats: readonly Stat[]; entities: readonly Entity[] },
): Set<string> => goneIds(statIdsOf(now.stats, now.entities), statIdsOf(next.stats, next.entities));

/** The Currencies backed by a stat in `ids`. */
export const currenciesBackedBy = (currencies: readonly Currency[], ids: ReadonlySet<string>): Currency[] =>
  currencies.filter((currency) => currency.backing.kind === 'stat' && ids.has(currency.backing.statId));

/** `currencies` with every one backed by a stat in `ids` made name only. The same list when none is. */
export function withoutBackingStats(currencies: Currency[], ids: ReadonlySet<string>): Currency[] {
  if (ids.size === 0 || currenciesBackedBy(currencies, ids).length === 0) return currencies;
  return currencies.map((currency) => (
    currency.backing.kind === 'stat' && ids.has(currency.backing.statId) ? { ...currency, backing: { kind: 'name' } } : currency
  ));
}

/** The Currencies with a coin row for the item. */
export const currenciesCoinedBy = (currencies: readonly Currency[], itemId: string): Currency[] =>
  currencies.filter((currency) => coinsOf(currency).some((coin) => coin.itemId === itemId));

/**
 * `currencies` without the item's coin rows. A Currency that loses its last row becomes name only; one that keeps
 * rows stays coin-backed, even when the base coin is the row that went. The same list when none holds the item.
 */
export function withoutCoinItem(currencies: Currency[], itemId: string): Currency[] {
  if (currenciesCoinedBy(currencies, itemId).length === 0) return currencies;
  return currencies.map((currency) => {
    if (currency.backing.kind !== 'coins' || !currency.backing.coins.some((coin) => coin.itemId === itemId)) return currency;
    const coins = currency.backing.coins.filter((coin) => coin.itemId !== itemId);
    return { ...currency, backing: coins.length > 0 ? { kind: 'coins', coins } : { kind: 'name' } };
  });
}

/** How many items are priced in the Currency. */
export const itemsPricedIn = (items: readonly Item[], currencyId: string): number =>
  items.filter((item) => item.currencyId === currencyId).length;

/** `items` with the Currency cleared. Values stay. The same list when none is priced in it. */
export function withoutCurrencyRefs(items: Item[], currencyId: string): Item[] {
  if (itemsPricedIn(items, currencyId) === 0) return items;
  return items.map((item) => {
    if (item.currencyId !== currencyId) return item;
    const { currencyId: _drop, ...rest } = item;
    return rest;
  });
}

const namesOf = (currencies: readonly Currency[], label: (name: string) => string): string => {
  const names = currencies.map((currency) => label(currency.name) || 'a Currency');
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
};

const nameOnlyKind = (affected: readonly Currency[], label: (name: string) => string): ReferenceKind => ({
  count: affected.length,
  one: 'Currency',
  many: 'Currencies',
  named: namesOf(affected, label),
  clause: (who) => `makes ${who} Name Only`,
});

/** The confirm kind for deleting stats that back Currencies. Count zero when none does. */
export const backingStatKind = (
  currencies: readonly Currency[], ids: ReadonlySet<string>, label: (name: string) => string,
): ReferenceKind => nameOnlyKind(currenciesBackedBy(currencies, ids), label);

/** The confirm kind for deleting an item that is a coin. Count zero when it is none. */
export const coinItemKind = (
  currencies: readonly Currency[], itemId: string, label: (name: string) => string,
): ReferenceKind => {
  const held = currenciesCoinedBy(currencies, itemId);
  const lastCoin = held.length > 0 && held.every((currency) => coinsOf(currency).length === 1);
  return {
    count: held.length,
    one: 'Currency',
    many: 'Currencies',
    named: namesOf(held, label),
    clause: (who) => (lastCoin ? `makes ${who} Name Only` : `removes its coin row from ${who}`),
  };
};

/** The confirm line for deleting a Currency: the items that lose their Currency. Null when none does. */
export const currencyUsedBy = (items: readonly Item[], currencyId: string): string | null => usedByText([
  { count: itemsPricedIn(items, currencyId), one: 'item', many: 'items', clause: (n) => `clears the Currency on ${n}` },
]);
