/**
 * Item stat effects: one settle turns the Item Copies into the effects in force on each owner's own stats.
 * Value changes are recorded and reverse exactly what they moved (Q6); min, max and regen derive from the
 * Item Copies as trait contributions do (Q51), and a cap carry rides on the value record (Q110). The seed,
 * the panel and the orphan drop share it. Pure.
 */
import { deriveEffectiveStats, movement, negated, settleValues } from '@/lib/traitRuntime';
import { playedEntityIds } from '@/lib/scope';
import { formatStatDelta } from '@/lib/statBar';
import type {
  AppliedItemEffect, CodeBounds, EntityStatValues, Item, ItemCopy, ItemCopyWhere, ItemEffectLedger, ItemStatEffect,
  ItemStatFacet, PersonaRef, PlayerStat, Trait,
} from '@/types';

/** The authored slice the settle reads. An absent slice reads as empty. */
export interface ItemEffectWorld {
  items?: readonly Item[];
  /** Who `you` is. Absent ⇒ `you` has no stats. */
  persona?: PersonaRef;
  /** The world entities, for the Custom Persona entity a `you` owner can resolve to. */
  entities?: readonly { id: string; customPersona?: boolean }[];
}

export interface ItemEffectState {
  copies: readonly ItemCopy[];
  entityStats: EntityStatValues;
  ledger: ItemEffectLedger | undefined;
}

/** One stat facet an item effect moved, for the log. */
export interface ItemEffectChange {
  /** Null for a hidden Item Copy (Q63). */
  itemName: string | null;
  statName: string;
  facet: ItemStatFacet;
  amount: number;
}

export interface ItemEffectResult {
  entityStats: EntityStatValues;
  ledger: ItemEffectLedger;
  changes: ItemEffectChange[];
  /** One line per row whose owner lacks its stat (Q50). */
  diagnostics: string[];
}

/** Each owner's stat traits in force, which bounds derive from. */
export type OwnerStatTraits = (ownerId: string) => readonly Trait[];

type Timing = AppliedItemEffect['timing'];

/** A source that should be in force, keyed as the ledger keys it. */
interface Wanted {
  key: string;
  ownerId: string;
  item: Item;
  timing: Timing;
  hidden: boolean;
}

const BOUND_FACETS = ['min', 'max', 'regen'] as const;

const rowsOf = (item: Item | undefined, timing: ItemStatEffect['timing']) =>
  (item?.statEffects ?? []).filter((row) => row.timing === timing && row.op === 'add');

/** The entity whose own stats a `where` moves: the entity, or for `you` the played entity holding stats (Q107).
 *  `you` with no played entity keeps the key `you`, which holds no stats. */
function statOwnerOf(where: ItemCopyWhere, world: ItemEffectWorld, entityStats: EntityStatValues): string | null {
  if (where.kind === 'location') return null;
  if (where.kind === 'entity') return where.id;
  const played = world.persona ? playedEntityIds(world.persona, world.entities) : [];
  return played.find((id) => entityStats[id]) ?? played[0] ?? 'you';
}

/** The sources the Item Copies put in force, in copy order: one While Owned per owner and item (Q11), one
 *  While Equipped per equipped Item Copy (Q109). Hidden Item Copies count (Q63). */
function wantedSources(copies: readonly ItemCopy[], items: ReadonlyMap<string, Item>, world: ItemEffectWorld, entityStats: EntityStatValues): Map<string, Wanted> {
  const wanted = new Map<string, Wanted>();
  for (const copy of copies) {
    if (copy.item.kind !== 'item' || !(copy.quantity > 0)) continue;
    const item = items.get(copy.item.itemId);
    const ownerId = statOwnerOf(copy.where, world, entityStats);
    if (!item || ownerId === null) continue;
    const hidden = copy.visibility === 'hidden';
    if (rowsOf(item, 'owned').length) {
      const key = `owned:${ownerId}:${item.id}`;
      const seen = wanted.get(key);
      if (seen) seen.hidden &&= hidden;
      else wanted.set(key, { key, ownerId, item, timing: 'owned', hidden });
    }
    if (copy.equipped && rowsOf(item, 'equipped').length) {
      const key = `equipped:${ownerId}:${copy.id}`;
      wanted.set(key, { key, ownerId, item, timing: 'equipped', hidden });
    }
  }
  return wanted;
}

