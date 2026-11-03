/** The Inventory pass's pays and buys: what a reply's money says, and how it settles (Q56, Q68). */
import { slotOwnerKey, type SlotOwner } from '@/lib/bodies';
import { currencyOf, isRefusal, refuse, type Refusal } from '@/lib/currency';
import { applyPaymentStats, moneyReading, planPayment } from '@/lib/currency/payment';
import { namesMoney, quoteBuy, readStatedPrice, type BuyQuote, type StatedPrice } from '@/lib/currency/price';
import type { Currency, InventoryPassOp, ItemCopy, ItemCopyWhere } from '@/types';
import { authoredNamed, candidates, distribute, gainId, itemIdentity, itemNameKey, listedName, ownerOf, partyOf, runOps, skip, type PassRun } from './passRun';

/** Moves the money, or answers why it can't move. */
function movePayment(pass: PassRun, currency: Currency, payer: SlotOwner | null, payee: SlotOwner | null, amount: number): Refusal | null {
  const { scene: { money }, moneyStats: stats, moneyNames } = pass;
  if (!money || !stats) return refuse('the world has no Currency');
  const reading = moneyReading(money, stats);
  const plan = planPayment(currency, payer, payee, amount, reading.stateOver(pass.list), moneyNames);
  if (!plan.settled) return plan;
  if (plan.ops.length) runOps(pass, plan.ops);
  pass.moneyStats = applyPaymentStats(stats, plan.stats, reading.playerOwner);
  return null;
}

const payLabel = (op: InventoryPassOp) => `pay "${op.price ?? ''}"`;

/** The words of a pay's sum. A reply can name the money as the item or the currency alone, with how many as a quantity above 1. */
const payPrice = (op: InventoryPassOp) => op.price || op.item || (op.currency && op.quantity > 1 ? String(op.quantity) : '');

/** The money word a bare price counts: the `currency` cell, else the money in `item` (Q80). */
const payNamed = (pass: PassRun, op: InventoryPassOp) => op.currency?.trim() || (op.price && op.item ? listedName(pass, op.item) : '');

const statedPay = (pass: PassRun, op: InventoryPassOp): StatedPrice =>
  readStatedPrice(payPrice(op), payNamed(pass, op), pass.moneyCurrencies, pass.moneyNames, op.quantity > 1 ? op.quantity : undefined);

/** Settles one pay and answers the Currencies it governs (Q56, Q76). */
function settlePay(pass: PassRun, op: InventoryPassOp): readonly Currency[] {
  const { moneyCurrencies, moneyNames } = pass;
  if (!pass.scene.money) {
    skip(pass, `${payLabel(op)}: the world has no Currency`);
    return [];
  }
  // A refused pay from a stray line governs nothing; one that states a price or charges the player governs all the money.
  const governedWhenRefused = () => (!op.price && partyOf(pass, op.owner)?.kind !== 'you' ? [] : moneyCurrencies);
  // A pay names no item, so one that names anything but money is talk about a price (Q70).
  if (op.item && !namesMoney(listedName(pass, op.item), moneyCurrencies, moneyNames)) {
    skip(pass, `${payLabel(op)}: "${op.item}" isn't money`);
    return governedWhenRefused();
  }
  const stated = statedPay(pass, op);
  if (isRefusal(stated)) {
    skip(pass, `${payLabel(op)}: ${stated.reason}`);
    return governedWhenRefused();
  }
  const payer = partyOf(pass, op.owner);
  const payee = partyOf(pass, op.to);
  const refused = movePayment(pass, stated.currency, payer, payee, stated.amount);
  if (refused) skip(pass, `${payLabel(op)}: ${refused.reason}`);
  return payer || payee ? [stated.currency] : [];
}

