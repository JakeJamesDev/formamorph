// Trait runtime orchestration: acquiring a trait mid-play, switching one on or off, and the stat maths that
// goes with it. Pure over a small slice of gameplay state, so all of it is reachable from a test.
//
// Two rules shape everything here:
//
// - Bounds are DERIVED, never patched. A stat's effective min/max/regen is its authored base plus the
//   contributions of whichever traits are active right now plus what the AI and stat code have moved.
//   Recomputing instead of accumulating means bounds cannot drift however many times a trait is toggled.
// - Value movement is RECORDED. A trait's stat change that a floor or ceiling refused moved nothing, so
//   switching it off must give back nothing. Each switch stores what actually moved and the next switch of
//   that trait reverses it, rather than the authored number.

import type {
  CascadeOffTraitIds, CodeBoundDeltas, CodeBounds, Daypart, EntityStatValues, LegacyCodeBoundsStat, OwnedTraitPicks, OwnedTraitStates, PersonaRef,
  PlayerStat, Stat, StatChange, Trait, TraitGroup,
} from '@/types';
import { clamp } from './utils';
import { statStartValue } from './statDescriptorGeometry';
import { ownedTraitStatesFrom, ownStatsRecordKey, recordKey } from './ownedTraitState';
import { activeOwnedTraitIds } from './ownedTraitsInPlay';
import { activeStatEnabled, exclusiveSiblings, inAuthoredOrder, isAlwaysOn, isHidden } from './traitEffects';
import { hasStatEffects, offeredWorldTraits, type StatRow } from './traitTree';
import {
  gateOf, gateStates, modeRefuses, overfills, settle, underfills, type GateEntity, type GateInput, type GateOwner, type GateStat,
  type GateStates, type GateStats, type GateTraitRef, type GateTree,
} from './traitGates';
import { mapScoped, partOf, playedEntityIds, scoped, scopedEntries, type OwnerId, type Scoped } from './scope';

/** What a trait's last switch actually moved: record key → stat id → value delta, keyed as `recordKey` and
 *  `ownStatsRecordKey` (lib/ownedTraitState) spell it. */
export type AppliedTraitValues = Record<string, Record<string, number>>;

/** The gameplay slice trait operations read and rewrite. */
export interface TraitRuntimeState {
  stats: PlayerStat[];
  /** The global traits — chosen at creation or acquired during the game. Switched-off ones stay listed. */
  traits: Trait[];
  disabledTraitIds: string[];
  appliedValues: AppliedTraitValues;
  /** The traits a cascade turned off, which return once their gate holds. Absent ⇒ none. */
  cascadeOffTraitIds?: CascadeOffTraitIds;
  /** Each entity's owned traits. Absent ⇒ none. */
  ownedTraits?: OwnedTraitStates;
  /** Each entity's stat values, which its own traits move. Absent ⇒ none. */
  entityStats?: EntityStatValues;
}

/** The authored world, for exclusive-group lookups and gates. Absent `entities` or `persona`, no "playing
 *  as" requirement holds. */
export type TraitWorld = {
  traits: Trait[];
  groups: TraitGroup[];
  persona?: PersonaRef;
  /** A commit's one stat snapshot, which every settle in that commit reads (Q19). Absent ⇒ gates read the
   *  state's live stats. */
  gateStats?: GateStats;
  /** The story clock's daypart, which every time Condition reads. Absent ⇒ the opening hour's. */
  daypart?: Daypart;
} & (
  | { entities?: readonly GateEntity[]; global?: undefined; owners?: undefined }
  /** Global scope's tree and every present entity owner as the gate module reads them (see lib/owners).
   *  Absent ⇒ only the world's offered traits gate. The entities name the Custom Persona entity among them. */
  | { entities: readonly GateEntity[]; global: GateTree; owners: readonly GateOwner[] }
);

/** The traits currently in force: everything in the global list that isn't switched off. */
export function activeTraits(traits: readonly Trait[], disabledTraitIds: readonly string[]): Trait[] {
  const off = new Set(disabledTraitIds);
  return traits.filter((t) => !off.has(t.id));
}

/** The slice the traits in force are read from; a saved or viewed copy fits as well as the live state. */
export interface TraitForceState {
  traits: readonly Trait[];
  disabledTraitIds: readonly string[];
  ownedTraits?: OwnedTraitStates;
  /** Each entity's stat values: a played owner's change on one of its own stats leaves the global stats alone. */
  entityStats?: EntityStatValues;
}

/** The chosen global traits global scope's tree holds right now. A trait gated only on the played persona
 *  itself leaves the tree under that persona, and stays chosen for a return to another. Without a global
 *  tree every chosen trait is held. */
export function heldGlobalTraits(traits: readonly Trait[], world: TraitWorld): Trait[] {
  if (!world.global) return [...traits];
  const held = new Set(world.global.traits.map((t) => t.id));
  return traits.filter((t) => held.has(t.id));
}

/** The traits in force in two parts: the global part holds the active held global traits; each entity
 *  owner's part holds its active traits, owned or linked, in its tree order. A played entity's traits sit only
 *  under its own id, and every played id has a part. */
export function traitForceScope(state: TraitForceState, world: TraitWorld): Scoped<Trait[]> & { played: readonly string[] } {
  const active = activeOwnedTraitIds(state.ownedTraits ?? {});
  const played = world.persona ? playedEntityIds(world.persona, world.entities) : [];
  const owners: Record<string, Trait[]> = Object.fromEntries(played.map((id) => [id, []]));
  for (const owner of entityOwners(world)) {
    const on = new Set(active[owner.id] ?? []);
    owners[owner.id] = owner.traits.filter((t) => on.has(t.id));
  }
  return { global: heldGlobalTraits(activeTraits(state.traits, state.disabledTraitIds), world), owners, played };
}

/** Whether `ownerId` is a played entity owner: the played persona, or the Custom Persona entity under None
 *  and a library persona. False with no persona or no owners. */
const isPlayedOwner = (world: TraitWorld, ownerId: string): boolean =>
  !!world.persona && !!world.owners?.some((o) => o.id === ownerId)
  && playedEntityIds(world.persona, world.entities).includes(ownerId);

/** The ids of the stats `ownerId` owns in play. */
const ownStatIds = (state: Pick<TraitForceState, 'entityStats'>, ownerId: string): ReadonlySet<string> =>
  new Set((state.entityStats?.[ownerId] ?? []).map((s) => s.id));

/** The trait with only the stat changes and toggles `keep` accepts; the same trait when it accepts all. */
function withStatRows(trait: Trait, keep: (row: StatRow) => boolean): Trait {
  const statChanges = trait.statChanges.filter(keep);
  const statToggles = trait.statToggles?.filter(keep);
  if (statChanges.length === trait.statChanges.length && statToggles?.length === trait.statToggles?.length) return trait;
  return { ...trait, statChanges, ...(statToggles ? { statToggles } : {}) };
}