/** What the sources in `applied` add to each of one owner's bounds, by stat id. */
function boundDeltas(applied: Readonly<Record<string, AppliedItemEffect>>, ownerId: string, items: ReadonlyMap<string, Item>): Map<string, CodeBounds> {
  const out = new Map<string, CodeBounds>();
  for (const entry of Object.values(applied)) {
    if (entry.ownerId !== ownerId) continue;
    for (const row of rowsOf(items.get(entry.itemId), entry.timing)) {
      if (row.facet === 'value') continue;
      const delta = out.get(row.statId) ?? {};
      delta[row.facet] = (delta[row.facet] ?? 0) + row.amount;
      out.set(row.statId, delta);
    }
  }
  return out;
}

/** `stats` carrying exactly `deltas` as their item bound deltas. */
function withItemDeltas(stats: readonly PlayerStat[], deltas: ReadonlyMap<string, CodeBounds>): PlayerStat[] {
  return stats.map((stat) => {
    const delta = deltas.get(stat.id);
    const { itemDelta: _old, ...rest } = stat;
    return delta && BOUND_FACETS.some((f) => delta[f]) ? { ...rest, itemDelta: delta } : rest;
  });
}

const valueRowDeltas = (rows: readonly ItemStatEffect[]): Map<string, number> => {
  const out = new Map<string, number>();
  for (const row of rows) if (row.facet === 'value') out.set(row.statId, (out.get(row.statId) ?? 0) + row.amount);
  return out;
};

/**
 * Brings the item effects in line with the Item Copies: each source no longer in force reverses its record,
 * each new one applies and records what moved, and each owner's On First Obtain effects apply once (Q4). An
 * owner without a row's stat skips that row with a diagnostic. Never changes its inputs.
 */
