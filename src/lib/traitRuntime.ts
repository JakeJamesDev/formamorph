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
  CascadeOffTraitIds, CodeBoundDeltas, CodeBounds, EntityStatValues, LegacyCodeBoundsStat, OwnedTraitPicks, OwnedTraitStates, PersonaRef,
  PlayerStat, Stat, StatChange, Trait, TraitGroup,
} from '@/types';
import { clamp } from './utils';
import { ownedTraitStatesFrom, ownStatsRecordKey, recordKey } from './ownedTraitState';
import { activeOwnedTraitIds } from './ownedTraitsInPlay';
import { activeStatEnabled, exclusiveSiblings, inAuthoredOrder, isAlwaysOn, isHidden } from './traitEffects';
import { hasStatEffects, offeredWorldTraits, type StatRow } from './traitTree';
import {
  gateOf, gateStates, modeRefuses, overfills, playerOwnerIds, settle, underfills, PLAYER_OWNER, type GateEntity, type GateInput, type GateOwner, type GateStat,
  type GateStates, type GateStats, type GateTraitRef,
} from './traitGates';

/** What a trait's last switch actually moved: record key → stat id → value delta, keyed as `recordKey` and
 *  `ownStatsRecordKey` (lib/ownedTraitState) spell it. */
export type AppliedTraitValues = Record<string, Record<string, number>>;

/** The gameplay slice trait operations read and rewrite. */
export interface TraitRuntimeState {
  stats: PlayerStat[];
  /** The player's traits — chosen at creation or acquired during the game. Switched-off ones stay listed. */
  traits: Trait[];
  disabledTraitIds: string[];
  appliedValues: AppliedTraitValues;
  /** Owner id → the traits a cascade turned off, which return once their gate holds. Absent ⇒ none. */
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
} & (
  | { entities?: readonly GateEntity[]; owners?: undefined }
  /** Every present owner as the gate module reads it, the player first (see lib/owners). Absent ⇒ only
   *  the world's offered traits gate. The entities name the Custom Persona entity among them. */
  | { entities: readonly GateEntity[]; owners: readonly GateOwner[] }
);

/** The traits currently in force: everything in the player's list that isn't switched off. */
export function activeTraits(traits: readonly Trait[], disabledTraitIds: readonly string[]): Trait[] {
  const off = new Set(disabledTraitIds);
  return traits.filter((t) => !off.has(t.id));
}

/** The slice the traits in force are read from; a saved or viewed copy fits as well as the live state. */
export interface TraitForceState {
  traits: readonly Trait[];
  disabledTraitIds: readonly string[];
  ownedTraits?: OwnedTraitStates;
  /** Each entity's stat values: a player owner's change on one of its own stats leaves the player's alone. */
  entityStats?: EntityStatValues;
}

/** The player's chosen world traits the player owner holds right now. A Custom Persona pick lies dormant
 *  under a world persona: it stays chosen for a return to None, and does nothing until then. Without
 *  owners every chosen trait is held. */
export function heldPlayerTraits(traits: readonly Trait[], world: TraitWorld): Trait[] {
  const player = world.owners?.find((o) => o.id === PLAYER_OWNER);
  if (!player) return [...traits];
  const held = new Set(player.traits.map((t) => t.id));
  return traits.filter((t) => held.has(t.id));
}

/** The entity owners whose active traits are the player's, in owner order: the Custom Persona entity under
 *  None and a library persona, and the played persona. Empty with no persona or no owners. */
const playerEntityOwners = (world: TraitWorld): readonly GateOwner[] => {
  if (!world.persona || !world.owners) return [];
  const ids = new Set(playerOwnerIds(world.persona, world.entities));
  return world.owners.filter((o) => o.id !== PLAYER_OWNER && ids.has(o.id));
};

/** Whether `ownerId` is a player entity owner, whose stat traits move the player's stats. */
const isPlayerOwner = (world: TraitWorld, ownerId: string): boolean => playerEntityOwners(world).some((o) => o.id === ownerId);

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

/** A player owner's trait as it acts on the player's stats: its rows on the owner's own stats left out, a
 *  row that targets the player kept. */
const withoutOwnStatRows = (trait: Trait, own: ReadonlySet<string>): Trait =>
  withStatRows(trait, (row) => row.target === 'player' || !own.has(row.statId));

/** An owner's trait as it acts on the owner's own stats: its rows that target the player left out. */
const withoutPlayerRows = (trait: Trait): Trait => withStatRows(trait, (row) => row.target !== 'player');

/** Each player entity owner's active traits that change the player's stats, owned or linked, with the owner
 *  that holds them: the played persona's, and the Custom Persona entity's. */