/** An entity's trait as it acts on global stats: its rows on the entity's own stats left out (Q30). A row
 *  names the entity's own stat by id, else the global stat with that id; the global target forces the latter. */
const withoutOwnStatRows = (trait: Trait, own: ReadonlySet<string>): Trait =>
  withStatRows(trait, (row) => row.target === 'global' || !own.has(row.statId));

/** An owner's trait as it acts on the owner's own stats: its rows with the global target left out. */
const withoutGlobalRows = (trait: Trait): Trait => withStatRows(trait, (row) => row.target !== 'global');

/** Each entity owner's active traits that change global stats, owned or linked, with the owner that holds
 *  them, played or not (Q18). A trait that two owners hold shows once per owner (Q17). */
function globalRowTraitsByOwner(state: Pick<TraitForceState, 'ownedTraits' | 'entityStats'>, world: TraitWorld): [string, Trait][] {
  const active = activeOwnedTraitIds(state.ownedTraits ?? {});
  return entityOwners(world).flatMap((owner) => {
    const on = new Set(active[owner.id] ?? []);
    const own = ownStatIds(state, owner.id);
    return owner.traits.filter((t) => on.has(t.id)).map((t) => withoutOwnStatRows(t, own))
      .filter(hasStatEffects).map((t): [string, Trait] => [owner.id, t]);
  });
}

/** The active entity traits that change global stats, each cut to the rows that reach them: every entity's,
 *  played or not. Empty under a world with no owners. */
export const globalRowTraits = (state: Pick<TraitForceState, 'ownedTraits' | 'entityStats'>, world: TraitWorld): Trait[] =>
  globalRowTraitsByOwner(state, world).map(([, t]) => t);

/** Every trait whose stat effects are in force on global stats: the held global traits, then every entity's
 *  active traits cut to their global rows. Bounds derive from this set, and so do stat toggles. */
export function statTraitsInForce(state: TraitForceState, world: TraitWorld): Trait[] {
  return [...heldGlobalTraits(activeTraits(state.traits, state.disabledTraitIds), world), ...globalRowTraits(state, world)];
}

/** Each owner's traits among its `active` ids that change its own stats, in its tree order; none for an owner
 *  with no tree. */
export function treeStatTraits(
  trees: readonly Pick<GateOwner, 'id' | 'traits'>[], active: Readonly<Record<string, readonly string[]>>,
): (ownerId: string) => Trait[] {
  const byId = new Map(trees.map((tree) => [tree.id, tree]));
  return (ownerId) => {
    const on = new Set(active[ownerId] ?? []);
    return (byId.get(ownerId)?.traits ?? []).flatMap((t) => (on.has(t.id) ? [withoutGlobalRows(t)] : [])).filter(hasStatEffects);
  };
}

/** An entity owner's active traits that change stats, owned or linked, in its tree order. None for an
 *  entity that isn't an owner in play. */
export const entityStatTraitsInForce = (ownedTraits: OwnedTraitStates | undefined, world: TraitWorld, ownerId: string): Trait[] =>
  treeStatTraits(entityOwners(world), activeOwnedTraitIds(ownedTraits ?? {}))(ownerId);

/** The stat traits in force for one scope's stats: global scope's are {@link statTraitsInForce}; an entity's
 *  are its own. A change on a stat the owner lacks finds nothing to move. */
export const ownerStatTraitsInForce = (state: TraitForceState, world: TraitWorld, ownerId: OwnerId): Trait[] =>
  (ownerId === null ? statTraitsInForce(state, world) : entityStatTraitsInForce(state.ownedTraits, world, ownerId));

/** Each stat trait in force with its record key, so two worlds' sets compare by what the record is under. */
const keyedStatTraits = (state: TraitForceState, world: TraitWorld): [string, Trait][] => [
  ...heldGlobalTraits(activeTraits(state.traits, state.disabledTraitIds), world).map((t): [string, Trait] => [t.id, t]),
  ...globalRowTraitsByOwner(state, world).map(([ownerId, t]): [string, Trait] => [recordKey(ownerId, t.id), t]),
];

/** Summed trait contributions to one stat, per axis. */
function traitContributions(statId: string, traits: readonly Trait[]) {
  let min = 0;
  let max = 0;
  let regen = 0;
  for (const trait of traits) {
    for (const change of trait.statChanges ?? []) {
      if (change.statId !== statId) continue;
      if (change.type === 'min') min += change.value;
      else if (change.type === 'max') max += change.value;
      else if (change.type === 'regen') regen += change.value;
    }
  }
  return { min, max, regen };
}

/** A stat's authored bases, falling back to its live bounds for a stat that has never carried them. */
function bases(stat: PlayerStat) {
  return {
    min: stat.baseMin ?? stat.min,
    max: stat.baseMax ?? stat.max,
    regen: stat.baseRegen ?? stat.regen ?? 0,
  };
}

const CODE_BOUND_KEYS = ['min', 'max', 'regen'] as const satisfies readonly (keyof CodeBoundDeltas)[];

/** A stat's bounds from every layer under code, before any floor. A code delta is measured against these. */
function boundsUnderCode(stat: PlayerStat, active: readonly Trait[]): Required<CodeBoundDeltas> {
  const base = bases(stat);
  const contrib = traitContributions(stat.id, active);
  return {
    min: base.min + contrib.min,
    max: base.max + contrib.max + (stat.aiMaxDelta ?? 0),
    regen: base.regen + contrib.regen,
  };
}

/**
 * Recompute every stat's min, max and regen from its bases, the active traits, the accumulated AI max delta
 * and the code delta. Values are untouched — this is bounds only. The min is floored at the authored base
 * min, traits and code together, so no layer digs below the author's floor; the max is floored at that min
 * so no layer can invert the range. An older save's stored code bound, until the load settle books it as a
 * delta, replaces its field outright, as that save read it.
 */
export function deriveEffectiveStats(stats: PlayerStat[], active: readonly Trait[]): PlayerStat[] {
  return stats.map((stat) => {
    const under = boundsUnderCode(stat, active);
    const code = stat.codeDelta;
    // A live stat never carries the key; one loaded from an older save does until the settle runs.
    const stored = (stat as LegacyCodeBoundsStat).codeBounds;
    const min = stored?.min ?? Math.max(bases(stat).min, under.min + (code?.min ?? 0));
    const max = Math.max(min, stored?.max ?? under.max + (code?.max ?? 0));
    const regen = stored?.regen ?? under.regen + (code?.regen ?? 0);
    if (min === stat.min && max === stat.max && regen === (stat.regen ?? 0)) return stat;
    return { ...stat, min, max, regen };
  });
}