export function settleItemEffects(state: ItemEffectState, world: ItemEffectWorld, traitsOf: OwnerStatTraits): ItemEffectResult {
  const items = new Map((world.items ?? []).map((item) => [item.id, item]));
  let entityStats = state.entityStats;
  const applied: Record<string, AppliedItemEffect> = { ...state.ledger?.applied };
  const firstObtained: Record<string, string[]> = { ...state.ledger?.firstObtained };
  const changes: ItemEffectChange[] = [];
  const diagnostics: string[] = [];
  const wanted = wantedSources(state.copies, items, world, entityStats);

  /** Re-derives one owner's bounds under the sources now in `applied`, then lands `deltas`. */
  const settleOwner = (ownerId: string, deltas: Map<string, number>, followCap: boolean): Record<string, number> => {
    const stats = entityStats[ownerId];
    if (!stats) return {};
    const derived = deriveEffectiveStats(withItemDeltas(stats, boundDeltas(applied, ownerId, items)), traitsOf(ownerId));
    const next = settleValues(stats, derived, deltas, followCap);
    entityStats = { ...entityStats, [ownerId]: next };
    return movement(stats, next);
  };

  const statName = (ownerId: string, statId: string) => entityStats[ownerId]?.find((s) => s.id === statId)?.name ?? statId;
  const logMoves = (itemName: string | null, ownerId: string, moved: Record<string, number>, bounds: readonly ItemStatEffect[], sign: 1 | -1) => {
    for (const [statId, amount] of Object.entries(moved)) changes.push({ itemName, statName: statName(ownerId, statId), facet: 'value', amount });
    for (const row of bounds) changes.push({ itemName, statName: statName(ownerId, row.statId), facet: row.facet, amount: sign * row.amount });
  };
  /** The rows of `item` whose stat `ownerId` has; the rest get a diagnostic. */
  const ownedRows = (item: Item, ownerId: string, rows: readonly ItemStatEffect[]) => rows.filter((row) => {
    const has = !!entityStats[ownerId]?.some((s) => s.id === row.statId);
    if (!has) diagnostics.push(`Item ${item.name}: owner ${ownerId} has no stat ${row.statId}`);
    return has;
  });

  for (const [key, entry] of Object.entries(applied)) {
    const still = wanted.get(key);
    if (still) {
      if (!!entry.hidden !== still.hidden) {
        const { hidden: _was, ...rest } = entry;
        applied[key] = still.hidden ? { ...rest, hidden: true } : rest;
      }
      continue;
    }
    delete applied[key];
    const item = items.get(entry.itemId);
    const moved = settleOwner(entry.ownerId, negated(Object.entries(entry.values)), false);
    const bounds = rowsOf(item, entry.timing).filter((row) => row.facet !== 'value' && entityStats[entry.ownerId]?.some((s) => s.id === row.statId));
    logMoves(entry.hidden || !item ? null : item.name, entry.ownerId, moved, bounds, -1);
  }

  for (const source of wanted.values()) {
    if (applied[source.key]) continue;
    const rows = ownedRows(source.item, source.ownerId, rowsOf(source.item, source.timing));
    applied[source.key] = { ownerId: source.ownerId, itemId: source.item.id, timing: source.timing, values: {}, ...(source.hidden && { hidden: true }) };
    const values = settleOwner(source.ownerId, valueRowDeltas(rows), true);
    applied[source.key] = { ...applied[source.key], values };
    logMoves(source.hidden ? null : source.item.name, source.ownerId, values, rows.filter((row) => row.facet !== 'value'), 1);
  }

  // On First Obtain is permanent: its bounds move the stat's bases, and its record never reverses (Q111).
  for (const copy of state.copies) {
    if (copy.item.kind !== 'item' || !(copy.quantity > 0)) continue;
    const item = items.get(copy.item.itemId);
    const ownerId = statOwnerOf(copy.where, world, entityStats);
    // An owner with no stats yet, such as `you` before a persona, keeps its First Obtain for later.
    const stats = ownerId === null ? undefined : entityStats[ownerId];
    if (!item || ownerId === null || !stats || firstObtained[ownerId]?.includes(item.id) || !rowsOf(item, 'firstObtain').length) continue;
    firstObtained[ownerId] = [...firstObtained[ownerId] ?? [], item.id];
    const rows = ownedRows(item, ownerId, rowsOf(item, 'firstObtain'));
    if (!rows.length) continue;
    const rebased = stats.map((stat) => {
      const own = rows.filter((row) => row.statId === stat.id && row.facet !== 'value');
      if (!own.length) return stat;
      const sum = (facet: ItemStatFacet) => own.filter((row) => row.facet === facet).reduce((n, row) => n + row.amount, 0);
      return {
        ...stat,
        baseMin: (stat.baseMin ?? stat.min) + sum('min'),
        baseMax: (stat.baseMax ?? stat.max) + sum('max'),
        baseRegen: (stat.baseRegen ?? stat.regen ?? 0) + sum('regen'),
      };
    });
    const derived = deriveEffectiveStats(rebased, traitsOf(ownerId));
    const next = settleValues(stats, derived, valueRowDeltas(rows), true);
    entityStats = { ...entityStats, [ownerId]: next };
    logMoves(copy.visibility === 'hidden' ? null : item.name, ownerId, movement(stats, next), rows.filter((row) => row.facet !== 'value'), 1);
  }

  const ledger: ItemEffectLedger = {
    ...(Object.keys(applied).length && { applied }),
    ...(Object.keys(firstObtained).length && { firstObtained }),
  };
  return { entityStats, ledger, changes, diagnostics };
}

const FACET_LABEL: Record<ItemStatFacet, (name: string) => string> = {
  value: (name) => name,
  min: (name) => `Min ${name}`,
  max: (name) => `Max ${name}`,
  regen: (name) => `${name} Regen`,
};

/** The log line for one change: "Iron Sword: Strength +2", or "An item: …" when hidden (Q106). Null when the
 *  change rounds to nothing. */
export function itemEffectLine(change: ItemEffectChange, resolve: (text: string) => string = (text) => text): string | null {
  const amount = formatStatDelta(change.amount);
  if (amount === null) return null;
  const item = change.itemName === null ? 'An item' : resolve(change.itemName);
  return `${item}: ${FACET_LABEL[change.facet](resolve(change.statName))} ${amount}`;
}

/** Every log line of one settle: each change, then each diagnostic. */
export const itemEffectLog = (result: Pick<ItemEffectResult, 'changes' | 'diagnostics'>, resolve?: (text: string) => string): string[] => [
  ...result.changes.flatMap((change) => itemEffectLine(change, resolve) ?? []),
  ...result.diagnostics,
];
