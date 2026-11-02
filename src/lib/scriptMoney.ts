import type { SlotOwner } from '@/lib/bodies';
import { applyPaymentStats, balanceOf, planPayment, readStatedPrice, type PaymentState, type PaymentStats, type StatedPrice } from '@/lib/currency';
import { applyInventoryOps, type InventoryOp } from '@/lib/inventory';
import type { SandboxMoney } from '@/lib/statCodeExecutor';
import { randomUUID } from '@/lib/uuid';
import type { Currency, Item, ItemCopy, Placement, PlayerStat, Slot } from '@/types';

/** What one script run reads and settles money over: the turn's state, which the run's own payments then move. */
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

/** A script's money: payments plan over the run's own state, which leaves out its direct writes and `give` calls. */
export function scriptMoney(state: ScriptMoneyState): SandboxMoney {
  // Copies a payment made have no id the host knows, so the next plan can't spend them.
  const known = new Set(state.copies.map((copy) => copy.id));
  const started = state.stats;
  const world = { items: state.items, slots: state.slots };
  let copies: readonly ItemCopy[] = state.copies;
  let stats = state.stats;
  const ops: InventoryOp[] = [];
  const touched = new Map<string, { ownerId: string | null; statId: string }>();

  const onFor = (id: string) => state.statsOn(id, stats.entityStats[id] ?? []);
  const playerOwner = (statId: string) => state.playedIds.find((id) => onFor(id).some((stat) => stat.id === statId));
  const reading = (held: readonly ItemCopy[]): PaymentState => ({
    copies: held, placements: state.placements, globalStats: state.statsOn(null, stats.globalStats),
    statsOf: (owner) => (owner.kind === 'entity' ? onFor(owner.id) : state.playedIds.flatMap(onFor)),
  });
  const currencyOf = (id: string) => state.currencies.find((currency) => currency.id === id);

  return {
    balance: (currencyId, owner: SlotOwner) => {
      const currency = currencyOf(currencyId);
      const held = currency && balanceOf(currency, owner, reading(copies));
      return held?.tracked ? held.amount : null;
    },
    pay: (currencyId, payer, payee, price) => {
      const currency = currencyOf(currencyId);
      if (!currency) return refused('the world has no such Currency');
      const stated: StatedPrice = typeof price === 'number'
        ? (price > 0 && Number.isFinite(price) && (currency.backing.kind !== 'items' || Number.isInteger(price))
          ? { currency, amount: price } : { refused: `${price} is no amount` })
        : readStatedPrice(price, '', [currency], state.itemNames);
      if ('refused' in stated) return refused(stated.refused);
      const plan = planPayment(currency, payer, payee, stated.amount, reading(copies.filter((copy) => known.has(copy.id))), state.itemNames);
      if (!plan.settled) return refused(plan.reason);
      if (plan.ops.length) {
        copies = applyInventoryOps(copies, plan.ops, { world, source: 'script', newId: randomUUID }).copies;
        ops.push(...plan.ops);
      }
      if (plan.stats.length) {
        stats = applyPaymentStats(stats, plan.stats, playerOwner);
        for (const { owner, statId } of plan.stats) {
          const ownerId = owner === null ? null : owner.kind === 'entity' ? owner.id : playerOwner(statId) ?? null;
          if (owner === null || ownerId !== null) touched.set(JSON.stringify([ownerId, statId]), { ownerId, statId });
        }
      }
      return { paid: true, reason: '' };
    },
    settled: () => ({
      ops,
      stats: [...touched.values()].flatMap(({ ownerId, statId }) => {
        const find = (from: PaymentStats) => (ownerId === null ? from.globalStats : from.entityStats[ownerId] ?? []).find((other) => other.id === statId);
        const stat = find(stats);
        const first = find(started);
        return stat && first ? [{ ownerId, write: { id: statId, name: stat.name, value: stat.value }, delta: stat.value - first.value }] : [];
      }),
    }),
  };
}