/** The code delta that makes each written bound `stat`'s bound under `active`; unwritten fields keep theirs. */
export function codeDeltaFor(stat: PlayerStat, written: CodeBounds, active: readonly Trait[]): CodeBoundDeltas {
  const under = boundsUnderCode(stat, active);
  const next: CodeBoundDeltas = { ...stat.codeDelta };
  for (const field of CODE_BOUND_KEYS) {
    const bound = written[field];
    if (bound === undefined) continue;
    if (bound === under[field]) delete next[field];
    else next[field] = bound - under[field];
  }
  return next;
}

/** Whether two code deltas move every bound by the same amount. */
export const sameCodeDelta = (a: CodeBoundDeltas = {}, b: CodeBoundDeltas = {}): boolean =>
  CODE_BOUND_KEYS.every((field) => (a[field] ?? 0) === (b[field] ?? 0));

/** Whether two stats agree on being hidden, an absent flag reading as shown. */
export const sameHidden = (a: Pick<PlayerStat, 'hidden'>, b: Pick<PlayerStat, 'hidden'>): boolean => (a.hidden === true) === (b.hidden === true);

/** `stat` carrying exactly `codeDelta`, re-derived under `active`, with `value` clamped in. */
export function withCodeDelta(
  stat: PlayerStat,
  codeDelta: CodeBoundDeltas | undefined,
  value: number,
  active: readonly Trait[],
): PlayerStat {
  const { codeDelta: _replaced, ...rest } = stat;
  const next: PlayerStat = codeDelta && Object.keys(codeDelta).length ? { ...rest, value, codeDelta } : { ...rest, value };
  const [derived] = deriveEffectiveStats([next], active);
  return { ...derived, value: clamp(derived.value, derived.min, derived.max) };
}

/**
 * Turn the code bounds an older save stored on its global stats into code deltas, under the global stat
 * traits in force: each delta is the stored bound minus the bound every other layer derives. The effective
 * bounds stay as they were, except a stored min below the authored min, which rises to it. A stat without
 * stored bounds is the same object, so a second pass changes nothing.
 */
export function codeBoundsToDeltas(stats: readonly LegacyCodeBoundsStat[], active: readonly Trait[]): PlayerStat[] {
  return stats.map((stat) => {
    if (!('codeBounds' in stat)) return stat;
    const { codeBounds = {}, codeDelta: _none, ...rest } = stat;
    const codeDelta = codeDeltaFor(rest, codeBounds, active);
    return Object.keys(codeDelta).length ? { ...rest, codeDelta } : rest;
  });
}

/**
 * The stats a fresh playthrough opens with, before any trait: the authored defaults, each with its live
 * value and its game-start baseline (`starting`) set to that value, so the opening turn shows no change
 * the author did not make (Q8). Authored, chips and all — names resolve on the way out of state, never in.
 */
export function seedNewGameStats(authored: readonly Stat[]): PlayerStat[] {
  return seedStatBases(authored.map((stat) => {
    const value = statStartValue(stat);
    return { ...stat, value, starting: value };
  }));
}

/** The stats a fresh playthrough holds once the held picks among `chosenInOrder` have applied, then the
 *  entities' global rows among `owned` — the fold Enter World runs, for a picker that needs the numbers
 *  before the game exists. `entityStats` holds each entity's seeded own stats, so a row whose id an entity
 *  owns stays off the global stat (Q30). */
export function startingStatsWith(
  authored: readonly Stat[], chosenInOrder: readonly Trait[], world: TraitWorld, owned: OwnedTraitPicks = {},
  entityStats: EntityStatValues = {},
): PlayerStat[] {
  let state: TraitRuntimeState = { stats: seedNewGameStats(authored), traits: [], disabledTraitIds: [], appliedValues: {} };
  for (const trait of heldGlobalTraits(chosenInOrder, world)) state = acquireTrait(state, trait, world).state;
  return applyGlobalRowTraits({ ...state, ownedTraits: ownedTraitStatesFrom(owned), entityStats }, world).state.stats;
}

/** Seed a fresh playthrough's bases from the authored bounds. */
export function seedStatBases(stats: PlayerStat[]): PlayerStat[] {
  return stats.map((stat) => ({
    ...stat,
    baseMin: stat.min,
    baseMax: stat.max,
    baseRegen: stat.regen ?? 0,
    aiMaxDelta: 0,
  }));
}

/**
 * Recover the authored bases of a save written before bounds were derived. Deriving from the result
 * reproduces the saved numbers exactly, so loading an older save never rebalances a character. Stats that
 * already carry bases are left alone, which makes this safe to run on every load.
 *
 * The world is the authority on the max: it holds the authored number outright, where the save holds it
 * tangled with whatever the AI moved the cap by and no way to tell the two apart. Taking the world's number
 * and booking the remainder as AI movement recovers the author's design and keeps the player's earned cap.
 * The trade is that an authored max the author has *changed* since the save is read as movement too, so that
 * save keeps the cap it was playing with rather than adopting the edit. Min and regen have no AI mover, so
 * subtracting the active traits' contributions from the saved bounds recovers them exactly; a stat the world
 * no longer authors falls back to that for the max as well.
 */
export function recoverStatBases(
  stats: PlayerStat[],
  active: readonly Trait[],
  authored: readonly Pick<Stat, 'id' | 'max'>[] = [],
): PlayerStat[] {
  const authoredMax = new Map(authored.map((s) => [s.id, s.max]));
  return stats.map((stat) => {
    if (stat.baseMax !== undefined) return stat;
    const contrib = traitContributions(stat.id, active);
    const world = authoredMax.get(stat.id);
    const baseMax = world ?? stat.max - contrib.max;
    return {
      ...stat,
      baseMin: stat.min - Math.max(0, contrib.min),
      baseMax,
      baseRegen: (stat.regen ?? 0) - contrib.regen,
      aiMaxDelta: stat.max - baseMax - contrib.max,
    };
  });
}

/** Summed 'starting' deltas per stat id — accumulated before any clamp, so two changes on one stat give the
 *  same result whichever order the author wrote them in. A change with no type names no facet, so like the
 *  bounds it contributes nothing. */
function valueDeltas(changes: readonly StatChange[] | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const change of changes ?? []) {
    if (change.type !== 'starting') continue;
    out.set(change.statId, (out.get(change.statId) ?? 0) + change.value);
  }
  return out;
}

/**
 * Settle values against freshly derived bounds: the requested delta lands and the result is clamped once
 * into the new range.
 *
 * `followCap` is on only when authored changes are being applied: a stat resting exactly on its cap rides
 * that cap upward, which is what makes a max-raising trait feel like it grants the points. Reversing a
 * recorded movement never follows — the record already describes the whole movement, cap clamp included, so
 * following as well would hand the same points back twice.
 */
function settleValues(
  before: readonly PlayerStat[],
  derived: PlayerStat[],
  deltas: Map<string, number>,
  followCap: boolean,
): PlayerStat[] {
  return derived.map((stat, i) => {
    const prev = before[i];
    let value = prev.value;
    if (followCap && stat.max > prev.max && prev.value === prev.max) value = stat.max;
    value += deltas.get(stat.id) ?? 0;
    value = clamp(value, stat.min, stat.max);
    if (value === prev.value && stat === before[i]) return stat;
    return { ...stat, value };
  });
}

