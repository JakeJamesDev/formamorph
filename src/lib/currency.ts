import { slotOwnerKey, type SlotOwner } from '@/lib/bodies';
import { copiesAt, type InventoryOp } from '@/lib/inventory';
import { isUnidentified, itemStackable } from '@/lib/items';
import { canBePlayer } from '@/lib/owners';
import { globalStatsOf, resolvedEntityStats, statBlueprintIds, type StatLinkWorld } from '@/lib/statLinks';
import type { Currency, CurrencyBacking, CurrencyCoin, Entity, EntityStatValues, Item, ItemCopy, Placement, PlayerStat, Stat } from '@/types';

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
  const held = walletStat(backing.statId, owner, state);
  return held ? { tracked: true, amount: held.stat.value } : UNTRACKED;
}

/** The stat that holds `owner`'s money. A Global Stat is the player's alone. */
function walletStat<S extends Pick<PlayerStat, 'id' | 'value'>>(
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

/** The Currency a price names and its amount in base units, or why it can't be read. */
export type StatedPrice = { currency: Currency; amount: number } | { refused: string };

/** A money word as a price compares it: case, a plural and a trailing "coin" ignored. */
const moneyKey = (name: string): string => name.trim().toLowerCase().replace(/\s+coins?$/, '').replace(/s$/, '');

/** What a money word can mean: each coin of that name, else each Currency of that name, worth its base unit. */
function moneyTerms(word: string, currencies: readonly Currency[], items: readonly ItemName[]): { currency: Currency; worth: number }[] {
  const key = moneyKey(word);
  const coins = currencies.flatMap((currency) => usableCoins(currency, items)
    .filter((coin) => moneyKey(coin.name) === key).map((coin) => ({ currency, worth: coin.worth })));
  return coins.length ? coins : currencies.filter((currency) => moneyKey(currency.name) === key).map((currency) => ({ currency, worth: 1 }));
}

/** Whether `word` names a coin or a Currency. */
export const namesMoney = (word: string, currencies: readonly Currency[], items: readonly ItemName[]): boolean =>
  moneyTerms(word, currencies, items).length > 0;

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** The amount at the start of a price part, in digits or plain words, and the words after it. Null count with none. */
function leadingAmount(part: string): { count: number | null; word: string } {
  const digits = /^(\d+(?:\.\d+)?)\s*(.*)$/.exec(part);
  if (digits) return { count: Number(digits[1]), word: digits[2].trim() };
  const tokens = part.split(/[\s-]+/);
  let count: number | null = null;
  let at = 0;
  for (; at < tokens.length; at += 1) {
    const token = tokens[at].toLowerCase();
    if (token === 'hundred' && count !== null) count *= 100;
    else if (NUMBER_WORDS[token] !== undefined) count = (count ?? 0) + NUMBER_WORDS[token];
    else break;
  }
  return { count, word: count === null ? part : tokens.slice(at).join(' ') };
}

/**
 * A price as the AI states it: the Breakdown's form ("3 Gold, 5 Copper"), or a bare number, in digits or words. A bare
 * number counts the coin `named` names, else base units of the Currency it names, else of the Default. A lone money
 * word with no number takes `count`. A coin's name beats a Currency's, and every part must fit one Currency (Q26).
 */
export function readStatedPrice(price: string, named: string, currencies: readonly Currency[], items: readonly ItemName[], count?: number): StatedPrice {
  const termsOf = (word: string) => moneyTerms(word, currencies, items);
  const namedTerms = named.trim() ? termsOf(named) : null;
  if (namedTerms && !namedTerms.length) return { refused: `no Currency is named "${named}"` };
  const parts = price.replace(/(\d),(\d{3})\b/g, '$1$2').split(/,|&|\+|\band\b/i).map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return { refused: 'it states no price' };
  const terms: { count: number; options: { currency: Currency; worth: number }[] }[] = [];
  for (const part of parts) {
    const { count: stated, word } = leadingAmount(part);
    const amountOf = stated ?? (parts.length === 1 ? count : undefined);
    if (amountOf === undefined) return { refused: `"${part}" is no amount` };
    if (!word && parts.length > 1) return { refused: `"${part}" names no money` };
    const options = word ? termsOf(word) : namedTerms ?? currencies.slice(0, 1).map((currency) => ({ currency, worth: 1 }));
    if (!options.length) return { refused: word ? `no money is named "${word}"` : 'the world has no Currency' };
    terms.push({ count: amountOf, options });
  }
  const fits = currencies.filter((currency) => terms.every(({ options }) => options.some((option) => option.currency === currency))
    && (!namedTerms || namedTerms.some((term) => term.currency === currency)));
  if (fits.length !== 1) return { refused: fits.length ? `"${price}" fits more than one Currency` : `"${price}" draws on more than one Currency` };
  const [currency] = fits;
  const amount = terms.reduce((sum, term) => sum + term.count * term.options.find((option) => option.currency === currency)!.worth, 0);
  if (!(amount > 0)) return { refused: `"${price}" is no amount` };
  if (currency.backing.kind === 'coins' && !Number.isInteger(amount)) return { refused: `"${price}" is no whole number of coins` };
  return { currency, amount };
}

/** A stat as a payment reads it. */
export type PaymentStat = Pick<PlayerStat, 'id' | 'value' | 'min' | 'max' | 'noIncrease' | 'noDecrease'>;

/** What a payment reads. As with Balance, a stat left out reads as untracked. */
export interface PaymentState extends BalanceState {
  globalStats: readonly PaymentStat[];
  statsOf: (owner: SlotOwner) => readonly PaymentStat[];
}

/** One stat's move in a settled payment. `owner` is null for a Global Stat. */
export interface PaymentStatChange {
  owner: SlotOwner | null;
  statId: string;
  delta: number;
}

/** The ops and stat changes that settle a payment, or why it is refused. A refused plan changes nothing. */
export type PaymentPlan = { settled: true; ops: InventoryOp[]; stats: PaymentStatChange[] } | { settled: false; reason: string };

const SETTLES_NOTHING: PaymentPlan = { settled: true, ops: [], stats: [] };
const refuse = (reason: string): PaymentPlan => ({ settled: false, reason });

/** The biggest amount the coin search walks; a larger one takes its largest coin first. */
const COIN_SEARCH_LIMIT = 100_000;

/** The fewest coins that make `amount` exactly, by item id. Null when no mix of the coins makes it. */
function fewestCoins(amount: number, coins: readonly Pick<CurrencyCoin, 'itemId' | 'worth'>[]): Map<string, number> | null {
  if (!coins.length) return null;
  const counts = new Map<string, number>();
  const largest = coins.reduce((top, coin) => (coin.worth > top.worth ? coin : top));
  const peeled = amount > COIN_SEARCH_LIMIT ? Math.ceil((amount - COIN_SEARCH_LIMIT) / largest.worth) : 0;
  if (peeled) counts.set(largest.itemId, peeled);
  const rest = amount - peeled * largest.worth;
  const best = [0];
  const last: (typeof coins[number] | null)[] = [null];
  for (let at = 1; at <= rest; at += 1) {
    best[at] = Infinity;
    last[at] = null;
    for (const coin of coins) {
      if (coin.worth <= at && best[at - coin.worth] + 1 < best[at]) {
        best[at] = best[at - coin.worth] + 1;
        last[at] = coin;
      }
    }
  }
  if (best[rest] === Infinity) return null;
  for (let at = rest; at > 0; at -= last[at]!.worth) counts.set(last[at]!.itemId, (counts.get(last[at]!.itemId) ?? 0) + 1);
  return counts;
}

/** The copies of a coin `owner` can hand over: the ones Balance counts, carried before equipped. */
const spendableCopies = (itemId: string, owner: SlotOwner, copies: readonly ItemCopy[]): ItemCopy[] =>
  copiesAt(copies, owner)
    .filter((copy) => copy.item.kind === 'item' && copy.item.itemId === itemId && copy.visibility === 'visible' && !isUnidentified(copy))
    .sort((a, b) => Number(!!a.equipped) - Number(!!b.equipped));

/** Ops that take `count` of a coin from `owner`, and how many of the count its copies could not cover. */
function takeCoins(
  itemId: string, count: number, owner: SlotOwner, copies: readonly ItemCopy[], op: (copyId: string, quantity: number) => InventoryOp,
): { ops: InventoryOp[]; short: number } {
  const ops: InventoryOp[] = [];
  let short = count;
  for (const copy of spendableCopies(itemId, owner, copies)) {
    if (short <= 0) break;
    const quantity = Math.min(short, copy.quantity);
    ops.push(op(copy.id, quantity));
    short -= quantity;
  }
  return { ops, short };
}

/** Settles coins: smallest first, change in the fewest coins, and only the net of each coin moves (Q11). */
function coinPlan(currency: Currency, payer: SlotOwner | null, payee: SlotOwner | null, amount: number, state: PaymentState, items: readonly ItemName[]): PaymentPlan {
  const coins = usableCoins(currency, items).reverse();
  const paying = payer ? balanceOf(currency, payer, state) : UNTRACKED;
  const tracked = payee && balanceOf(currency, payee, state).tracked ? payee : null;
  if (!payer || !paying.tracked) {
    if (!tracked) return SETTLES_NOTHING;
    const made = fewestCoins(amount, coins);
    if (!made) return refuse(`the coins can't make ${amount}`);
    return { settled: true, stats: [], ops: [...made].map(([itemId, quantity]) => ({ kind: 'gain', itemId, quantity, to: tracked })) };
  }
  if (paying.amount < amount) return refuse(`it costs ${amount} and the payer has ${paying.amount}`);
  const net = new Map<string, number>();
  let rest = amount;
  for (const coin of coins) {
    if (rest <= 0) break;
    const held = spendableCopies(coin.itemId, payer, state.copies).reduce((sum, copy) => sum + copy.quantity, 0);
    const take = Math.min(held, Math.ceil(rest / coin.worth));
    net.set(coin.itemId, take);
    rest -= take * coin.worth;
  }
  if (rest > 0) return refuse(`it costs ${amount} and the payer's coins cover ${amount - rest}`);
  const change = rest < 0 ? fewestCoins(-rest, coins) : new Map<string, number>();
  if (!change) return refuse(`the coins can't make ${-rest} in change`);
  for (const [itemId, count] of change) net.set(itemId, (net.get(itemId) ?? 0) - count);
  const ops: InventoryOp[] = [];
  for (const [itemId, count] of net) {
    if (count > 0) {
      ops.push(...takeCoins(itemId, count, payer, state.copies, (copyId, quantity) => (tracked
        ? { kind: 'transfer', copyId, to: tracked, quantity } : { kind: 'lose', copyId, quantity })).ops);
    } else if (count < 0) {
      // Change the payee lacks is created.
      const back = tracked
        ? takeCoins(itemId, -count, tracked, state.copies, (copyId, quantity) => ({ kind: 'transfer', copyId, to: payer, quantity }))
        : { ops: [], short: -count };
      ops.push(...back.ops);
      if (back.short > 0) ops.push({ kind: 'gain', itemId, quantity: back.short, to: payer });
    }
  }
  return { settled: true, stats: [], ops };
}

/** Settles a stat: locks refuse, the floor counts as money the payer lacks, and a full payee keeps only what fits. */
function statPlan(statId: string, payer: SlotOwner | null, payee: SlotOwner | null, amount: number, state: PaymentState): PaymentPlan {
  const paying = payer && walletStat(statId, payer, state);
  const receiving = payee && walletStat(statId, payee, state);
  if ((payer?.kind === 'you' && !paying) || (payee?.kind === 'you' && !receiving)) return refuse('the player has no balance in it');
  const stats: PaymentStatChange[] = [];
  if (paying) {
    if (paying.stat.noDecrease) return refuse(`stat ${statId} has No Decrease`);
    if (paying.stat.value < amount || paying.stat.value - amount < paying.stat.min) return refuse(`it costs ${amount} and the payer can spend less from ${paying.stat.value}`);
    stats.push({ owner: paying.global ? null : payer, statId, delta: -amount });
  }
  if (receiving) {
    if (receiving.stat.noIncrease) return refuse(`stat ${statId} has No Increase`);
    const delta = Math.min(amount, receiving.stat.max - receiving.stat.value);
    if (delta > 0) stats.push({ owner: receiving.global ? null : payee, statId, delta });
  }
  return { settled: true, ops: [], stats };
}

/**
 * Moves `amount` base units of `currency` from `payer` to `payee`. A null payer is income and a null payee means the
 * money leaves the world. An untracked entity holds no money: what it pays is created and what it gets is gone (Q8).
 */
export function planPayment(currency: Currency, payer: SlotOwner | null, payee: SlotOwner | null, amount: number, state: PaymentState, items: readonly ItemName[]): PaymentPlan {
  if (!payer && !payee) return refuse('no one pays and no one receives');
  if (payer && payee && slotOwnerKey(payer) === slotOwnerKey(payee)) return refuse('the payer receives it');
  if (!(amount > 0)) return refuse(`${amount} is no amount`);
  const { backing } = currency;
  if (backing.kind === 'name') return SETTLES_NOTHING;
  if (backing.kind === 'stat') return statPlan(backing.statId, payer, payee, amount, state);
  return coinPlan(currency, payer, payee, amount, state, items);
}

/** The live stats a payment writes: the world's, and each owner's by entity id. */
export interface PaymentStats {
  globalStats: readonly PlayerStat[];
  entityStats: EntityStatValues;
}

/** `stats` with `changes` applied. `playerOwner` names the entity whose stat is the player's. */
export function applyPaymentStats(stats: PaymentStats, changes: readonly PaymentStatChange[], playerOwner: (statId: string) => string | undefined): PaymentStats {
  let { globalStats, entityStats } = stats;
  const moved = (list: readonly PlayerStat[], { statId, delta }: PaymentStatChange) =>
    list.map((stat) => (stat.id === statId ? { ...stat, value: stat.value + delta } : stat));
  for (const change of changes) {
    if (!change.owner) {
      globalStats = moved(globalStats, change);
      continue;
    }
    const id = change.owner.kind === 'entity' ? change.owner.id : playerOwner(change.statId);
    if (id !== undefined && entityStats[id]) entityStats = { ...entityStats, [id]: moved(entityStats[id], change) };
  }
  return { globalStats, entityStats };
}

/** The ids of the stats that back a Currency. */
export const backingStatIds = (currencies: readonly Currency[]): Set<string> =>
  new Set(currencies.flatMap((currency) => (currency.backing.kind === 'stat' ? [currency.backing.statId] : [])));

/** Whether the world's money needs the Inventory pass: a name-only Currency settles nothing (Q55). */
export const currenciesSettle = (currencies: readonly Currency[]): boolean => currencies.some((currency) => currency.backing.kind !== 'name');
