import { slotOwnerKey, type SlotOwner } from '@/lib/bodies';
import { copiesAt, type InventoryOp } from '@/lib/inventory';
import { isSpendable } from '@/lib/items';
import type { Currency, CurrencyItem, EntityStatValues, ItemCopy, Placement, PlayerStat } from '@/types';
import { balanceOf, refuse, UNTRACKED, usableItems, balanceStat, type BalanceState, type ItemName, type Refusal } from './index';

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
export type PaymentPlan = { settled: true; ops: InventoryOp[]; stats: PaymentStatChange[] } | Refusal;

const SETTLES_NOTHING: PaymentPlan = { settled: true, ops: [], stats: [] };

/** The biggest amount the item search walks; a larger one takes its largest Item first. */
const ITEM_SEARCH_LIMIT = 100_000;

/** The fewest Items that make `amount` exactly, by item id. Null when no mix of the Items makes it. */
function fewestItems(amount: number, rows: readonly Pick<CurrencyItem, 'itemId' | 'worth'>[]): Map<string, number> | null {
  if (!rows.length) return null;
  const counts = new Map<string, number>();
  const largest = rows.reduce((top, row) => (row.worth > top.worth ? row : top));
  const peeled = amount > ITEM_SEARCH_LIMIT ? Math.ceil((amount - ITEM_SEARCH_LIMIT) / largest.worth) : 0;
  if (peeled) counts.set(largest.itemId, peeled);
  const rest = amount - peeled * largest.worth;
  const best = [0];
  const last: (typeof rows[number] | null)[] = [null];
  for (let at = 1; at <= rest; at += 1) {
    best[at] = Infinity;
    last[at] = null;
    for (const row of rows) {
      if (row.worth <= at && best[at - row.worth] + 1 < best[at]) {
        best[at] = best[at - row.worth] + 1;
        last[at] = row;
      }
    }
  }
  if (best[rest] === Infinity) return null;
  for (let at = rest; at > 0; at -= last[at]!.worth) counts.set(last[at]!.itemId, (counts.get(last[at]!.itemId) ?? 0) + 1);
  return counts;
}

/** The copies of a Currency Item `owner` can hand over: the ones Balance counts, carried before equipped. */
const spendableCopies = (itemId: string, owner: SlotOwner, copies: readonly ItemCopy[]): ItemCopy[] =>
  copiesAt(copies, owner)
    .filter((copy) => copy.item.kind === 'item' && copy.item.itemId === itemId && isSpendable(copy))
    .sort((a, b) => Number(!!a.equipped) - Number(!!b.equipped));

/** Ops that take `count` of a Currency Item from `owner`, and how many of the count its copies could not cover. */
function takeItems(
  itemId: string, count: number, owner: SlotOwner, copies: readonly ItemCopy[], op: (copyId: string, quantity: number) => InventoryOp[],
): { ops: InventoryOp[]; short: number } {
  const ops: InventoryOp[] = [];
  let short = count;
  for (const copy of spendableCopies(itemId, owner, copies)) {
    if (short <= 0) break;
    const quantity = Math.min(short, copy.quantity);
    ops.push(...op(copy.id, quantity));
    short -= quantity;
  }
  return { ops, short };
}