/** The negation of a set of movements, as the delta map `settleValues` takes. */
function negated(movements: Iterable<[string, number]>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [statId, delta] of movements) out.set(statId, -delta);
  return out;
}

/** What actually moved between two same-ordered stat arrays, keyed by stat id, omitting the unmoved. */
function movement(before: readonly PlayerStat[], after: readonly PlayerStat[]): Record<string, number> {
  const out: Record<string, number> = {};
  after.forEach((stat, i) => {
    const delta = stat.value - (before[i]?.value ?? stat.value);
    if (delta !== 0) out[stat.id] = delta;
  });
  return out;
}

function withDisabled(ids: readonly string[], add: string | null, remove: string | null): string[] {
  const set = new Set(ids);
  if (add !== null) set.add(add);
  if (remove !== null) set.delete(remove);
  return [...set];
}

/**
 * Settle the stats around one switch of an owner's trait, its lists already moved. `active` is every stat
 * trait in force after the switch, which the bounds derive from.
 *
 * The record under `key` is the movement the trait's *last* switch produced, so every transition is the
 * reverse of the one before it and a trait can go back and forth forever without gaining or losing a point.
 * That is what folds a clamp into the reversal: a switch-off that a shrinking cap forced further down than
 * the record asked records the larger movement, and the switch back on restores all of it.
 *
 * The exception is the first switch-on, and a trait acquired by a save that carries no record for it. Those have
 * nothing to reverse, so the authored changes apply — for a switch-off that means negating them, which a
 * bound can swallow and ratchet, for that one trait. That switch records properly, so a save without records
 * heals itself the first time the player touches the trait.
 */
function settleSwitch(
  stats: PlayerStat[], record: Record<string, number> | undefined, trait: Trait, on: boolean, active: readonly Trait[],
): { stats: PlayerStat[]; record: Record<string, number> } {
  const derived = deriveEffectiveStats(stats, active);
  const reversing = record !== undefined;
  const deltas = reversing
    ? negated(Object.entries(record))
    : on
      ? valueDeltas(trait.statChanges)
      : negated(valueDeltas(trait.statChanges));
  const next = settleValues(stats, derived, deltas, !reversing && on);
  // Recorded even when nothing moved: an empty record is the statement "this switch moved nothing", which is
  // exactly what stops a bound-swallowed penalty from paying out on the way off. Absent means unrecorded.
  return { stats: next, record: movement(stats, next) };
}

/** {@link settleSwitch} on the player's stats, recorded under `key`. */
function moveStats(state: TraitRuntimeState, trait: Trait, on: boolean, key: string, active: readonly Trait[]): TraitRuntimeState {
  const moved = settleSwitch(state.stats, state.appliedValues[key], trait, on, active);
  return { ...state, stats: moved.stats, appliedValues: { ...state.appliedValues, [key]: moved.record } };
}

/** Whether any of the trait's stat changes names one of `stats`. */
const changesAny = (trait: Trait, stats: readonly PlayerStat[]): boolean =>
  trait.statChanges.some((change) => stats.some((s) => s.id === change.statId));

/** {@link settleSwitch} on an entity's own stats, its lists already moved; the same state when the entity
 *  holds no stats, or the trait changes none of them and has nothing to reverse. */
function moveOwnStats(state: TraitRuntimeState, ownerId: string, ownerTrait: Trait, on: boolean, world: TraitWorld): TraitRuntimeState {
  const trait = withoutGlobalRows(ownerTrait);
  const stats = state.entityStats?.[ownerId];
  const key = ownStatsRecordKey(ownerId, trait.id);
  const record = state.appliedValues[key];
  if (!stats || (record === undefined && !changesAny(trait, stats))) return state;
  const moved = settleSwitch(stats, record, trait, on, entityStatTraitsInForce(state.ownedTraits, world, ownerId));
  return {
    ...state,
    entityStats: { ...state.entityStats, [ownerId]: moved.stats },
    appliedValues: { ...state.appliedValues, [key]: moved.record },
  };
}

/** Move a trait's switch in its scope's lists and settle the stats around it: a global trait in the
 *  disabled list, an entity's in its owned lists. */
function switchTrait(state: TraitRuntimeState, trait: Trait, on: boolean, world: TraitWorld, ownerId: OwnerId = null): TraitRuntimeState {
  const listed = ownerId === null
    ? { ...state, disabledTraitIds: withDisabled(state.disabledTraitIds, on ? null : trait.id, on ? trait.id : null) }
    : withOwnedSwitch(state, ownerId, trait.id, on);
  return moveStats(listed, trait, on, recordKey(ownerId, trait.id), statTraitsInForce(listed, world));
}

/** Switch an owner's trait in its lists and move the stats it changes: the world's traits and any entity
 *  owner's global rows move global stats, and an entity's own rows move its own stats. */
function flipOwnerTrait(state: TraitRuntimeState, ownerId: OwnerId, trait: Trait, on: boolean, world: TraitWorld): TraitRuntimeState {
  if (ownerId === null) return switchTrait(state, trait, on, world);
  const globalRows = withoutOwnStatRows(trait, ownStatIds(state, ownerId));
  const switched = hasStatEffects(globalRows)
    ? switchTrait(state, globalRows, on, world, ownerId)
    : withOwnedSwitch(state, ownerId, trait.id, on);
  return moveOwnStats(switched, ownerId, trait, on, world);
}

/**
 * Apply every entity's active traits' global rows, owner by owner in tree order, as picking them at creation
 * would. For a new game and the Enter World preview, whose owned picks are already chosen. `applied` is the
 * played entities' traits alone: the start log never names another entity's. `appliedRows` pairs each with its owner.
 */
export function applyGlobalRowTraits(
  state: TraitRuntimeState, world: TraitWorld,
): { state: TraitRuntimeState; applied: Trait[]; appliedRows: { trait: Trait; ownerId: string }[] } {
  const rows = globalRowTraitsByOwner(state, world);
  let next = state;
  const on: Trait[] = [];
  for (const [ownerId, trait] of rows) {
    on.push(trait);
    next = moveStats(next, trait, true, recordKey(ownerId, trait.id), [...activeTraits(next.traits, next.disabledTraitIds), ...on]);
  }
  const appliedRows = rows.filter(([ownerId]) => isPlayedOwner(world, ownerId)).map(([ownerId, trait]) => ({ trait, ownerId }));
  return { state: next, applied: appliedRows.map((row) => row.trait), appliedRows };
}

/**
 * Apply each entity owner's traits in force to its own stats, owner by owner in tree order, as creation
 * picks apply for the player. For a new game, whose entity stats are freshly seeded.
 */
