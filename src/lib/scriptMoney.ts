import type { SlotOwner } from '@/lib/bodies';
import { applyPaymentStats, balanceOf, planPayment, readStatedPrice, type PaymentState, type PaymentStats, type StatedPrice } from '@/lib/currency';
import { applyInventoryOps, type InventoryOp } from '@/lib/inventory';
import type { OwnRunWrites, SandboxMoney, ScriptPayment } from '@/lib/statCodeExecutor';
import { randomUUID } from '@/lib/uuid';
import { clamp } from '@/lib/utils';
import type { Currency, Item, ItemCopy, Placement, PlayerStat, Slot } from '@/types';

/** What one script run reads and settles money over: the chain's state, which the run's own writes then move. */
export interface ScriptMoneyState {
  currencies: readonly Currency[];
  items: readonly Item[];
  /** The items by the names a stated price reads them under. */
  itemNames: readonly Pick<Item, 'id' | 'name'>[];
  slots: readonly Slot[];
  placements: readonly Placement[];
  copies: readonly ItemCopy[];
  stats: PaymentStats;
  /** The entities the player plays as, whose stats are the player's. */
  playedIds: readonly string[];
  /** Which of `stats`, an owner's or the world's on null, are switched on. */
  statsOn: (ownerId: string | null, stats: readonly PlayerStat[]) => readonly PlayerStat[];
}

const refused = (reason: string) => ({ paid: false, reason });

const NEW_ITEMS_REFUSAL = "this script can't spend the items it just made, but the next script can";

const statKey = (ownerId: string | null, statId: string) => JSON.stringify([ownerId, statId]);

/** A script's money: payments plan over the chain's state and the run's own writes so far. */
export function scriptMoney(state: ScriptMoneyState): SandboxMoney {
  // A copy this run made has no id until the script lands, so the run's plans can't spend it.
  const known = new Set(state.copies.map((copy) => copy.id));
  const started = state.stats;
  const world = { items: state.items, slots: state.slots };
  let copies: readonly ItemCopy[] = state.copies;
  let stats = state.stats;
  let verbsSeen = 0;
  let written: OwnRunWrites['stats'] = [];
  const ops: InventoryOp[] = [];
  const payments: ScriptPayment[] = [];
  /** Each stat a payment moved, with the payments' net change. */
  const touched = new Map<string, { ownerId: string | null; statId: string; delta: number }>();

  const onFor = (id: string) => state.statsOn(id, stats.entityStats[id] ?? []);
  const playerOwner = (statId: string) => state.playedIds.find((id) => onFor(id).some((stat) => stat.id === statId));
  const reading = (held: readonly ItemCopy[]): PaymentState => ({
    copies: held, placements: state.placements, globalStats: state.statsOn(null, stats.globalStats),
    statsOf: (owner) => (owner.kind === 'entity' ? onFor(owner.id) : state.playedIds.flatMap(onFor)),
  });
  const currencyOf = (id: string) => state.currencies.find((currency) => currency.id === id);
  const find = (from: PaymentStats, ownerId: string | null, statId: string) =>
    (ownerId === null ? from.globalStats : from.entityStats[ownerId] ?? []).find((other) => other.id === statId);
  /** One scope's stats as the run leaves them: a written value, else the start, plus what its payments moved. */
  const nowOf = (ownerId: string | null, list: readonly PlayerStat[]) => list.map((stat) => {
    const write = written.findLast((row) => row.ownerId === ownerId && row.id === stat.id);
    const delta = touched.get(statKey(ownerId, stat.id))?.delta ?? 0;
    const value = (write ? clamp(write.value, stat.min, stat.max) : stat.value) + delta;
    return value === stat.value ? stat : { ...stat, value };
  });
  const settlePay = (currency: Currency, payer: SlotOwner | null, payee: SlotOwner | null, price: number | string) => {
    const stated: StatedPrice = typeof price === 'number'
      ? (price > 0 && Number.isFinite(price) && (currency.backing.kind !== 'items' || Number.isInteger(price))
        ? { currency, amount: price } : { refused: `${price} is no amount` })
      : readStatedPrice(price, '', [currency], state.itemNames);
    if ('refused' in stated) return refused(stated.refused);
    const plan = planPayment(currency, payer, payee, stated.amount, reading(copies.filter((copy) => known.has(copy.id))), state.itemNames);
    if (!plan.settled) {
      const noPersona = !state.playedIds.length && (payer?.kind === 'you' || payee?.kind === 'you');
      if (noPersona) return refused('the player has no money: no persona is in play');
      const withNew = planPayment(currency, payer, payee, stated.amount, reading(copies), state.itemNames);
      return refused(withNew.settled ? NEW_ITEMS_REFUSAL : plan.reason);
    }
    if (plan.ops.length) {
      copies = applyInventoryOps(copies, plan.ops, { world, source: 'script', newId: randomUUID }).copies;
      ops.push(...plan.ops);
    }
    if (plan.stats.length) {
      const before = stats;
      stats = applyPaymentStats(stats, plan.stats, playerOwner);
      // One plan can name a stat twice; the diff holds its whole move.
      const counted = new Set<string>();
      for (const { owner, statId } of plan.stats) {
        const ownerId = owner === null ? null : owner.kind === 'entity' ? owner.id : playerOwner(statId) ?? null;
        const key = statKey(ownerId, statId);
        if ((owner !== null && ownerId === null) || counted.has(key)) continue;
        counted.add(key);
        const moved = (find(stats, ownerId, statId)?.value ?? 0) - (find(before, ownerId, statId)?.value ?? 0);
        touched.set(key, { ownerId, statId, delta: (touched.get(key)?.delta ?? 0) + moved });
      }
    }
    return { paid: true, reason: '' };
  };

  return {
    ownWrites: (own) => {
      const verbs = own.ops.slice(verbsSeen);
      verbsSeen = own.ops.length;
      if (verbs.length) copies = applyInventoryOps(copies, verbs, { world, source: 'script', newId: randomUUID }).copies;
      written = own.stats;
      stats = {
        globalStats: nowOf(null, started.globalStats),
        entityStats: Object.fromEntries(Object.entries(started.entityStats).map(([id, list]) => [id, nowOf(id, list)])),
      };
    },
    balance: (currencyId, owner: SlotOwner) => {
      const currency = currencyOf(currencyId);
      const held = currency && balanceOf(currency, owner, reading(copies));
      return held?.tracked ? held.amount : null;
    },
    pay: (currencyId, payer, payee, price) => {
      const currency = currencyOf(currencyId);
      if (!currency) return refused('the world has no such Currency');
      const result = settlePay(currency, payer, payee, price);
      payments.push({ currencyId, payer, payee, amount: price, ...result });
      return result;
    },
    settled: () => ({
      ops,
      payments,
      stats: [...touched.values()].flatMap(({ ownerId, statId, delta }) => {
        const first = find(started, ownerId, statId);
        return first ? [{ ownerId, write: { id: statId, name: first.name, value: first.value + delta }, delta, min: first.min, max: first.max }] : [];
      }),
    }),
  };
}
