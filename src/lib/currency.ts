import type { SlotOwner } from '@/lib/bodies';
import { copiesAt } from '@/lib/inventory';
import { isUnidentified, itemStackable } from '@/lib/items';
import { canBePlayer } from '@/lib/owners';
import { globalStatsOf, resolvedEntityStats, statBlueprintIds, type StatLinkWorld } from '@/lib/statLinks';
import type { Currency, CurrencyBacking, CurrencyCoin, Entity, Item, ItemCopy, Placement, PlayerStat, Stat } from '@/types';

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

const parseCoin = (raw: unknown): CurrencyCoin[] =>
  (isRecord(raw) && typeof raw.itemId === 'string' && typeof raw.worth === 'number' && Number.isInteger(raw.worth) && raw.worth > 0
    ? [{ itemId: raw.itemId, worth: raw.worth }] : []);

const parseBacking = (raw: unknown): CurrencyBacking | null => {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'name') return { kind: 'name' };
  if (raw.kind === 'stat') return typeof raw.statId === 'string' && raw.statId ? { kind: 'stat', statId: raw.statId } : null;
  if (raw.kind === 'coins') return Array.isArray(raw.coins) ? { kind: 'coins', coins: raw.coins.flatMap(parseCoin) } : null;
  return null;
};

/** A world file's Currencies, in order. A record without an id, a name or a known backing is dropped. */
export const parseCurrencies = (raw: unknown): Currency[] => (Array.isArray(raw) ? raw : []).flatMap((value: unknown) => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return [];
  const backing = parseBacking(value.backing);
  return backing ? [{ id: value.id, name: value.name, backing }] : [];
});

/** The Currency `item` is priced in. Undefined when it has none, or its Currency is gone. */
export const currencyOf = (item: Pick<Item, 'currencyId'>, currencies: readonly Currency[]): Currency | undefined =>
  (item.currencyId === undefined ? undefined : currencies.find((currency) => currency.id === item.currencyId));

type ItemName = Pick<Item, 'id' | 'name'>;

/** One coin's share of a value, or one Value field: the coin's item, its name, and how many. */
export interface CoinAmount {
  itemId: string;
  name: string;
  worth: number;
  count: number;
}

const isWholeValue = (value: number): boolean => Number.isInteger(value) && value >= 0;

/** The coin rows of `currency`, in author order. Empty for any other backing. */
export const coinsOf = (currency: Currency): readonly CurrencyCoin[] => (currency.backing.kind === 'coins' ? currency.backing.coins : []);

/** The rows of `currency` whose item exists, largest worth first. Empty for any other backing. */
const usableCoins = (currency: Currency, items: readonly ItemName[]): Omit<CoinAmount, 'count'>[] =>
  coinsOf(currency)
    .flatMap((coin) => {
      const item = items.find((other) => other.id === coin.itemId);
      return item ? [{ itemId: coin.itemId, name: item.name, worth: coin.worth }] : [];
    })
    .sort((a, b) => b.worth - a.worth);

/**
 * `value` in base units as one count per coin, largest first, zero counts kept. Null when it cannot read as
 * coins: a Currency with no coins, a value that is not a whole number from zero, or no usable coin worth 1.
 */
export function coinFields(value: number, currency: Currency, items: readonly ItemName[]): CoinAmount[] | null {
  const coins = usableCoins(currency, items);
  if (!isWholeValue(value) || coins[coins.length - 1]?.worth !== 1) return null;
  let rest = value;
  return coins.map((coin) => {
    const count = Math.floor(rest / coin.worth);
    rest -= count * coin.worth;
    return { ...coin, count };
  });
}

/** The coins that make `value`, largest first, zero counts left out. Zero reads as none of the smallest coin. Null as `coinFields`. */
export function breakdown(value: number, currency: Currency, items: readonly ItemName[]): CoinAmount[] | null {
  const fields = coinFields(value, currency, items);
  if (!fields) return null;
  const held = fields.filter((coin) => coin.count > 0);
  return held.length > 0 ? held : fields.slice(-1);
}

/** The Value stored for the counts of `fields`, in base units. */
export const valueOfCoins = (fields: readonly Pick<CoinAmount, 'worth' | 'count'>[]): number =>
  fields.reduce((sum, coin) => sum + coin.worth * coin.count, 0);