export function applyOwnedStatTraits(state: TraitRuntimeState, world: TraitWorld): TraitRuntimeState {
  let next = state;
  for (const owner of entityOwners(world)) {
    let stats = next.entityStats?.[owner.id];
    if (!stats) continue;
    const records: AppliedTraitValues = {};
    const on: Trait[] = [];
    for (const trait of entityStatTraitsInForce(next.ownedTraits, world, owner.id)) {
      on.push(trait);
      if (!changesAny(trait, stats)) continue;
      const moved = settleSwitch(stats, undefined, trait, true, on);
      stats = moved.stats;
      records[ownStatsRecordKey(owner.id, trait.id)] = moved.record;
    }
    if (!Object.keys(records).length) continue;
    next = { ...next, entityStats: { ...next.entityStats, [owner.id]: stats }, appliedValues: { ...next.appliedValues, ...records } };
  }
  return next;
}

/**
 * The stat side of a persona switch during the game: every stat trait in force under the old persona and not the
 * new one reverses through its record, then every one in force only under the new persona applies, each
 * logged as a switch. That covers the Custom Persona picks a world persona leaves dormant and the owners
 * that join or leave the world with the persona; an entity's global rows stay put. The lists themselves do not move, so a return to a persona the playthrough still holds
 * finds its picks. Nothing moves when both name the same persona.
 */
export function switchPersonaStats(
  state: TraitRuntimeState,
  from: TraitWorld,
  to: TraitWorld,
  nameOf: (trait: Trait) => string = (trait) => trait.name,
): { state: TraitRuntimeState; log: string[] } {
  const before = keyedStatTraits(state, from);
  const after = keyedStatTraits(state, to);
  const afterKeys = new Set(after.map(([key]) => key));
  const beforeKeys = new Set(before.map(([key]) => key));
  const off = before.filter(([key]) => !afterKeys.has(key));
  const on = after.filter(([key]) => !beforeKeys.has(key));
  if (!off.length && !on.length) return { state, log: [] };
  // The set in force moves one trait at a time, so each record measures its own switch alone.
  const inForce = new Map(before);
  let next = state;
  const log: string[] = [];
  for (const [key, trait] of off) {
    inForce.delete(key);
    next = moveStats(next, trait, false, key, [...inForce.values()]);
    if (!isHidden(trait)) log.push(...traitSwitchLog(nameOf(trait), 'off', []));
  }
  for (const [key, trait] of on) {
    inForce.set(key, trait);
    next = moveStats(next, trait, true, key, [...inForce.values()]);
    if (!isHidden(trait)) log.push(...traitSwitchLog(nameOf(trait), 'on', []));
  }
  return { state: next, log };
}

/**
 * First switch-on of a trait the player has not acquired yet. Identical to choosing it at creation: the trait
 * joins the list with its stat changes frozen as the world defines them right now, and they apply.
 */
export function acquireTrait(
  state: TraitRuntimeState,
  trait: Trait,
  world: TraitWorld,
): { state: TraitRuntimeState; retired: Trait[] } {
  if (state.traits.some((t) => t.id === trait.id)) {
    return setTraitEnabled(state, trait.id, true, world);
  }
  const withTrait: TraitRuntimeState = { ...state, traits: [...state.traits, trait] };
  return setTraitEnabled(withTrait, trait.id, true, world);
}

/**
 * Switch an acquired trait on or off. Switching one on retires its active exclusive siblings first, each reversed
 * exactly as an explicit switch-off would be. A group may be left with nothing active.
 *
 * `retired` names the siblings that were switched off, for the caller's log.
 */
export function setTraitEnabled(
  state: TraitRuntimeState,
  traitId: string,
  enabled: boolean,
  world: TraitWorld,
): { state: TraitRuntimeState; retired: Trait[] } {
  const trait = state.traits.find((t) => t.id === traitId);
  if (!trait) return { state, retired: [] };
  if (!enabled) return { state: switchTrait(state, trait, false, world), retired: [] };

  const siblingIds = new Set(exclusiveSiblings(trait, world.traits, world.groups));
  const retired = activeTraits(state.traits, state.disabledTraitIds).filter(
    (t) => t.id !== traitId && siblingIds.has(t.id),
  );
  let next = state;
  for (const sibling of retired) next = switchTrait(next, sibling, false, world);
  return { state: switchTrait(next, trait, true, world), retired };
}

/** What one switch did to its trait, for the log. */
export type TraitSwitchKind = 'on' | 'off' | 'acquired';

/** The turn log lines for one switch: each retired sibling, then the switch. `by` names the stat whose code
 *  made it; the player's own switch has none. */
export function traitSwitchLog(name: string, kind: TraitSwitchKind, retired: readonly string[], by?: string): string[] {
  const from = by === undefined ? '' : ` (by ${by})`;
  return [
    ...retired.map((sibling) => `Trait switched off: ${sibling}${from}`),
    kind === 'acquired' ? `Acquired trait: ${name}${from}` : `Trait switched ${kind}: ${name}${from}`,
  ];
}

/** The turn log lines for the traits a new game starts with. A Hidden trait moves unseen. */
export const startingTraitLog = (traits: readonly Trait[], nameOf: (trait: Trait) => string): string[] =>
  traits.filter((trait) => !isHidden(trait)).map((trait) => `Applied trait: ${nameOf(trait)}`);

/** One trait switch a stat's code made. `by` is that stat's name. */
export interface CodeTraitSwitch {
  traitId: string;
  enabled: boolean;
  by: string;
  /** The entity owner whose own trait this switches. Absent ⇒ a global trait. */
  ownerId?: string;
}

/** One trait whose on state changed: what fires When a Trait Switches. Null `ownerId` ⇒ a global trait. */
export interface TraitSwitchEvent {
  traitId: string;
  ownerId: OwnerId;
  enabled: boolean;
}

/** The traits whose in-force state differs from `before` under `beforeWorld` to `after` under `world`: offs
 *  first, then ons, each in owner order, global first. A trait leaving the tree switches off, so a persona
 *  change can switch one. A trait that switched and switched back in between is no event (Q47). */
export function traitSwitchEvents(
  before: TraitForceState, after: TraitForceState, world: TraitWorld, beforeWorld: TraitWorld = world,
): TraitSwitchEvent[] {
  const onIds = (state: TraitForceState, at: TraitWorld) => mapScoped(traitForceScope(state, at), (traits) => traits.map((t) => t.id));
  const was = onIds(before, beforeWorld);
  const now = onIds(after, world);
  const owners: OwnerId[] = [null, ...new Set([...Object.keys(now.owners), ...Object.keys(was.owners)])];
  const moved = (enabled: boolean): TraitSwitchEvent[] => owners.flatMap((ownerId) => {
    const from = new Set(partOf(enabled ? was : now, ownerId) ?? []);
    return (partOf(enabled ? now : was, ownerId) ?? [])
      .filter((traitId) => !from.has(traitId))
      .map((traitId) => ({ traitId, ownerId, enabled }));
  });
  return [...moved(false), ...moved(true)];
}

