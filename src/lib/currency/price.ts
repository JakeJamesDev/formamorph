import type { Currency, Item } from '@/types';
import { currencyOf, currenciesSettle, fitsBacking, refuse, isRefusal, usableItems, type ItemName, type Refusal } from './index';

/** The Currency a price names and its amount in base units, or why it can't be read. */
export type StatedPrice = { currency: Currency; amount: number } | Refusal;

/** A money word as a price compares it: case, a plural and a trailing "coin" from story wording ignored. */
const moneyKey = (name: string): string => name.trim().toLowerCase().replace(/\s+coins?$/, '').replace(/s$/, '');

/** What a money word can mean: each Currency Item of that name, else each Currency of that name, worth its base unit. */
function moneyTerms(word: string, currencies: readonly Currency[], items: readonly ItemName[]): { currency: Currency; worth: number }[] {
  const key = moneyKey(word);
  const rows = currencies.flatMap((currency) => usableItems(currency, items)
    .filter((row) => moneyKey(row.name) === key).map((row) => ({ currency, worth: row.worth })));
  return rows.length ? rows : currencies.filter((currency) => moneyKey(currency.name) === key).map((currency) => ({ currency, worth: 1 }));
}

/** Whether `word` names a Currency Item or a Currency. */
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

/** A price as the AI states it, in the Breakdown's form or as a bare number (Q26, Q50, Q58). */
export function readStatedPrice(price: string, named: string, currencies: readonly Currency[], items: readonly ItemName[], count?: number): StatedPrice {
  const termsOf = (word: string) => moneyTerms(word, currencies, items);
  const parts = price.replace(/(\d),(\d{3})\b/g, '$1$2').split(/,|&|\+|\band\b/i).map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return refuse('it states no price');
  const statedTerms = named.trim() ? termsOf(named) : [];
  // A price that names its own money needs no Currency, so a `named` that names no money is ignored.
  const selfNamed = parts.every((part) => { const { word } = leadingAmount(part); return !!word && termsOf(word).length > 0; });
  if (named.trim() && !statedTerms.length && !selfNamed) return refuse(`no Currency is named "${named}"`);
  const namedTerms = statedTerms.length ? statedTerms : null;
  const terms: { count: number; options: { currency: Currency; worth: number }[] }[] = [];
  for (const part of parts) {
    const { count: stated, word } = leadingAmount(part);
    const amountOf = stated ?? (parts.length === 1 ? count : undefined);
    if (amountOf === undefined) return refuse(`"${part}" is no amount`);
    if (!word && parts.length > 1) return refuse(`"${part}" names no money`);
    const options = word ? termsOf(word) : namedTerms ?? currencies.slice(0, 1).map((currency) => ({ currency, worth: 1 }));
    if (!options.length) return refuse(word ? `no money is named "${word}"` : 'the world has no Currency');
    terms.push({ count: amountOf, options });
  }
  const fits = currencies.filter((currency) => terms.every(({ options }) => options.some((option) => option.currency === currency))
    && (!namedTerms || namedTerms.some((term) => term.currency === currency)));
  if (fits.length !== 1) return refuse(fits.length ? `"${price}" fits more than one Currency` : `"${price}" draws on more than one Currency`);
  const [currency] = fits;
  const amount = terms.reduce((sum, term) => sum + term.count * term.options.find((option) => option.currency === currency)!.worth, 0);
  if (!(amount > 0)) return refuse(`"${price}" is no amount`);
  if (!fitsBacking(amount, currency)) return refuse(`"${price}" is no whole number of items`);
  return { currency, amount };
}

/** What a buy's money comes to before anything moves. `alone` moves the item with no money. */
export type BuyQuote = { kind: 'alone'; currency?: Currency } | { kind: 'priced'; currency: Currency; amount: number } | Refusal;

/** What a buy costs: `alone` when the world's money settles nothing or the item costs nothing (Q64); a stated price beats Value (Q65). */
export function quoteBuy(
  buy: { price?: string; currency?: string; quantity: number }, item: Pick<Item, 'value' | 'currencyId'> | undefined,
  currencies: readonly Currency[], items: readonly ItemName[],
): BuyQuote {
  if (!currenciesSettle(currencies)) return { kind: 'alone' };
  const own = item && currencyOf(item, currencies);
  if (buy.price) {
    // A bare number reads in the first Currency listed, so the item's own goes first.
    const order = own ? [own, ...currencies.filter((currency) => currency !== own)] : currencies;
    const stated = readStatedPrice(buy.price, buy.currency ?? '', order, items);
    return isRefusal(stated) ? stated : { kind: 'priced', ...stated };
  }
  if (!own) return refuse('it has no price');
  if (own.backing.kind === 'name' || item?.value === 0) return { kind: 'alone', currency: own };
  if (item?.value === undefined) return refuse('it has no price');
  const amount = item.value * buy.quantity;
  if (!fitsBacking(amount, own)) return refuse(`${amount} is no whole number of items`);
  return { kind: 'priced', currency: own, amount };
}