/** The Breakdown as text, such as "1 Gold, 5 Copper". Null when `value` has no Breakdown. */
export function breakdownText(value: number, currency: Currency, items: readonly ItemName[]): string | null {
  const coins = breakdown(value, currency, items);
  return coins && coins.map((coin) => `${coin.count} ${coin.name}`).join(', ');
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

const UNTRACKED: Balance = { tracked: false };

/** The worth of the coins at `owner`. Only visible, identified copies count, Bound ones included. */
function coinAmount(coins: readonly CurrencyCoin[], owner: SlotOwner, copies: readonly ItemCopy[]): number {
  const worthOf = new Map(coins.map((coin) => [coin.itemId, coin.worth]));
  return copiesAt(copies, owner).reduce((sum, copy) => {
    const worth = copy.item.kind === 'item' ? worthOf.get(copy.item.itemId) : undefined;
    return worth !== undefined && copy.visibility === 'visible' && !isUnidentified(copy) ? sum + worth * copy.quantity : sum;
  }, 0);
}

/**
 * What `owner` holds in `currency`. The player always tracks coins, and an entity tracks them from a Placement of
 * one of the coins at it, hidden or not. A Global Stat counts for the player alone, and any other stat for whoever has it.
 */
export function balanceOf(currency: Currency, owner: SlotOwner, state: BalanceState): Balance {
  const { backing } = currency;
  if (backing.kind === 'name') return UNTRACKED;
  if (backing.kind === 'coins') {
    const authored = owner.kind === 'you' || state.placements.some((placement) => placement.where.kind === 'entity'
      && placement.where.id === owner.id && backing.coins.some((coin) => coin.itemId === placement.source.itemId));
    return authored ? { tracked: true, amount: coinAmount(backing.coins, owner, state.copies) } : UNTRACKED;
  }
  const global = state.globalStats.find((stat) => stat.id === backing.statId);
  if (global) return owner.kind === 'you' ? { tracked: true, amount: global.value } : UNTRACKED;
  const own = state.statsOf(owner).find((stat) => stat.id === backing.statId);
  return own ? { tracked: true, amount: own.value } : UNTRACKED;
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

/** The player's tracked Currencies as rows. A coin amount reads as its Breakdown and a stat's as the bare number. */
export const balanceRows = (currencies: readonly Currency[], state: BalanceState, items: readonly ItemName[]): BalanceRow[] =>
  currencies.flatMap((currency) => {
    const balance = balanceOf(currency, { kind: 'you' }, state);
    if (!balance.tracked) return [];
    const whole = Math.round(balance.amount);
    return [{ currencyId: currency.id, name: currency.name, amount: breakdownText(whole, currency, items) ?? `${whole}` }];
  });

/** Items a coin row can take: Stackable, and no coin of any Currency yet. `keep` always stays, so a row lists its own item. */
export const coinItemChoices = (items: readonly Item[], currencies: readonly Currency[], keep?: string): Item[] => {
  const taken = new Set(currencies.flatMap((currency) => coinsOf(currency).map((coin) => coin.itemId)));
  return items.filter((item) => item.id === keep || (itemStackable(item) && !taken.has(item.id)));
};

/** `coins` plus a row for `itemId`. It takes worth 1 when no row has it, else ten times the largest worth. */
export const addCoin = (coins: readonly CurrencyCoin[], itemId: string, items: readonly ItemName[]): CurrencyCoin[] => [
  ...coins,
  { itemId, worth: lacksBaseCoin(coins, items) ? 1 : Math.max(...coins.map((coin) => coin.worth)) * 10 },
];

/**
 * `coins` with row `index` set to `worth`, or null when that breaks a rule: a whole number above zero, no
 * worth twice, and the only worth-1 row keeps its worth.
 */
export function setCoinWorth(coins: readonly CurrencyCoin[], index: number, worth: number): CurrencyCoin[] | null {
  if (!Number.isInteger(worth) || worth < 1 || index < 0 || index >= coins.length) return null;
  if (coins.some((coin, at) => at !== index && coin.worth === worth)) return null;
  if (coins[index].worth === 1 && worth !== 1) return null;
  return coins.map((coin, at) => (at === index ? { ...coin, worth } : coin));
}

/** True when no row worth 1 has an item, so no value has a Breakdown. */
export const lacksBaseCoin = (coins: readonly CurrencyCoin[], items: readonly ItemName[]): boolean =>
  !coins.some((coin) => coin.worth === 1 && items.some((item) => item.id === coin.itemId));

/** A new item's Currency: the Default, the world's first. */
export const defaultCurrencyPatch = (currencies: readonly Currency[]): Pick<Item, 'currencyId'> =>
  (currencies[0] ? { currencyId: currencies[0].id } : {});

/** One heading of the stat picker. `persona` holds that Persona's own stats. */
export type CurrencyStatGroup = { stats: Stat[] } & ({ kind: 'global' | 'linked' } | { kind: 'persona'; persona: Entity });

/**
 * What can back a Currency, each stat once: Global Stats, the Blueprint stats a Persona links, under their
 * original ids, then each Persona's own. A Blueprint stat no Persona links has no owner, so the list omits it.
 * Two Personas can own one id after a link is detached; the first lists it.
 */
export function currencyStatGroups(world: StatLinkWorld & { entities: readonly Entity[] }): CurrencyStatGroup[] {
  const blueprints = statBlueprintIds(world);
  const personas = world.entities.filter(canBePlayer).map((persona) => ({ persona, stats: resolvedEntityStats(world, persona) }));
  const linked = new Map(personas.flatMap(({ stats }) => stats.filter((stat) => blueprints.has(stat.id)).map((stat) => [stat.id, stat] as const)));
  const seen = new Set(blueprints);
  const firstSeen = (stat: Stat) => !seen.has(stat.id) && !!seen.add(stat.id);
  const groups: CurrencyStatGroup[] = [
    { kind: 'global', stats: globalStatsOf([...world.stats], world.statGroups).filter(firstSeen) },
    { kind: 'linked', stats: [...linked.values()] },
    ...personas.map(({ persona, stats }) => ({ kind: 'persona' as const, persona, stats: stats.filter(firstSeen) })),
  ];
  return groups.filter((group) => group.stats.length > 0);
}