/** One owner's stats as a stat Condition reads them; a stat the traits in force switch off is inert. */
function ownerGateStats(stats: readonly PlayerStat[], inForce: readonly Trait[]): Record<string, GateStat> {
  const enabled = activeStatEnabled(stats, inForce);
  return Object.fromEntries(stats.map((s): [string, GateStat] => [s.id, {
    name: s.name, value: s.value, min: s.min, max: s.max,
    ...(enabled[s.id] === false ? { inert: true } : {}),
    ...(s.hidden ? { hidden: true } : {}),
  }]));
}

/** The slice the gates' stats are read from. */
export type GateStatState = TraitForceState & { stats: readonly PlayerStat[] };

/** Every live stat as gates read it: the global stats, and each entity's under its id, on their effective
 *  bounds. */
export function gateStatsOf(state: GateStatState, world: TraitWorld): GateStats {
  return scoped(
    ownerGateStats(state.stats, statTraitsInForce(state, world)),
    Object.fromEntries(Object.entries(state.entityStats ?? {}).map(([ownerId, stats]) =>
      [ownerId, ownerGateStats(stats, entityStatTraitsInForce(state.ownedTraits, world, ownerId))])),
  );
}

/** Every scope's traits, active set and stats, as the gate module reads them. */
export const traitGateInput = (state: GateStatState, world: TraitWorld): GateInput => ({
  global: world.global ?? offeredWorldTraits(world.traits, world.groups),
  owners: world.owners ?? [],
  active: scoped(
    heldGlobalTraits(activeTraits(state.traits, state.disabledTraitIds), world).map((t) => t.id),
    activeOwnedTraitIds(state.ownedTraits ?? {}),
  ),
  stats: world.gateStats ?? gateStatsOf(state, world),
  ...(world.daypart ? { daypart: world.daypart } : {}),
  entities: world.entities ?? [],
  persona: world.persona ?? { source: 'none' },
  originals: { traits: world.traits, groups: world.groups },
  reader: 'player',
});

/** Every owner's gate on each of its traits, for one read of the state. */
export const traitGates = (state: GateStatState, world: TraitWorld): GateStates => gateStates(traitGateInput(state, world));

/** Whether the owner's requirements on a trait hold in `gates`. A trait with no gate state is open. */
export const traitUnlocked = (gates: GateStates, ownerId: OwnerId, traitId: string): boolean =>
  gateOf(gates, ownerId, traitId)?.unlocked !== false;

const isLocked = (state: TraitRuntimeState, world: TraitWorld, ownerId: OwnerId, traitId: string): boolean =>
  !traitUnlocked(traitGates(state, world), ownerId, traitId);

/** Whether the gate module refuses the player's switch-on: the trait is locked, its group is full, or the
 *  mode refuses it. */
const refusesOn = (state: TraitRuntimeState, world: TraitWorld, ownerId: OwnerId, traitId: string): boolean => {
  const input = traitGateInput(state, world);
  return gateOf(gateStates(input), ownerId, traitId)?.unlocked === false || overfills(input, ownerId, traitId)
    || modeRefuses(input, ownerId, traitId);
};

/** Whether the gate module refuses the player's switch-off: its group would end below the minimum, or the
 *  mode refuses it. */
const refusesOff = (state: TraitRuntimeState, world: TraitWorld, ownerId: OwnerId, traitId: string): boolean => {
  const input = traitGateInput(state, world);
  return underfills(input, ownerId, traitId) || modeRefuses(input, ownerId, traitId);
};

/** Every entity owner in play. */
const entityOwners = (world: TraitWorld): readonly GateOwner[] => world.owners ?? [];

/** Whether global scope's tree offers `traitId`. */
const globalHolds = (world: TraitWorld, traitId: string): boolean =>
  (world.global?.traits ?? world.traits).some((t) => t.id === traitId);

/** The lists with every empty one dropped, so an empty list and an absent one read the same. */
export function compactCascadeOff(lists: Partial<Scoped<readonly string[]>> = {}): CascadeOffTraitIds {
  const owners = Object.fromEntries(Object.entries(lists.owners ?? {}).filter(([, ids]) => ids.length).map(([owner, ids]) => [owner, [...ids]]));
  return {
    ...(lists.global?.length ? { global: [...lists.global] } : {}),
    ...(Object.keys(owners).length ? { owners } : {}),
  };
}

/** The cascade-off lists as the gate module reads them. */
export const cascadeOffInput = (lists: CascadeOffTraitIds | undefined): Scoped<string[]> =>
  scoped(lists?.global ?? [], lists?.owners ?? {});

const sameIds = (a: readonly string[] = [], b: readonly string[] = []) => a.length === b.length && a.every((id, i) => b[i] === id);

function sameCascadeOff(a: CascadeOffTraitIds, b: CascadeOffTraitIds): boolean {
  const owners = Object.keys(a.owners ?? {});
  return sameIds(a.global, b.global) && owners.length === Object.keys(b.owners ?? {}).length
    && owners.every((owner) => sameIds(a.owners?.[owner], b.owners?.[owner]));
}

/** `state` with `traitId` off its cascade-off lists, so it never returns; the same state when it was not
 *  listed. With `ownerId`, only that scope's list. */
function withoutCascadeOff(state: TraitRuntimeState, traitId: string, ownerId?: OwnerId): TraitRuntimeState {
  const lists = cascadeOffInput(state.cascadeOffTraitIds);
  const inScope = (owner: OwnerId) => ownerId === undefined || owner === ownerId;
  if (!scopedEntries(lists).some(([owner, ids]) => inScope(owner) && ids.includes(traitId))) return state;
  const next = mapScoped(lists, (ids, owner) => (inScope(owner) ? ids.filter((id) => id !== traitId) : ids));
  return { ...state, cascadeOffTraitIds: compactCascadeOff(next) };
}

/** The cascade-off lists after a settle: its global list, and each owner's from it over `previous`, so an
 *  owner the settle did not cover keeps its list. */
export const settledCascadeOff = (previous: CascadeOffTraitIds | undefined, settled: Scoped<string[]>): CascadeOffTraitIds =>
  ({ global: settled.global, owners: { ...previous?.owners, ...settled.owners } });

/** An owner's trait: the owner and the trait itself. Without `ownerId`, the first owner that holds it. */
function ownedTrait(world: TraitWorld, traitId: string, ownerId?: string): { owner: GateOwner; trait: Trait } | null {
  for (const owner of entityOwners(world)) {
    if (ownerId !== undefined && owner.id !== ownerId) continue;
    const trait = owner.traits.find((t) => t.id === traitId);
    if (trait) return { owner, trait };
  }
  return null;
}