function playedStatTraitsByOwner(state: Pick<TraitForceState, 'ownedTraits' | 'entityStats'>, world: TraitWorld): [string, Trait][] {
  const active = activeOwnedTraitIds(state.ownedTraits ?? {});
  return playerEntityOwners(world).flatMap((owner) => {
    const on = new Set(active[owner.id] ?? []);
    const own = ownStatIds(state, owner.id);
    return owner.traits.filter((t) => on.has(t.id)).map((t) => withoutOwnStatRows(t, own))
      .filter(hasStatEffects).map((t): [string, Trait] => [owner.id, t]);
  });
}

/** The player's active entity traits that change stats: the played persona's, and the Custom Persona
 *  entity's under None and a library persona. Empty with no persona, or under a world with no owners. */
export const playedStatTraits = (state: Pick<TraitForceState, 'ownedTraits' | 'entityStats'>, world: TraitWorld): Trait[] =>
  playedStatTraitsByOwner(state, world).map(([, t]) => t);

/** Every trait whose stat effects are in force: the player's active held world traits, then the player's
 *  active linked stat traits. Bounds derive from this set, and so do stat toggles. */
export function statTraitsInForce(state: TraitForceState, world: TraitWorld): Trait[] {
  return [...heldPlayerTraits(activeTraits(state.traits, state.disabledTraitIds), world), ...playedStatTraits(state, world)];
}

/** Each owner's traits among its `active` ids that change its own stats, in its tree order; none for an owner
 *  with no tree. */
export function treeStatTraits(
  trees: readonly Pick<GateOwner, 'id' | 'traits'>[], active: Readonly<Record<string, readonly string[]>>,
): (ownerId: string) => Trait[] {
  const byId = new Map(trees.map((tree) => [tree.id, tree]));
  return (ownerId) => {
    const on = new Set(active[ownerId] ?? []);
    return (byId.get(ownerId)?.traits ?? []).flatMap((t) => (on.has(t.id) ? [withoutPlayerRows(t)] : [])).filter(hasStatEffects);
  };
}

/** An entity owner's active traits that change stats, owned or linked, in its tree order. None for an
 *  entity that isn't an owner in play. */
export const entityStatTraitsInForce = (ownedTraits: OwnedTraitStates | undefined, world: TraitWorld, ownerId: string): Trait[] =>
  treeStatTraits(entityOwners(world), activeOwnedTraitIds(ownedTraits ?? {}))(ownerId);

/** Alias kept while call sites move to {@link entityStatTraitsInForce}. */
export const bearerStatTraitsInForce = entityStatTraitsInForce;

/** The stat traits in force for one owner's stats: the player's are {@link statTraitsInForce}; an entity's
 *  are its own. A change on a stat the owner lacks finds nothing to move. */
export const ownerStatTraitsInForce = (state: TraitForceState, world: TraitWorld, ownerId: string): Trait[] =>
  (ownerId === PLAYER_OWNER ? statTraitsInForce(state, world) : entityStatTraitsInForce(state.ownedTraits, world, ownerId));