/** Settles Items: smallest first, change in the fewest Items, and only the net of each Item moves (Q11). */
function itemPlan(currency: Currency, payer: SlotOwner | null, payee: SlotOwner | null, amount: number, state: PaymentState, items: readonly ItemName[]): PaymentPlan {
  const rows = usableItems(currency, items).reverse();
  const paying = payer ? balanceOf(currency, payer, state) : UNTRACKED;
  const tracked = payee && balanceOf(currency, payee, state).tracked ? payee : null;
  if (!payer || !paying.tracked) {
    if (!tracked) return SETTLES_NOTHING;
    const made = fewestItems(amount, rows);
    if (!made) return refuse(`the items can't make ${amount}`);
    return { settled: true, stats: [], ops: [...made].map(([itemId, quantity]) => ({ kind: 'gain', itemId, quantity, to: tracked })) };
  }
  if (paying.amount < amount) return refuse(`it costs ${amount} and the payer has ${paying.amount}`);
  const net = new Map<string, number>();
  let rest = amount;
  for (const row of rows) {
    if (rest <= 0) break;
    const held = spendableCopies(row.itemId, payer, state.copies).reduce((sum, copy) => sum + copy.quantity, 0);
    const take = Math.min(held, Math.ceil(rest / row.worth));
    net.set(row.itemId, take);
    rest -= take * row.worth;
  }
  if (rest > 0) return refuse(`it costs ${amount} and the payer's items cover ${amount - rest}`);
  const change = rest < 0 ? fewestItems(-rest, rows) : new Map<string, number>();
  if (!change) return refuse(`the items can't make ${-rest} in change`);
  for (const [itemId, count] of change) net.set(itemId, (net.get(itemId) ?? 0) - count);
  const returned = new Map([...net].filter(([, count]) => count < 0).map(([itemId, count]) => [itemId, tracked
    ? takeItems(itemId, -count, tracked, state.copies, (copyId, quantity) => [{ kind: 'transfer', copyId, to: payer, quantity }])
    : { ops: [], short: -count }]));
  // Change the payee lacks is created, and a tracked payee gives up that worth from the handover, so value is conserved.
  const worthOf = (itemId: string) => rows.find((row) => row.itemId === itemId)?.worth ?? 0;
  let owed = tracked ? [...returned].reduce((sum, [itemId, back]) => sum + back.short * worthOf(itemId), 0) : 0;
  const dropped = new Map<string, number>();
  for (const { itemId, worth } of rows) {
    const count = net.get(itemId) ?? 0;
    if (count <= 0 || owed <= 0) continue;
    const drop = Math.min(count, Math.ceil(owed / worth));
    dropped.set(itemId, drop);
    owed -= drop * worth;
  }
  const topUp = owed < 0 ? fewestItems(-owed, rows) : new Map<string, number>();
  if (!topUp) return refuse(`the items can't make ${-owed} for the payee`);
  const ops: InventoryOp[] = [];
  for (const [itemId, count] of net) {
    if (count > 0) {
      let kept = tracked ? count - (dropped.get(itemId) ?? 0) : 0;
      ops.push(...takeItems(itemId, count, payer, state.copies, (copyId, quantity) => {
        const moved = Math.min(kept, quantity);
        kept -= moved;
        const handed: InventoryOp[] = moved > 0 && tracked ? [{ kind: 'transfer', copyId, to: tracked, quantity: moved }] : [];
        return moved < quantity ? [...handed, { kind: 'lose', copyId, quantity: quantity - moved }] : handed;
      }).ops);
    } else if (count < 0) {
      const back = returned.get(itemId)!;
      ops.push(...back.ops);
      if (back.short > 0) ops.push({ kind: 'gain', itemId, quantity: back.short, to: payer });
    }
  }
  if (tracked) for (const [itemId, quantity] of topUp) ops.push({ kind: 'gain', itemId, quantity, to: tracked });
  return { settled: true, stats: [], ops };
}

/** Settles a stat: locks refuse, the floor counts as money the payer lacks, and a full payee keeps only what fits. */
function statPlan(statId: string, payer: SlotOwner | null, payee: SlotOwner | null, amount: number, state: PaymentState): PaymentPlan {
  const paying = payer && balanceStat(statId, payer, state);
  const receiving = payee && balanceStat(statId, payee, state);
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

/** Moves `amount` base units from `payer` to `payee`, where null on either side is outside the world (Q8, Q51, Q54). */
export function planPayment(currency: Currency, payer: SlotOwner | null, payee: SlotOwner | null, amount: number, state: PaymentState, items: readonly ItemName[]): PaymentPlan {
  if (!payer && !payee) return refuse('no one pays and no one receives');
  if (payer && payee && slotOwnerKey(payer) === slotOwnerKey(payee)) return refuse('the payer receives it');
  if (!(amount > 0)) return refuse(`${amount} is no amount`);
  const { backing } = currency;
  if (backing.kind === 'name') return SETTLES_NOTHING;
  if (backing.kind === 'stat') return statPlan(backing.statId, payer, payee, amount, state);
  return itemPlan(currency, payer, payee, amount, state, items);
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

/** Whose stats hold money: the world's placements, the played entities, and which stats are on. */
export interface MoneyOwners {
  placements: readonly Placement[];
  /** The entities the player plays as, whose stats are the player's. */
  playedIds: readonly string[];
  /** Which of `stats`, an owner's or the world's on null, are switched on. */
  statsOn: (ownerId: string | null, stats: readonly PlayerStat[]) => readonly PlayerStat[];
}

/** `stats` as a payment reads them: its state over `copies`, and the played entity whose stat is the player's. */
export function moneyReading(owners: MoneyOwners, stats: PaymentStats) {
  const onFor = (id: string) => owners.statsOn(id, stats.entityStats[id] ?? []);
  return {
    stateOver: (copies: readonly ItemCopy[]): PaymentState => ({
      copies, placements: owners.placements, globalStats: owners.statsOn(null, stats.globalStats),
      statsOf: (owner) => (owner.kind === 'entity' ? onFor(owner.id) : owners.playedIds.flatMap(onFor)),
    }),
    // A switched-off stat reads as untracked, so the charge lands on the played entity whose stat was read.
    playerOwner: (statId: string) => owners.playedIds.find((id) => onFor(id).some((stat) => stat.id === statId)),
  };
}
