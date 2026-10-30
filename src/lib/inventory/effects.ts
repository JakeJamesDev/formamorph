/**
 * Item stat effects: one settle turns the Item Copies into the effects in force on each owner's own stats.
 * Value changes are recorded and reverse exactly what they moved (Q6); min, max and regen derive from the
 * Item Copies as trait contributions do (Q51), and a cap carry rides on the value record (Q110). The seed,
 * the panel and the orphan drop share it. Pure.
 */
import { faceName, foldSighting, isUnidentified, seenItemName } from '@/lib/items';
import { deriveEffectiveStats, movement, negated, settleValues } from '@/lib/traitRuntime';
import { playedEntityIds } from '@/lib/scope';
import { formatStatDelta } from '@/lib/statBar';
import type {
  AppliedItemEffect, CodeBounds, EntityStatValues, Item, ItemCopy, ItemCopyWhere, ItemEffectLedger, ItemStatEffect,
  ItemStatFacet, PersonaRef, PlayerStat, TimedItemEffect, Trait,
} from '@/types';

/** One use of an authored item: what starts its After Use effects on the Item Copy's owner. */
export interface Dose {
  itemId: string;
  where: ItemCopyWhere;
  hidden: boolean;
  /** Absent = identified. */
  unidentified?: boolean;
}

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
  /** The uses to start this settle. */
  doses?: readonly Dose[];
  /** The story clock's `gameTime`. Absent: no timed effect ends. */
  now?: number;
}

/** One stat facet an item effect moved, for the log. */
export interface ItemEffectChange {
  /** Null for a hidden Item Copy (Q63); the unidentified face for an unidentified one (Q17). */
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
  /** The keys of the timed stat effects that ended because their item or owner no longer exists. */
  orphaned: string[];
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
  unidentified: boolean;
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
    const unidentified = isUnidentified(copy);
    if (rowsOf(item, 'owned').length) {
      const key = `owned:${ownerId}:${item.id}`;
      const seen = wanted.get(key);
      if (seen) foldSighting(seen, hidden, unidentified);
      else wanted.set(key, { key, ownerId, item, timing: 'owned', hidden, unidentified });
    }
    if (copy.equipped && rowsOf(item, 'equipped').length) {
      const key = `equipped:${ownerId}:${copy.id}`;
      wanted.set(key, { key, ownerId, item, timing: 'equipped', hidden, unidentified });
    }
  }
  return wanted;
}

/** The stat row a timed effect runs. */
const timedRow = (entry: TimedItemEffect, items: ReadonlyMap<string, Item>) =>
  items.get(entry.itemId)?.statEffects.find((row) => row.id === entry.rowId && row.op === 'add');

/** The trait row a timed effect runs. */
export const timedTraitRow = (entry: TimedItemEffect, items: ReadonlyMap<string, Item>) =>
  items.get(entry.itemId)?.traitEffects.find((row) => row.id === entry.rowId);

/** What the sources in `applied` and the running timed stat effects add to each of one owner's bounds, by stat id. */
function boundDeltas(
  applied: Readonly<Record<string, AppliedItemEffect>>, timed: Readonly<Record<string, TimedItemEffect>>, ownerId: string,
  items: ReadonlyMap<string, Item>,
): Map<string, CodeBounds> {
  const out = new Map<string, CodeBounds>();
  const add = (row: ItemStatEffect) => {
    if (row.facet === 'value') return;
    const delta = out.get(row.statId) ?? {};
    delta[row.facet] = (delta[row.facet] ?? 0) + row.amount;
    out.set(row.statId, delta);
  };
  for (const entry of Object.values(applied)) {
    if (entry.ownerId === ownerId) for (const row of rowsOf(items.get(entry.itemId), entry.timing)) add(row);
  }
  for (const entry of Object.values(timed)) {
    const row = entry.row === 'stat' && entry.ownerId === ownerId ? timedRow(entry, items) : undefined;
    if (row) add(row);
  }
  return out;
}