/** Each stat trait in force with its record key, so two worlds' sets compare by what the record is under. */
const keyedStatTraits = (state: TraitForceState, world: TraitWorld): [string, Trait][] => [
  ...heldPlayerTraits(activeTraits(state.traits, state.disabledTraitIds), world).map((t): [string, Trait] => [t.id, t]),
  ...playedStatTraitsByOwner(state, world).map(([ownerId, t]): [string, Trait] => [recordKey(ownerId, t.id), t]),
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
 * Turn the code bounds an older save stored on its player stats into code deltas, under the player's stat
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
 * value and its game-start baseline (`starting`) settled so the opening turn's deltas read from the world
 * value rather than 0/min. Authored, chips and all — names resolve on the way out of state, never in.
 */
export function seedNewGameStats(authored: readonly Stat[]): PlayerStat[] {
  return seedStatBases(authored.map((stat) => {
    const value = stat.value || stat.min || 0;
    return { ...stat, value, starting: stat.starting ?? value };
  }));
}

/** The stats a fresh playthrough holds once the held picks among `chosenInOrder` have applied, then the
 *  played persona's linked stat traits among `owned` — the fold Enter World runs, for a picker that needs
 *  the numbers before the game exists. */
export function startingStatsWith(
  authored: readonly Stat[], chosenInOrder: readonly Trait[], world: TraitWorld, owned: OwnedTraitPicks = {},
): PlayerStat[] {
  let state: TraitRuntimeState = { stats: seedNewGameStats(authored), traits: [], disabledTraitIds: [], appliedValues: {} };
  for (const trait of heldPlayerTraits(chosenInOrder, world)) state = acquireTrait(state, trait, world).state;
  return applyPlayedStatTraits({ ...state, ownedTraits: ownedTraitStatesFrom(owned) }, world).state.stats;
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
  const trait = withoutPlayerRows(ownerTrait);
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

/** Move a trait's switch in its owner's lists and settle the stats around it: the player's world traits in
 *  the disabled list, a played persona's in its owned lists. */
function switchTrait(state: TraitRuntimeState, trait: Trait, on: boolean, world: TraitWorld, ownerId = PLAYER_OWNER): TraitRuntimeState {
  const listed = ownerId === PLAYER_OWNER
    ? { ...state, disabledTraitIds: withDisabled(state.disabledTraitIds, on ? null : trait.id, on ? trait.id : null) }
    : withOwnedSwitch(state, ownerId, trait.id, on);
  return moveStats(listed, trait, on, recordKey(ownerId, trait.id), statTraitsInForce(listed, world));
}

/** Switch an owner's trait in its lists and move the stats it changes: the world's traits and a player entity
 *  owner's move the player's stats, and an entity's own traits move its own stats. */
function flipOwnerTrait(state: TraitRuntimeState, ownerId: string, trait: Trait, on: boolean, world: TraitWorld): TraitRuntimeState {
  if (ownerId === PLAYER_OWNER) return switchTrait(state, trait, on, world);
  const played = isPlayerOwner(world, ownerId) ? withoutOwnStatRows(trait, ownStatIds(state, ownerId)) : null;
  const switched = played && hasStatEffects(played)
    ? switchTrait(state, played, on, world, ownerId)
    : withOwnedSwitch(state, ownerId, trait.id, on);
  return moveOwnStats(switched, ownerId, trait, on, world);
}

/**
 * Apply the player's active linked stat traits, owner by owner in tree order, as picking them at creation
 * would. For a new game and the Enter World preview, whose owned picks are already chosen.
 */
export function applyPlayedStatTraits(state: TraitRuntimeState, world: TraitWorld): { state: TraitRuntimeState; applied: Trait[] } {
  const applied = playedStatTraitsByOwner(state, world);
  let next = state;
  const on: Trait[] = [];
  for (const [ownerId, trait] of applied) {
    on.push(trait);
    next = moveStats(next, trait, true, recordKey(ownerId, trait.id), [...activeTraits(next.traits, next.disabledTraitIds), ...on]);
  }
  return { state: next, applied: applied.map(([, t]) => t) };
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
 * logged as a switch. That covers the old persona's links and the Custom Persona picks a world persona
 * leaves dormant. The lists themselves do not move, so a return to a persona the playthrough still holds
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
  /** The entity owner whose own trait this switches. Absent ⇒ the player's world trait. */
  ownerId?: string;
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

/** Every owner's live stats as gates read them: the player's under the world owner, each entity's under its
 *  id, on their effective bounds. */
export function gateStatsOf(state: GateStatState, world: TraitWorld): GateStats {
  return {
    [PLAYER_OWNER]: ownerGateStats(state.stats, statTraitsInForce(state, world)),
    ...Object.fromEntries(Object.entries(state.entityStats ?? {}).map(([ownerId, stats]) =>
      [ownerId, ownerGateStats(stats, entityStatTraitsInForce(state.ownedTraits, world, ownerId))])),
  };
}

/** Every owner's traits, active set and stats, as the gate module reads them. */
export const traitGateInput = (state: GateStatState, world: TraitWorld): GateInput => ({
  owners: world.owners ?? [{ id: PLAYER_OWNER, name: '', ...offeredWorldTraits(world.traits, world.groups) }],
  active: {
    ...activeOwnedTraitIds(state.ownedTraits ?? {}),
    [PLAYER_OWNER]: heldPlayerTraits(activeTraits(state.traits, state.disabledTraitIds), world).map((t) => t.id),
  },
  stats: world.gateStats ?? gateStatsOf(state, world),
  entities: world.entities ?? [],
  persona: world.persona ?? { source: 'none' },
  originals: { traits: world.traits, groups: world.groups },
});

/** Every owner's gate on each of its traits, for one read of the state. */
export const traitGates = (state: GateStatState, world: TraitWorld): GateStates => gateStates(traitGateInput(state, world));

/** Whether the owner's requirements on a trait hold in `gates`. A trait with no gate state is open. */
export const traitUnlocked = (gates: GateStates, ownerId: string, traitId: string): boolean =>
  gateOf(gates, ownerId, traitId)?.unlocked !== false;

const isLocked = (state: TraitRuntimeState, world: TraitWorld, ownerId: string, traitId: string): boolean =>
  !traitUnlocked(traitGates(state, world), ownerId, traitId);

/** Whether the gate module refuses the player's switch-on: the trait is locked, its group is full, or the
 *  mode refuses it. */
const refusesOn = (state: TraitRuntimeState, world: TraitWorld, ownerId: string, traitId: string): boolean => {
  const input = traitGateInput(state, world);
  return gateOf(gateStates(input), ownerId, traitId)?.unlocked === false || overfills(input, ownerId, traitId)
    || modeRefuses(input, ownerId, traitId);
};

/** Whether the gate module refuses the player's switch-off: its group would end below the minimum, or the
 *  mode refuses it. */
const refusesOff = (state: TraitRuntimeState, world: TraitWorld, ownerId: string, traitId: string): boolean => {
  const input = traitGateInput(state, world);
  return underfills(input, ownerId, traitId) || modeRefuses(input, ownerId, traitId);
};

/** The owners other than the player's. */
const entityOwners = (world: TraitWorld): readonly GateOwner[] => (world.owners ?? []).filter((o) => o.id !== PLAYER_OWNER);

/** Whether the player's world owner offers `traitId`. */
const playerHolds = (world: TraitWorld, traitId: string): boolean =>
  (world.owners?.find((o) => o.id === PLAYER_OWNER)?.traits ?? world.traits).some((t) => t.id === traitId);

/** The lists with every empty one dropped, so an empty list and an absent one read the same. */
function compactCascadeOff(lists: Readonly<Record<string, readonly string[]>> = {}): CascadeOffTraitIds {
  return Object.fromEntries(Object.entries(lists).filter(([, ids]) => ids.length).map(([owner, ids]) => [owner, [...ids]]));
}

function sameCascadeOff(a: CascadeOffTraitIds, b: CascadeOffTraitIds): boolean {
  const owners = Object.keys(a);
  return owners.length === Object.keys(b).length
    && owners.every((owner) => a[owner].length === b[owner]?.length && a[owner].every((id, i) => b[owner][i] === id));
}

/** `state` with `traitId` off its cascade-off list, so it never returns; the same state when it was not listed.
 *  With `ownerId`, only that owner's list. */
function withoutCascadeOff(state: TraitRuntimeState, traitId: string, ownerId?: string): TraitRuntimeState {
  const lists = state.cascadeOffTraitIds ?? {};
  const inScope = (owner: string) => ownerId === undefined || owner === ownerId;
  if (!Object.entries(lists).some(([owner, ids]) => inScope(owner) && ids.includes(traitId))) return state;
  const next = Object.fromEntries(Object.entries(lists)
    .map(([owner, ids]) => [owner, inScope(owner) ? ids.filter((id) => id !== traitId) : ids]));
  return { ...state, cascadeOffTraitIds: compactCascadeOff(next) };
}

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

/** A trait as the log and the banner name it: an NPC's owned trait carries its owner's name. The world's
 *  traits and a player entity owner's are the player's own, so they read bare. */
function labeler(world: TraitWorld, nameOf: (trait: Trait) => string) {
  const owners = new Map(entityOwners(world).map((o) => [o.id, o]));
  return (trait: Trait, ownerId: string): string => {
    const owner = ownerId === PLAYER_OWNER || isPlayerOwner(world, ownerId) ? undefined : owners.get(ownerId);
    return owner ? `${owner.name}'s ${nameOf(trait)}` : nameOf(trait);
  };
}

/** A world or owned trait as the log and the banner name it, found by id, in `ownerId`'s tree when given. */
export function traitNameIn(world: TraitWorld, traitId: string, nameOf: (trait: Trait) => string, ownerId?: string): string | null {
  const owned = ownerId === PLAYER_OWNER ? null : ownedTrait(world, traitId, ownerId);
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
  const result = settle(traitGateInput(state, world), state.cascadeOffTraitIds ?? {});
  const held = (refs: GateTraitRef[]) => refs.flatMap(({ ownerId, traitId }) => {
    const trait = ownerId === PLAYER_OWNER
      ? state.traits.find((t) => t.id === traitId) ?? world.traits.find((t) => t.id === traitId && isAlwaysOn(t))
      : ownedTrait(world, traitId, ownerId)?.trait;
    return trait ? [{ ownerId, trait }] : [];
  });
  const off = held(result.turnedOff);
  const back = held(result.returned);
  const cascadeOff = compactCascadeOff({ ...state.cascadeOffTraitIds, ...result.cascadeOff });
  if (!off.length && !back.length && sameCascadeOff(cascadeOff, compactCascadeOff(state.cascadeOffTraitIds))) {
    return { state, log: [], cascade: [], cascadeNames: [] };
  }
  let next = state;
  for (const { ownerId, trait } of off) next = flipOwnerTrait(next, ownerId, trait, false, world);
  for (const { ownerId, trait } of back) {
    if (ownerId === PLAYER_OWNER && !next.traits.some((t) => t.id === trait.id)) next = { ...next, traits: [...next.traits, trait] };
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
 * The player's switch of an owner's trait in that entity's lists. A cast entity's trait moves lists only;
 * the played persona's linked stat trait moves the stats too. Switching on retires its active exclusive
 * siblings in the entity's groups.
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
  ownerId?: string,
): GatedTraitResult | null {
  const acquired = state.traits.find((t) => t.id === traitId);
  const owned = ownerId !== undefined
    ? (ownerId === PLAYER_OWNER ? null : ownedTrait(world, traitId, ownerId))
    : acquired || playerHolds(world, traitId) ? null : ownedTrait(world, traitId);
  if (owned) return switchOwned(state, owned, enabled, world, nameOf);
  if (ownerId !== undefined && ownerId !== PLAYER_OWNER) return null;
  const trait = acquired ?? world.traits.find((t) => t.id === traitId);
  if (!trait || (!!acquired && !state.disabledTraitIds.includes(traitId)) === enabled) return null;
  if (enabled && (refusesOn(state, world, PLAYER_OWNER, traitId) || (!acquired && !trait.playerToggle))) return null;
  if (!enabled && refusesOff(state, world, PLAYER_OWNER, traitId)) return null;
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
): { state: TraitRuntimeState; log: string[] } {
  let next = state;
  const log: string[] = [];
  for (const { traitId, enabled, by, ownerId } of switches) {
    if (ownerId !== undefined && ownerId !== PLAYER_OWNER) {
      const switched = codeSwitchOwned(next, ownerId, traitId, enabled, by, world, nameOf);
      next = switched.state;
      log.push(...switched.log);
      continue;
    }
    const acquired = next.traits.find((t) => t.id === traitId);
    const trait = acquired ?? world.traits.find((t) => t.id === traitId);
    if (!trait || isAlwaysOn(world.traits.find((t) => t.id === traitId) ?? trait)) continue;
    if ((!!acquired && !next.disabledTraitIds.includes(traitId)) === enabled) {
      if (!enabled) next = withoutCascadeOff(next, traitId);
      continue;
    }
    const result = enabled && isLocked(next, world, PLAYER_OWNER, traitId)
      ? { state: switchTrait(acquired ? next : { ...next, traits: [...next.traits, trait] }, trait, true, world), retired: [] }
      : acquired ? setTraitEnabled(next, traitId, enabled, world) : acquireTrait(next, trait, world);
    const kind = !acquired ? 'acquired' : enabled ? 'on' : 'off';
    log.push(...traitSwitchLog(nameOf(trait), kind, result.retired.map(nameOf), by));
    const settled = settleTraits(result.state, world, nameOf, by);
    next = settled.state;
    log.push(...settled.log);
  }
  return { state: next, log };
}

/** One code switch of an owner's own trait, then a settle: the world-trait rules of
 *  {@link applyCodeTraitSwitches}, in the owner's lists and groups. */
function codeSwitchOwned(
  state: TraitRuntimeState, ownerId: string, traitId: string, enabled: boolean, by: string, world: TraitWorld,
  nameOf: (trait: Trait) => string,
): { state: TraitRuntimeState; log: string[] } {
  const owned = ownedTrait(world, traitId, ownerId);
  if (!owned || isAlwaysOn(owned.trait)) return { state, log: [] };
  if (ownedOn(state, ownerId, traitId) === enabled) {
    return { state: enabled ? state : withoutCascadeOff(state, traitId, ownerId), log: [] };
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
  };
}

/**
 * Every trait the player can act on, in authored order: the ones they have acquired, plus every toggleable
 * trait the world offers that they haven't. Once a trait can be taken at will, being acquired is only a
 * checkbox state.
 */
export function listablePlayerTraits(
  acquiredTraits: readonly Trait[],
  authored: readonly Trait[],
  order: Map<string, number>,
): Trait[] {
  const acquiredIds = new Set(acquiredTraits.map((t) => t.id));
  const acquirable = authored.filter((t) => t.playerToggle && !isAlwaysOn(t) && !acquiredIds.has(t.id));
  return inAuthoredOrder([...acquiredTraits, ...acquirable], order);
}