const ownedOn = (state: TraitRuntimeState, ownerId: string, traitId: string): boolean => {
  const owned = state.ownedTraits?.[ownerId];
  return !!owned?.chosen.includes(traitId) && !owned.disabled?.includes(traitId);
};

/** `state` with one owned trait switched: on joins the chosen list and leaves the switched-off one. */
function withOwnedSwitch(state: TraitRuntimeState, ownerId: string, traitId: string, on: boolean): TraitRuntimeState {
  const current = state.ownedTraits?.[ownerId] ?? { chosen: [] };
  const chosen = on && !current.chosen.includes(traitId) ? [...current.chosen, traitId] : current.chosen;
  const disabled = withDisabled(current.disabled ?? [], on ? null : traitId, on ? traitId : null);
  return {
    ...state,
    ownedTraits: { ...state.ownedTraits, [ownerId]: { chosen, ...(disabled.length ? { disabled } : {}) } },
  };
}

/** A trait as the log and the banner name it: an NPC's owned trait carries its owner's name. Global traits
 *  and a played entity owner's read bare. */
function labeler(world: TraitWorld, nameOf: (trait: Trait) => string) {
  const owners = new Map(entityOwners(world).map((o) => [o.id, o]));
  return (trait: Trait, ownerId: OwnerId): string => {
    const owner = ownerId === null || isPlayedOwner(world, ownerId) ? undefined : owners.get(ownerId);
    return owner ? `${owner.name}'s ${nameOf(trait)}` : nameOf(trait);
  };
}

/** A world or owned trait as the log and the banner name it, found by id, in `ownerId`'s tree when given. */
export function traitNameIn(world: TraitWorld, traitId: string, nameOf: (trait: Trait) => string, ownerId?: OwnerId): string | null {
  const owned = ownerId === null ? null : ownedTrait(world, traitId, ownerId);
  if (owned) return labeler(world, nameOf)(owned.trait, owned.owner.id);
  const trait = world.traits.find((t) => t.id === traitId);
  return trait ? nameOf(trait) : null;
}

/** What a settle or a gated switch did. `cascade` holds the traits a cascade turned off, and `cascadeNames`
 *  their names as the banner reads them. */
export interface GatedTraitResult {
  state: TraitRuntimeState;
  log: string[];
  cascade: Trait[];
  cascadeNames: string[];
}

/**
 * Settle every owner's traits against every gate: traits whose gate stopped holding switch off, dependents
 * first, each world trait reversed through its record; traits a cascade turned off switch back on once
 * their gate holds again. An Always On world trait the player lacks is acquired as it turns on. The same
 * state comes back when nothing moves.
 */
export function settleTraits(
  state: TraitRuntimeState,
  world: TraitWorld,
  nameOf: (trait: Trait) => string = (trait) => trait.name,
  by?: string,
): GatedTraitResult {
  const result = settle(traitGateInput(state, world), cascadeOffInput(state.cascadeOffTraitIds));
  const held = (refs: GateTraitRef[]) => refs.flatMap(({ ownerId, traitId }) => {
    const trait = ownerId === null
      ? state.traits.find((t) => t.id === traitId) ?? world.traits.find((t) => t.id === traitId && isAlwaysOn(t))
      : ownedTrait(world, traitId, ownerId)?.trait;
    return trait ? [{ ownerId, trait }] : [];
  });
  const off = held(result.turnedOff);
  const back = held(result.returned);
  const cascadeOff = compactCascadeOff(settledCascadeOff(state.cascadeOffTraitIds, result.cascadeOff));
  if (!off.length && !back.length && sameCascadeOff(cascadeOff, compactCascadeOff(state.cascadeOffTraitIds))) {
    return { state, log: [], cascade: [], cascadeNames: [] };
  }
  let next = state;
  for (const { ownerId, trait } of off) next = flipOwnerTrait(next, ownerId, trait, false, world);
  for (const { ownerId, trait } of back) {
    if (ownerId === null && !next.traits.some((t) => t.id === trait.id)) next = { ...next, traits: [...next.traits, trait] };
    next = flipOwnerTrait(next, ownerId, trait, true, world);
  }
  const label = labeler(world, nameOf);
  // A Hidden trait moves unseen: no log line, no banner name.
  const cascadeNames = off.filter(({ trait }) => !isHidden(trait)).map(({ ownerId, trait }) => label(trait, ownerId));
  return {
    state: { ...next, cascadeOffTraitIds: cascadeOff },
    log: [
      ...cascadeNames.flatMap((name) => traitSwitchLog(name, 'off', [], by)),
      ...back.filter(({ trait }) => !isHidden(trait)).flatMap(({ ownerId, trait }) => traitSwitchLog(label(trait, ownerId), 'on', [], by)),
    ],
    cascade: off.map(({ trait }) => trait),
    cascadeNames,
  };
}

/**
 * The player's switch of an owner's trait in that entity's lists. The trait moves the entity's own stats and,
 * by its global rows, the global stats, played or not. Switching on retires its active exclusive siblings in
 * the entity's groups.
 */
function switchOwned(
  state: TraitRuntimeState,
  { owner, trait }: { owner: GateOwner; trait: Trait },
  enabled: boolean,
  world: TraitWorld,
  nameOf: (trait: Trait) => string,
): GatedTraitResult | null {
  const chosen = !!state.ownedTraits?.[owner.id]?.chosen.includes(trait.id);
  if (ownedOn(state, owner.id, trait.id) === enabled) return null;
  if (enabled && (refusesOn(state, world, owner.id, trait.id) || (!chosen && !trait.playerToggle))) return null;
  if (!enabled && refusesOff(state, world, owner.id, trait.id)) return null;
  const retired = enabled
    ? exclusiveSiblings(trait, owner.traits, owner.groups)
      .filter((id) => ownedOn(state, owner.id, id))
      .flatMap((id) => owner.traits.filter((t) => t.id === id))
    : [];
  let switched = state;
  for (const sibling of retired) switched = flipOwnerTrait(switched, owner.id, sibling, false, world);
  switched = flipOwnerTrait(switched, owner.id, trait, enabled, world);
  const label = labeler(world, nameOf);
  const kind: TraitSwitchKind = !chosen ? 'acquired' : enabled ? 'on' : 'off';
  const settled = settleTraits(switched, world, nameOf);
  return {
    ...settled,
    log: [...traitSwitchLog(label(trait, owner.id), kind, retired.map((t) => label(t, owner.id))), ...settled.log],
  };
}

/**
 * The player's own switch, then a settle. A switch-on of a trait the player lacks acquires it, and only a
 * trait marked Player Can Toggle can be acquired this way. An entity's owned trait switches the same way,
 * in that entity's lists. `ownerId` names the owner whose row the player switched; without it, the
 * player's own trait wins over an entity that links the same original. Null when the switch does nothing:
 * the trait already holds that state, is locked, cannot be acquired, or the gate module refuses it.
 */