/** The key a running After Use row has on its owner. A second dose finds it (Q64). */
export const timedKey = (ownerId: string, itemId: string, rowId: string): string => `${ownerId}:${itemId}:${rowId}`;

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
  const timed: Record<string, TimedItemEffect> = { ...state.ledger?.timed };
  const orphaned: string[] = [];
  const changes: ItemEffectChange[] = [];
  const diagnostics: string[] = [];
  const wanted = wantedSources(state.copies, items, world, entityStats);

  /** Re-derives one owner's bounds under the sources now in `applied`, then lands `deltas`. */
  const settleOwner = (ownerId: string, deltas: Map<string, number>, followCap: boolean): Record<string, number> => {
    const stats = entityStats[ownerId];
    if (!stats) return {};
    const derived = deriveEffectiveStats(withItemDeltas(stats, boundDeltas(applied, timed, ownerId, items)), traitsOf(ownerId));
    const next = settleValues(stats, derived, deltas, followCap);
    entityStats = { ...entityStats, [ownerId]: next };
    return movement(stats, next);
  };

  const statName = (ownerId: string, statId: string) => entityStats[ownerId]?.find((s) => s.id === statId)?.name ?? statId;
  const logMoves = (itemName: string | null, ownerId: string, moved: Record<string, number>, bounds: readonly ItemStatEffect[], sign: 1 | -1) => {
    for (const [statId, amount] of Object.entries(moved)) changes.push({ itemName, statName: statName(ownerId, statId), facet: 'value', amount });
    for (const row of bounds) changes.push({ itemName, statName: statName(ownerId, row.statId), facet: row.facet, amount: sign * row.amount });
  };
  /** The rows of `item` whose stat `ownerId` has; the rest get a diagnostic under the name the player sees. */
  const ownedRows = (item: Item, ownerId: string, rows: readonly ItemStatEffect[], unidentified: boolean) => rows.filter((row) => {
    const has = !!entityStats[ownerId]?.some((s) => s.id === row.statId);
    if (!has) diagnostics.push(`Item ${faceName(item, unidentified)}: owner ${ownerId} has no stat ${row.statId}`);
    return has;
  });

  for (const [key, entry] of Object.entries(applied)) {
    const still = wanted.get(key);
    if (still) {
      if (!!entry.hidden !== still.hidden || !!entry.unidentified !== still.unidentified) {
        const { hidden: _was, unidentified: _wasUnidentified, ...rest } = entry;
        applied[key] = { ...rest, ...(still.hidden && { hidden: true }), ...(still.unidentified && { unidentified: true }) };
      }
      continue;
    }
    delete applied[key];
    const item = items.get(entry.itemId);
    const moved = settleOwner(entry.ownerId, negated(Object.entries(entry.values)), false);
    const bounds = rowsOf(item, entry.timing).filter((row) => row.facet !== 'value' && entityStats[entry.ownerId]?.some((s) => s.id === row.statId));
    logMoves(item ? seenItemName(item, !!entry.hidden, !!entry.unidentified) : null, entry.ownerId, moved, bounds, -1);
  }

  for (const source of wanted.values()) {
    if (applied[source.key]) continue;
    const rows = ownedRows(source.item, source.ownerId, rowsOf(source.item, source.timing), source.unidentified);
    applied[source.key] = {
      ownerId: source.ownerId, itemId: source.item.id, timing: source.timing, values: {},
      ...(source.hidden && { hidden: true }), ...(source.unidentified && { unidentified: true }),
    };
    const values = settleOwner(source.ownerId, valueRowDeltas(rows), true);
    applied[source.key] = { ...applied[source.key], values };
    logMoves(seenItemName(source.item, source.hidden, source.unidentified), source.ownerId, values, rows.filter((row) => row.facet !== 'value'), 1);
  }

  /** Rows that act for good: bounds move the stat's bases, and nothing records them (Q111). */
  const applyForGood = (ownerId: string, item: Item, rows: readonly ItemStatEffect[], hidden: boolean, unidentified: boolean) => {
    const stats = entityStats[ownerId];
    if (!stats || !rows.length) return;
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
    const derived = deriveEffectiveStats(withItemDeltas(rebased, boundDeltas(applied, timed, ownerId, items)), traitsOf(ownerId));
    const next = settleValues(stats, derived, valueRowDeltas(rows), true);
    entityStats = { ...entityStats, [ownerId]: next };
    logMoves(seenItemName(item, hidden, unidentified), ownerId, movement(stats, next), rows.filter((row) => row.facet !== 'value'), 1);
  };

  for (const copy of state.copies) {
    if (copy.item.kind !== 'item' || !(copy.quantity > 0)) continue;
    const item = items.get(copy.item.itemId);
    const ownerId = statOwnerOf(copy.where, world, entityStats);
    // An owner with no stats yet, such as `you` before a persona, keeps its First Obtain for later.
    const stats = ownerId === null ? undefined : entityStats[ownerId];
    if (!item || ownerId === null || !stats || firstObtained[ownerId]?.includes(item.id) || !rowsOf(item, 'firstObtain').length) continue;
    firstObtained[ownerId] = [...firstObtained[ownerId] ?? [], item.id];
    applyForGood(ownerId, item, ownedRows(item, ownerId, rowsOf(item, 'firstObtain'), isUnidentified(copy)), copy.visibility === 'hidden', isUnidentified(copy));
  }

  // A timed effect ends once the clock reaches its end, or once its item or owner is gone, and reverses what it moved.
  for (const [key, entry] of Object.entries(timed)) {
    if (entry.row !== 'stat') continue;
    const row = timedRow(entry, items);
    const gone = !row || !entityStats[entry.ownerId];
    if (!gone && !(state.now !== undefined && state.now >= entry.endsAt)) continue;
    delete timed[key];
    if (gone) orphaned.push(key);
    const moved = settleOwner(entry.ownerId, negated(Object.entries(entry.values ?? {})), false);
    const item = items.get(entry.itemId);
    logMoves(item ? seenItemName(item, !!entry.hidden, !!entry.unidentified) : null, entry.ownerId, moved, row && row.facet !== 'value' ? [row] : [], -1);
  }

  // A dose starts each After Use row; a row already running restarts its timer instead (Q64).
  for (const dose of state.doses ?? []) {
    const item = items.get(dose.itemId);
    const ownerId = item ? statOwnerOf(dose.where, world, entityStats) : null;
    if (!item || ownerId === null) continue;
    const forGood: ItemStatEffect[] = [];
    for (const row of ownedRows(item, ownerId, rowsOf(item, 'used'), !!dose.unidentified)) {
      if (row.duration?.kind !== 'time') {
        forGood.push(row);
        continue;
      }
      const key = timedKey(ownerId, item.id, row.id);
      const endsAt = (state.now ?? 0) + row.duration.hours;
      if (timed[key]) {
        timed[key] = { ...timed[key], endsAt };
        continue;
      }
      timed[key] = {
        row: 'stat', ownerId, itemId: item.id, rowId: row.id, endsAt, values: {},
        ...(dose.hidden && { hidden: true }), ...(dose.unidentified && { unidentified: true }),
      };
      const values = settleOwner(ownerId, valueRowDeltas([row]), true);
      timed[key] = { ...timed[key], values };
      logMoves(seenItemName(item, dose.hidden, !!dose.unidentified), ownerId, values, row.facet === 'value' ? [] : [row], 1);
    }
    applyForGood(ownerId, item, forGood, dose.hidden, !!dose.unidentified);
  }

  const ledger: ItemEffectLedger = {
    ...(Object.keys(applied).length && { applied }),
    ...(Object.keys(firstObtained).length && { firstObtained }),
    ...(Object.keys(timed).length && { timed }),
  };
  return { entityStats, ledger, changes, diagnostics, orphaned };
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