/** Settles one buy: the money and the item apply together, or nothing changes and it logs why (Q69). */
function settleBuy(pass: PassRun, op: InventoryPassOp, quote: BuyQuote): void {
  const label = `buy "${op.item}"`;
  if (isRefusal(quote)) {
    skip(pass, `${label}: ${quote.reason}`);
    return;
  }
  const seller = partyOf(pass, op.owner);
  const buyer = partyOf(pass, op.to);
  const sold = seller?.kind === 'you';
  if (!buyer && !sold) {
    skip(pass, `${label}: nothing present is named "${op.to}" to buy it`);
    return;
  }
  if (buyer && seller && slotOwnerKey(buyer) === slotOwnerKey(seller)) {
    skip(pass, `${label}: "${op.owner}" sells it to itself`);
    return;
  }
  const before = { list: pass.list, runtimeItems: pass.runtimeItems, moneyStats: pass.moneyStats, lines: pass.diagnostics.length, uses: pass.itemUses.length, fired: pass.events.length };
  const undo = (why: string) => {
    pass.list = before.list;
    pass.runtimeItems = before.runtimeItems;
    pass.moneyStats = before.moneyStats;
    pass.diagnostics.length = before.lines;
    pass.itemUses.length = before.uses;
    pass.events.length = before.fired;
    skip(pass, `${label}: ${why}`);
  };
  const key = itemNameKey(listedName(pass, op.item));
  const visibleAt = (where: ItemCopyWhere) => candidates(pass, key, where, 'transfer').filter((copy) => copy.visibility === 'visible');
  const sellerPlace = seller ?? ownerOf(pass, op.owner);
  const held = sellerPlace ? visibleAt(sellerPlace) : [];
  // The new-copy rule stocks shops, so a player sells only what they hold (Q63).
  if (sold && held.reduce((sum, copy) => sum + copy.quantity, 0) < op.quantity) {
    undo(`none or too few at "${op.owner}"`);
    return;
  }
  if (quote.kind === 'priced') {
    const unpaid = movePayment(pass, quote.currency, buyer, seller, quote.amount);
    if (unpaid) {
      undo(unpaid.reason);
      return;
    }
  }
  let left = op.quantity;
  const takeFrom = (copies: readonly ItemCopy[]) => distribute(copies, left, (copy, quantity) => {
    left -= quantity;
    runOps(pass, [buyer ? { kind: 'transfer', copyId: copy.id, to: buyer, quantity } : { kind: 'lose', copyId: copy.id, quantity }]);
  });
  takeFrom(held);
  if (left > 0 && pass.scene.location) takeFrom(visibleAt({ kind: 'location', id: pass.scene.location.id }));
  if (left > 0 && buyer) {
    const itemId = gainId(pass, op.item, key);
    if (!itemId) {
      undo('the world has no item of that name');
      return;
    }
    runOps(pass, [{ kind: 'gain', itemId, quantity: left, to: buyer }]);
  }
  if (pass.diagnostics.length > before.lines) undo(pass.diagnostics[pass.diagnostics.length - 1]);
}

/** The reply's buys, each with its quote. A reply that repeats a buy word for word states one buy (Q68). */
function quoteBuys(pass: PassRun, passOps: readonly InventoryPassOp[]): Map<InventoryPassOp, BuyQuote> {
  const said = new Set<string>();
  return new Map(passOps.flatMap((op) => {
    if (op.op !== 'buy') return [];
    const words = JSON.stringify([itemIdentity(pass, op.item), op.quantity, itemNameKey(op.owner), itemNameKey(op.to), op.price ?? '', itemNameKey(op.currency ?? '')]);
    if (said.has(words)) return [];
    said.add(words);
    return [[op, quoteBuy(op, authoredNamed(pass, op.item), pass.moneyCurrencies, pass.moneyNames)] as const];
  }));
}

/**
 * Folds a pay into a buy it restates: a buy said again at the same sum (Q68), or one with no price, which takes the
 * pay's sum as its quote (Q71). Records that quote in `buys` and `pricedByPay`, and answers whether it folded.
 */