export function switchPlayerTrait(
  state: TraitRuntimeState,
  traitId: string,
  enabled: boolean,
  world: TraitWorld,
  nameOf: (trait: Trait) => string = (trait) => trait.name,
  ownerId?: OwnerId,
): GatedTraitResult | null {
  const acquired = state.traits.find((t) => t.id === traitId);
  const owned = ownerId !== undefined
    ? (ownerId === null ? null : ownedTrait(world, traitId, ownerId))
    : acquired || globalHolds(world, traitId) ? null : ownedTrait(world, traitId);
  if (owned) return switchOwned(state, owned, enabled, world, nameOf);
  if (ownerId != null) return null;
  const trait = acquired ?? world.traits.find((t) => t.id === traitId);
  if (!trait || (!!acquired && !state.disabledTraitIds.includes(traitId)) === enabled) return null;
  if (enabled && (refusesOn(state, world, null, traitId) || (!acquired && !trait.playerToggle))) return null;
  if (!enabled && refusesOff(state, world, null, traitId)) return null;
  const switched = acquired ? setTraitEnabled(state, traitId, enabled, world) : acquireTrait(state, trait, world);
  const kind: TraitSwitchKind = !acquired ? 'acquired' : enabled ? 'on' : 'off';
  const settled = settleTraits(switched.state, world, nameOf);
  return {
    ...settled,
    log: [...traitSwitchLog(nameOf(trait), kind, switched.retired.map(nameOf)), ...settled.log],
  };
}

/**
 * Apply stat code's trait switches in order, each through the player's own switch and a settle. Code ignores
 * Player Can Toggle In Game, so a switch-on of a trait the player lacks acquires it. Code never switches an
 * Always On trait. Code does not ignore gates: a switch-on of a locked trait retires no sibling, and the
 * settle turns it off again. A switch to the state a trait already holds does nothing: switching an off trait
 * off again would reverse its record a second time. It does take a cascade-off trait off its list, so the trait stays off.
 * A switch with an `ownerId` moves that owner's own trait by the same rules, in its own lists.
 */
export function applyCodeTraitSwitches(
  state: TraitRuntimeState,
  switches: readonly CodeTraitSwitch[],
  world: TraitWorld,
  nameOf: (trait: Trait) => string = (trait) => trait.name,
): { state: TraitRuntimeState; log: string[]; logTraits: (string | null)[] } {
  let next = state;
  const log: string[] = [];
  const logTraits: (string | null)[] = [];
  for (const { traitId, enabled, by, ownerId } of switches) {
    if (ownerId !== undefined) {
      const switched = codeSwitchOwned(next, ownerId, traitId, enabled, by, world, nameOf);
      next = switched.state;
      log.push(...switched.log);
      logTraits.push(...switched.logTraits);
      continue;
    }
    const acquired = next.traits.find((t) => t.id === traitId);
    const trait = acquired ?? world.traits.find((t) => t.id === traitId);
    if (!trait || isAlwaysOn(world.traits.find((t) => t.id === traitId) ?? trait)) continue;
    if ((!!acquired && !next.disabledTraitIds.includes(traitId)) === enabled) {
      if (!enabled) next = withoutCascadeOff(next, traitId);
      continue;
    }
    const result = enabled && isLocked(next, world, null, traitId)
      ? { state: switchTrait(acquired ? next : { ...next, traits: [...next.traits, trait] }, trait, true, world), retired: [] }
      : acquired ? setTraitEnabled(next, traitId, enabled, world) : acquireTrait(next, trait, world);
    const kind = !acquired ? 'acquired' : enabled ? 'on' : 'off';
    log.push(...traitSwitchLog(nameOf(trait), kind, result.retired.map(nameOf), by));
    const settled = settleTraits(result.state, world, nameOf, by);
    next = settled.state;
    log.push(...settled.log);
    logTraits.push(...switchLogTraits(null, traitId, result.retired, settled.log));
  }
  return { state: next, log, logTraits };
}

/** The record key of the trait each line of one code switch's log reports, in {@link traitSwitchLog}'s order;
 *  null for a settle line, which no single switch owns. */
const switchLogTraits = (ownerId: OwnerId, traitId: string, retired: readonly Trait[], settleLog: readonly string[]): (string | null)[] => [
  ...retired.map((sibling) => recordKey(ownerId, sibling.id)), recordKey(ownerId, traitId), ...settleLog.map(() => null),
];

/** One code switch of an owner's own trait, then a settle: the world-trait rules of
 *  {@link applyCodeTraitSwitches}, in the owner's lists and groups. */
function codeSwitchOwned(
  state: TraitRuntimeState, ownerId: string, traitId: string, enabled: boolean, by: string, world: TraitWorld,
  nameOf: (trait: Trait) => string,
): { state: TraitRuntimeState; log: string[]; logTraits: (string | null)[] } {
  const owned = ownedTrait(world, traitId, ownerId);
  if (!owned || isAlwaysOn(owned.trait)) return { state, log: [], logTraits: [] };
  if (ownedOn(state, ownerId, traitId) === enabled) {
    return { state: enabled ? state : withoutCascadeOff(state, traitId, ownerId), log: [], logTraits: [] };
  }
  const { owner, trait } = owned;
  const chosen = !!state.ownedTraits?.[ownerId]?.chosen.includes(traitId);
  const retired = enabled && !isLocked(state, world, ownerId, traitId)
    ? exclusiveSiblings(trait, owner.traits, owner.groups)
      .filter((id) => ownedOn(state, ownerId, id))
      .flatMap((id) => owner.traits.filter((t) => t.id === id))
    : [];
  let switched = state;
  for (const sibling of retired) switched = flipOwnerTrait(switched, ownerId, sibling, false, world);
  switched = flipOwnerTrait(switched, ownerId, trait, enabled, world);
  const label = labeler(world, nameOf);
  const kind: TraitSwitchKind = !chosen ? 'acquired' : enabled ? 'on' : 'off';
  const settled = settleTraits(switched, world, nameOf, by);
  return {
    state: settled.state,
    log: [...traitSwitchLog(label(trait, ownerId), kind, retired.map((t) => label(t, ownerId)), by), ...settled.log],
    logTraits: switchLogTraits(ownerId, traitId, retired, settled.log),
  };
}

/**
 * Every trait the player can act on, in authored order: the ones they have acquired, plus every toggleable
 * trait the world offers that they haven't. Once a trait can be taken at will, being acquired is only a
 * checkbox state.
 */
export function listableGlobalTraits(
  acquiredTraits: readonly Trait[],
  authored: readonly Trait[],
  order: Map<string, number>,
): Trait[] {
  const acquiredIds = new Set(acquiredTraits.map((t) => t.id));
  const acquirable = authored.filter((t) => t.playerToggle && !isAlwaysOn(t) && !acquiredIds.has(t.id));
  return inAuthoredOrder([...acquiredTraits, ...acquirable], order);
}