/** One running timed effect as the panel shows it. */
export interface TimedEffectView {
  key: string;
  /** Null for a dose from a hidden Item Copy (Q63); the unidentified face for an unidentified one. */
  itemName: string | null;
  /** "Strength +2", or the granted trait's name. */
  effect: string;
  hoursLeft: number;
}

/** The names a timed effect's row reads on its owner. */
export interface TimedEffectNames {
  stat: (ownerId: string, statId: string) => string;
  trait: (ownerId: string, traitId: string) => string;
}

/** The timed effects running on `ownerIds`, soonest end first (Q40). */
export function timedEffectViews(
  ledger: ItemEffectLedger | undefined, items: readonly Item[], ownerIds: readonly string[], now: number, names: TimedEffectNames,
): TimedEffectView[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const views: TimedEffectView[] = [];
  for (const [key, entry] of Object.entries(ledger?.timed ?? {})) {
    const item = byId.get(entry.itemId);
    if (!item || !ownerIds.includes(entry.ownerId)) continue;
    let effect: string | null = null;
    if (entry.row === 'stat') {
      const row = timedRow(entry, byId);
      const amount = row && formatStatDelta(row.amount);
      if (row && amount) effect = `${FACET_LABEL[row.facet](names.stat(entry.ownerId, row.statId))} ${amount}`;
    } else {
      const row = timedTraitRow(entry, byId);
      if (row) effect = names.trait(entry.ownerId, row.traitId);
    }
    if (effect) views.push({ key, itemName: seenItemName(item, !!entry.hidden, !!entry.unidentified), effect, hoursLeft: Math.max(0, entry.endsAt - now) });
  }
  return views.sort((a, b) => a.hoursLeft - b.hoursLeft);
}

/** Every log line of one settle: each change, then each diagnostic. */
export const itemEffectLog = (result: Pick<ItemEffectResult, 'changes' | 'diagnostics'>, resolve?: (text: string) => string): string[] => [
  ...result.changes.flatMap((change) => itemEffectLine(change, resolve) ?? []),
  ...result.diagnostics,
];