function foldPayIntoBuy(pass: PassRun, pay: InventoryPassOp, buys: Map<InventoryPassOp, BuyQuote>, pricedByPay: Set<InventoryPassOp>): boolean {
  const stated = statedPay(pass, pay);
  if (isRefusal(stated)) return false;
  const partyKey = (name: string) => { const party = partyOf(pass, name); return party && slotOwnerKey(party); };
  const sides = [partyKey(pay.owner), partyKey(pay.to)];
  const shares = (buy: InventoryPassOp) => sides.some((side) => !side || side === partyKey(buy.owner) || side === partyKey(buy.to));
  const sameSum = [...buys].some(([buy, quote]) => !isRefusal(quote) && quote.kind === 'priced' && quote.currency === stated.currency && quote.amount === stated.amount && shares(buy));
  if (!sameSum) {
    const unpriced = [...buys.keys()].find((buy) => {
      const item = authoredNamed(pass, buy.item);
      const own = item && currencyOf(item, pass.moneyCurrencies);
      return !buy.price && !pricedByPay.has(buy) && (!own || own === stated.currency) && shares(buy);
    });
    if (!unpriced) return false;
    pricedByPay.add(unpriced);
    buys.set(unpriced, { kind: 'priced', ...stated });
  }
  skip(pass, `${payLabel(pay)}: a buy in the reply is the same sum`);
  return true;
}

/** A reply's money once its pays settled: the buys still due in reply order, and the Currencies pays and buys govern. */
export interface ReplyMoney {
  buys: Map<InventoryPassOp, BuyQuote>;
  boughtItems: ReadonlySet<string>;
  paidIn: readonly Currency[];
}

/** Pays settle first. A pay or buy is the reply's only statement about its Currency's money, settled or refused (Q56, Q68). */
export function settlePays(pass: PassRun, passOps: readonly InventoryPassOp[]): ReplyMoney {
  const buys = quoteBuys(pass, passOps);
  const pricedByPay = new Set<InventoryPassOp>();
  const pays = passOps.filter((op) => op.op === 'pay' && !foldPayIntoBuy(pass, op, buys, pricedByPay));
  const paidIn = [
    ...pays.flatMap((op) => settlePay(pass, op)),
    ...[...buys.values()].flatMap((quote) => (isRefusal(quote) ? pass.moneyCurrencies : quote.currency ? [quote.currency] : [])),
  ];
  return { buys, paidIn, boughtItems: new Set([...buys.keys()].map((buy) => itemIdentity(pass, buy.item))) };
}

/** Settles the buy `op` once; a repeat of it logs and moves nothing. */
export function settleListedBuy(pass: PassRun, op: InventoryPassOp, buys: ReplyMoney['buys']): void {
  const quote = buys.get(op);
  if (quote) settleBuy(pass, op, quote);
  else skip(pass, `buy "${op.item}": the reply repeats it`);
  buys.delete(op);
}

/** Whether a pay or buy in the reply already states this item move, or the reply repeats a gain of money. Logs why. */
export function coveredByMoney(pass: PassRun, named: InventoryPassOp, { boughtItems, paidIn }: ReplyMoney, handMoves: Set<string>): boolean {
  const movesHands = named.op === 'gain' || named.op === 'lose' || named.op === 'transfer';
  const movesMoney = (currencies: readonly Currency[]) => movesHands && namesMoney(listedName(pass, named.item), currencies, pass.moneyNames);
  if (movesHands && boughtItems.has(itemIdentity(pass, named.item))) {
    skip(pass, `${named.op} "${named.item}": a buy in the reply covers this item`);
    return true;
  }
  if (movesMoney(paidIn)) {
    skip(pass, `${named.op} "${named.item}": a pay in the reply covers this money`);
    return true;
  }
  // A reply that repeats a gain of money, by item, quantity and receiver, states one gain (Q56).
  if (named.op === 'gain' && movesMoney(pass.moneyCurrencies)) {
    const said = JSON.stringify([itemNameKey(named.item), named.quantity, itemNameKey(named.to || named.owner)]);
    if (handMoves.has(said)) {
      skip(pass, `${named.op} "${named.item}": the reply repeats it`);
      return true;
    }
    handMoves.add(said);
  }
  return false;
}
