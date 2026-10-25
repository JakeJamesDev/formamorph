import type { CascadeOffTraitIds, EntityStatValues, OwnedTraitStates, PlayerStat, Trait } from '@/types';
import { ownStatsRecordKey, recordKey, recordKeyTrait } from './ownedTraitState';
import type { OwnerId } from './scope';
import { ownerStatTraitsInForce, sameCodeDelta, sameHidden, withCodeDelta, type TraitRuntimeState, type TraitWorld } from './traitRuntime';

/** One trait as one owner holds it. */
interface Slot { ownerId: OwnerId; traitId: string }

/** Where a slot stands in one trait state. */
interface SlotState {
  held: boolean;
  off: boolean;
  cascadeOff: boolean;
  /** The global trait itself, which the acquired list holds. */
  trait?: Trait;
  /** What its last switch moved on the global stats. */
  record?: Record<string, number>;
  /** What its last switch moved on its entity's own stats. */
  ownRecord?: Record<string, number>;
}

const slotKey = ({ ownerId, traitId }: Slot) => recordKey(ownerId, traitId);

/** Every slot the state holds anything for. */
function slotsOf(state: TraitRuntimeState): Slot[] {
  const out = new Map<string, Slot>();
  const add = (ownerId: OwnerId, traitId: string) => out.set(recordKey(ownerId, traitId), { ownerId, traitId });
  for (const trait of state.traits) add(null, trait.id);
  for (const id of [...state.disabledTraitIds, ...(state.cascadeOffTraitIds?.global ?? [])]) add(null, id);
  for (const [ownerId, owned] of Object.entries(state.ownedTraits ?? {})) {
    for (const id of [...owned.chosen, ...(owned.disabled ?? [])]) add(ownerId, id);
  }
  for (const [ownerId, ids] of Object.entries(state.cascadeOffTraitIds?.owners ?? {})) for (const id of ids) add(ownerId, id);
  for (const key of Object.keys(state.appliedValues)) add(...recordKeyTrait(key));
  return [...out.values()];
}

function read(state: TraitRuntimeState, { ownerId, traitId }: Slot): SlotState {
  const record = state.appliedValues[recordKey(ownerId, traitId)];
  if (ownerId === null) {
    const trait = state.traits.find((t) => t.id === traitId);
    return {
      held: !!trait, off: state.disabledTraitIds.includes(traitId), cascadeOff: !!state.cascadeOffTraitIds?.global?.includes(traitId),
      trait, record,
    };
  }
  const owned = state.ownedTraits?.[ownerId];
  return {
    held: !!owned?.chosen.includes(traitId), off: !!owned?.disabled?.includes(traitId),
    cascadeOff: !!state.cascadeOffTraitIds?.owners?.[ownerId]?.includes(traitId),
    record, ownRecord: state.appliedValues[ownStatsRecordKey(ownerId, traitId)],
  };
}

const sameRecord = (a: Record<string, number> | undefined, b: Record<string, number> | undefined): boolean =>
  a === b || (!!a && !!b && Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v));

const sameSlot = (a: SlotState, b: SlotState): boolean =>
  a.held === b.held && a.off === b.off && a.cascadeOff === b.cascadeOff && sameRecord(a.record, b.record) && sameRecord(a.ownRecord, b.ownRecord);

const inForce = (slot: SlotState) => slot.held && !slot.off;

/** `ids` with `id` in or out. */
const withId = (ids: readonly string[], id: string, member: boolean): string[] =>
  member ? (ids.includes(id) ? [...ids] : [...ids, id]) : ids.filter((other) => other !== id);

const withRecord = (values: TraitRuntimeState['appliedValues'], key: string, record: Record<string, number> | undefined) => {
  const { [key]: _dropped, ...rest } = values;
  return record === undefined ? rest : { ...rest, [key]: record };
};

/** `state` with the slot standing as `to`. */
function write(state: TraitRuntimeState, { ownerId, traitId }: Slot, to: SlotState): TraitRuntimeState {
  const cascade: CascadeOffTraitIds = state.cascadeOffTraitIds ?? {};
  let appliedValues = withRecord(state.appliedValues, recordKey(ownerId, traitId), to.record);
  if (ownerId === null) {
    const { trait } = to;
    const at = state.traits.findIndex((t) => t.id === traitId);
    const traits = !trait ? state.traits.filter((t) => t.id !== traitId)
      : at < 0 ? [...state.traits, trait] : state.traits.map((t, i) => (i === at ? trait : t));
    const global = withId(cascade.global ?? [], traitId, to.cascadeOff);
    return {
      ...state, traits, appliedValues,
      disabledTraitIds: withId(state.disabledTraitIds, traitId, to.off),
      cascadeOffTraitIds: global.length || cascade.global ? { ...cascade, global } : cascade,
    };
  }
  appliedValues = withRecord(appliedValues, ownStatsRecordKey(ownerId, traitId), to.ownRecord);
  const owned = state.ownedTraits?.[ownerId] ?? { chosen: [] };
  const disabled = withId(owned.disabled ?? [], traitId, to.off);
  const ownedTraits: OwnedTraitStates = {
    ...state.ownedTraits,
    [ownerId]: { chosen: withId(owned.chosen, traitId, to.held), ...(disabled.length ? { disabled } : {}) },
  };
  const cascadeOff = withId(cascade.owners?.[ownerId] ?? [], traitId, to.cascadeOff);
  const owners = cascadeOff.length || cascade.owners?.[ownerId] ? { ...cascade.owners, [ownerId]: cascadeOff } : cascade.owners;
  return { ...state, appliedValues, ownedTraits, cascadeOffTraitIds: { ...cascade, ...(owners ? { owners } : {}) } };
}

const addInto = (into: Map<string, number>, record: Record<string, number> | undefined) => {
  for (const [statId, delta] of Object.entries(record ?? {})) into.set(statId, (into.get(statId) ?? 0) + delta);
};

/** `latest` with the run's stat movement from `start` to `ran` laid over it, less `undo`, under the traits in
 *  force. A `hidden` the run flipped applies too. Every stat re-derives when the traits in force moved. */
function landStats(
  start: readonly PlayerStat[], ran: readonly PlayerStat[], latest: PlayerStat[], undo: ReadonlyMap<string, number> | undefined,
  active: readonly Trait[], traitsMoved: boolean,
): PlayerStat[] {
  const was = new Map(start.map((stat) => [stat.id, stat]));
  const now = new Map(ran.map((stat) => [stat.id, stat]));
  let changed = false;
  const out = latest.map((stat) => {
    const from = was.get(stat.id);
    const to = now.get(stat.id);
    const move = from && to ? to.value - from.value : 0;
    const back = undo?.get(stat.id) ?? 0;
    const bounds = !!from && !!to && !sameCodeDelta(from.codeDelta, to.codeDelta);
    const flipped = !!from && !!to && !sameHidden(from, to);
    if (!move && !back && !bounds && !flipped && !traitsMoved) return stat;
    changed = true;
    const shown = flipped ? { ...stat, hidden: to?.hidden === true } : stat;
    return withCodeDelta(shown, bounds ? to?.codeDelta : stat.codeDelta, stat.value + move - back, active);
  });
  return changed ? out : latest;
}

/**
 * A switch run's landing on the state play reached meanwhile (Q3). Only the traits the run changed from
 * `start` land; a trait the player also changed keeps the player's state, and the stat changes of the
 * run's switch of it drop with it (Q8, Q14). The run's other stat movement lands on top of `latest`.
 * `dropped` holds the record keys of the traits whose run change dropped.
 */
export function landSwitchRun(
  start: TraitRuntimeState, ran: TraitRuntimeState, latest: TraitRuntimeState, world: TraitWorld,
): { state: TraitRuntimeState; dropped: Set<string> } {
  let landed = latest;
  const dropped = new Set<string>();
  const undoGlobal = new Map<string, number>();
  const undoOwn = new Map<string, Map<string, number>>();
  const seen = new Set<string>();
  for (const slot of [...slotsOf(start), ...slotsOf(ran)]) {
    const key = slotKey(slot);
    if (seen.has(key)) continue;
    seen.add(key);
    const was = read(start, slot);
    const now = read(ran, slot);
    if (sameSlot(was, now)) continue;
    if (sameSlot(was, read(latest, slot))) {
      landed = write(landed, slot, now);
      continue;
    }
    dropped.add(key);
    if (inForce(was) === inForce(now)) continue;
    addInto(undoGlobal, now.record);
    if (slot.ownerId !== null) {
      const own = undoOwn.get(slot.ownerId) ?? new Map<string, number>();
      addInto(own, now.ownRecord);
      undoOwn.set(slot.ownerId, own);
    }
  }
  const traitsMoved = landed !== latest;
  const entityStats: EntityStatValues | undefined = latest.entityStats && Object.fromEntries(
    Object.entries(latest.entityStats).map(([ownerId, stats]) => [ownerId, landStats(
      start.entityStats?.[ownerId] ?? stats, ran.entityStats?.[ownerId] ?? stats, stats, undoOwn.get(ownerId),
      ownerStatTraitsInForce(landed, world, ownerId), traitsMoved,
    )]),
  );
  const state = {
    ...landed,
    stats: landStats(start.stats, ran.stats, latest.stats, undoGlobal, ownerStatTraitsInForce(landed, world, null), traitsMoved),
    ...(entityStats ? { entityStats } : {}),
  };
  return { state, dropped };
}
