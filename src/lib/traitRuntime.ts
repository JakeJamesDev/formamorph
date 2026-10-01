// Trait runtime orchestration: acquiring a trait mid-play, switching one on or off, and the stat maths that
// goes with it. Pure over a small slice of gameplay state, so all of it is reachable from a test.
//
// Two rules shape everything here:
//
// - Bounds are DERIVED, never patched. A stat's effective min/max/regen is its authored base plus the
//   contributions of whichever traits are active right now plus what the AI has moved. Recomputing instead
//   of accumulating means bounds cannot drift however many times a trait is toggled.
// - Value movement is RECORDED. A trait's stat change that a floor or ceiling refused moved nothing, so
//   switching it off must give back nothing. Each switch stores what actually moved and the next switch of
//   that trait reverses it, rather than the authored number.

import type {
  CascadeOffTraitIds, CodeBounds, OwnedTraitPicks, OwnedTraitStates, PersonaRef, PlayerStat, Stat, StatChange, Trait,
  TraitGroup,
} from '@/types';
import { clamp } from './utils';
import { ownedTraitStatesFrom, recordKey } from './ownedTraitState';
import { activeOwnedTraitIds } from './ownedTraitsInPlay';
import { exclusiveSiblings, inAuthoredOrder, isAlwaysOn, isHidden } from './traitEffects';
import { hasStatEffects, offeredWorldTraits } from './traitTree';
import {
  gateOf, gateStates, modeRefuses, overfills, playerOwnerIds, settle, underfills, WORLD_OWNER, type GateEntity, type GateInput, type GateOwner, type GateStates, type GateTraitRef,
} from './traitGates';

/** What a trait's last switch actually moved: record key → stat id → value delta, keyed as `recordKey`
 *  (lib/ownedTraitState) spells it. */
export type AppliedTraitValues = Record<string, Record<string, number>>;

/** The gameplay slice trait operations read and rewrite. */
export interface TraitRuntimeState {
  stats: PlayerStat[];
  /** The player's traits — chosen at creation or acquired in play. Switched-off ones stay listed. */
  traits: Trait[];
  disabledTraitIds: string[];
  appliedValues: AppliedTraitValues;
  /** Owner id → the traits a cascade turned off, which return once their gate holds. Absent ⇒ none. */
  cascadeOffTraitIds?: CascadeOffTraitIds;
  /** Each entity's owned traits. Absent ⇒ none. */
  ownedTraits?: OwnedTraitStates;
}

/** The authored world, for exclusive-group lookups and gates. Absent `entities` or `persona`, no "playing
 *  as" requirement holds. */
export type TraitWorld = {
  traits: Trait[];
  groups: TraitGroup[];
  persona?: PersonaRef;
} & (
  | { entities?: readonly GateEntity[]; bearers?: undefined }
  /** Every present bearer as the gate module reads it, the player first (see lib/bearers). Absent ⇒ only
   *  the world's offered traits gate. The entities name the Custom Persona entity among them. */
  | { entities: readonly GateEntity[]; bearers: readonly GateOwner[] }
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
}

/** The player's chosen world traits the player bearer holds right now. A Custom Persona pick lies dormant
 *  under a world persona: it stays chosen for a return to None, and does nothing until then. Without
 *  bearers every chosen trait is held. */
export function heldPlayerTraits(traits: readonly Trait[], world: TraitWorld): Trait[] {
  const player = world.bearers?.find((o) => o.id === WORLD_OWNER);
  if (!player) return [...traits];
  const held = new Set(player.traits.map((t) => t.id));
  return traits.filter((t) => held.has(t.id));
}

/** The entity bearers whose active traits are the player's, in bearer order: the Custom Persona entity under
 *  None and a library persona, and the played persona. Empty with no persona or no bearers. */
const playerEntityBearers = (world: TraitWorld): readonly GateOwner[] => {
  if (!world.persona || !world.bearers) return [];
  const ids = new Set(playerOwnerIds(world.persona, world.entities));
  return world.bearers.filter((o) => o.id !== WORLD_OWNER && ids.has(o.id));
};

/** Whether `ownerId` is a player entity bearer, whose stat traits move the player's stats. */
const isPlayerBearer = (world: TraitWorld, ownerId: string): boolean => playerEntityBearers(world).some((o) => o.id === ownerId);

/** Each player entity bearer's active traits that change stats, owned or linked, with the bearer that holds
 *  them: the played persona's, and the Custom Persona entity's. */
function playedStatTraitsByOwner(state: Pick<TraitForceState, 'ownedTraits'>, world: TraitWorld): [string, Trait][] {
  const active = activeOwnedTraitIds(state.ownedTraits ?? {});
  return playerEntityBearers(world).flatMap((owner) => {
    const on = new Set(active[owner.id] ?? []);
    return owner.traits.filter((t) => on.has(t.id) && hasStatEffects(t)).map((t): [string, Trait] => [owner.id, t]);
  });
}

/** The player's active entity traits that change stats: the played persona's, and the Custom Persona
 *  entity's under None and a library persona. Empty with no persona, or under a world with no bearers. */
export const playedStatTraits = (state: Pick<TraitForceState, 'ownedTraits'>, world: TraitWorld): Trait[] =>
  playedStatTraitsByOwner(state, world).map(([, t]) => t);

/** Every trait whose stat effects are in force: the player's active held world traits, then the player's
 *  active linked stat traits. Bounds derive from this set, and so do stat toggles. */
export function statTraitsInForce(state: TraitForceState, world: TraitWorld): Trait[] {
  return [...heldPlayerTraits(activeTraits(state.traits, state.disabledTraitIds), world), ...playedStatTraits(state, world)];
}

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

/**
 * Recompute every stat's min, max and regen from its bases, the active traits and the accumulated AI max
 * delta, then let each code bound replace its field. Values are untouched — this is bounds only.
 *
 * A trait may raise a min and another may lower that raise back, but the floor never drops below the one the
 * author wrote: the summed min contribution only counts when it is positive. Max is floored at the effective
 * min so neither a lowering trait nor a code bound can invert the range.
 */
export function deriveEffectiveStats(stats: PlayerStat[], active: readonly Trait[]): PlayerStat[] {
  return stats.map((stat) => {
    const base = bases(stat);
    const contrib = traitContributions(stat.id, active);
    const code = stat.codeBounds;
    const min = code?.min ?? base.min + Math.max(0, contrib.min);
    const max = Math.max(min, code?.max ?? base.max + contrib.max + (stat.aiMaxDelta ?? 0));
    const regen = code?.regen ?? base.regen + contrib.regen;
    if (min === stat.min && max === stat.max && regen === (stat.regen ?? 0)) return stat;
    return { ...stat, min, max, regen };
  });
}

/** `stat` holding exactly `bounds` as its code bounds, re-derived under `active`, with `value` clamped in. */
export function withCodeBounds(
  stat: PlayerStat,
  bounds: CodeBounds,
  value: number,
  active: readonly Trait[],
): PlayerStat {
  const { codeBounds: _replaced, ...rest } = stat;
  const next: PlayerStat = Object.keys(bounds).length ? { ...rest, value, codeBounds: bounds } : { ...rest, value };
  const [derived] = deriveEffectiveStats([next], active);
  return { ...derived, value: clamp(derived.value, derived.min, derived.max) };
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
 * Settle the stats around one switch of a bearer's trait, its lists already moved. `active` is every stat
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
function moveStats(state: TraitRuntimeState, trait: Trait, on: boolean, key: string, active: readonly Trait[]): TraitRuntimeState {
  const derived = deriveEffectiveStats(state.stats, active);
  const record = state.appliedValues[key];
  const reversing = record !== undefined;
  const deltas = reversing
    ? negated(Object.entries(record))
    : on
      ? valueDeltas(trait.statChanges)
      : negated(valueDeltas(trait.statChanges));
  const stats = settleValues(state.stats, derived, deltas, !reversing && on);
  // Recorded even when nothing moved: an empty record is the statement "this switch moved nothing", which is
  // exactly what stops a bound-swallowed penalty from paying out on the way off. Absent means unrecorded.
  const appliedValues = { ...state.appliedValues, [key]: movement(state.stats, stats) };
  return { ...state, stats, appliedValues };
}

/** Move a trait's switch in its bearer's lists and settle the stats around it: the player's world traits in
 *  the disabled list, a played persona's in its owned lists. */
function switchTrait(state: TraitRuntimeState, trait: Trait, on: boolean, world: TraitWorld, ownerId = WORLD_OWNER): TraitRuntimeState {
  const listed = ownerId === WORLD_OWNER
    ? { ...state, disabledTraitIds: withDisabled(state.disabledTraitIds, on ? null : trait.id, on ? trait.id : null) }
    : withOwnedSwitch(state, ownerId, trait.id, on);
  return moveStats(listed, trait, on, recordKey(ownerId, trait.id), statTraitsInForce(listed, world));
}

/** Switch a bearer's trait in its lists, moving stats when the trait has them and the player bears it: the
 *  world's traits, and a player entity bearer's linked stat traits. A cast entity's trait moves lists only. */
function flipBearerTrait(state: TraitRuntimeState, ownerId: string, trait: Trait, on: boolean, world: TraitWorld): TraitRuntimeState {
  if (ownerId === WORLD_OWNER) return switchTrait(state, trait, on, world);
  if (isPlayerBearer(world, ownerId) && hasStatEffects(trait)) return switchTrait(state, trait, on, world, ownerId);
  return withOwnedSwitch(state, ownerId, trait.id, on);
}

/**
 * Apply the player's active linked stat traits, bearer by bearer in tree order, as picking them at creation
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
 * The stat side of a persona switch in play: every stat trait in force under the old persona and not the
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
  /** The entity bearer whose own trait this switches. Absent ⇒ the player's world trait. */
  ownerId?: string;
}

/** Every bearer's traits and active set, as the gate module reads them. */
export const traitGateInput = (
  state: Pick<TraitRuntimeState, 'traits' | 'disabledTraitIds' | 'ownedTraits'>, world: TraitWorld,
): GateInput => ({
  owners: world.bearers ?? [{ id: WORLD_OWNER, name: '', ...offeredWorldTraits(world.traits, world.groups) }],
  active: {
    ...activeOwnedTraitIds(state.ownedTraits ?? {}),
    [WORLD_OWNER]: heldPlayerTraits(activeTraits(state.traits, state.disabledTraitIds), world).map((t) => t.id),
  },
  entities: world.entities ?? [],
  persona: world.persona ?? { source: 'none' },
  originals: { traits: world.traits, groups: world.groups },
});

/** Every bearer's gate on each of its traits, for one read of the state. */
export const traitGates = (
  state: Pick<TraitRuntimeState, 'traits' | 'disabledTraitIds' | 'ownedTraits'>, world: TraitWorld,
): GateStates => gateStates(traitGateInput(state, world));

/** Whether the bearer's requirements on a trait hold in `gates`. A trait with no gate state is open. */
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

/** The bearers other than the player's world owner. */
const entityBearers = (world: TraitWorld): readonly GateOwner[] => (world.bearers ?? []).filter((o) => o.id !== WORLD_OWNER);

/** Whether the player's world owner offers `traitId`. */
const playerHolds = (world: TraitWorld, traitId: string): boolean =>
  (world.bearers?.find((o) => o.id === WORLD_OWNER)?.traits ?? world.traits).some((t) => t.id === traitId);

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

/** A bearer's trait: its owner and the trait itself. Without `ownerId`, the first bearer that holds it. */
function ownedTrait(world: TraitWorld, traitId: string, ownerId?: string): { owner: GateOwner; trait: Trait } | null {
  for (const owner of entityBearers(world)) {
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
 *  traits and a player entity bearer's are the player's own, so they read bare. */
function labeler(world: TraitWorld, nameOf: (trait: Trait) => string) {
  const owners = new Map(entityBearers(world).map((o) => [o.id, o]));
  return (trait: Trait, ownerId: string): string => {
    const owner = ownerId === WORLD_OWNER || isPlayerBearer(world, ownerId) ? undefined : owners.get(ownerId);
    return owner ? `${owner.name}'s ${nameOf(trait)}` : nameOf(trait);
  };
}

/** A world or owned trait as the log and the banner name it, found by id, in `ownerId`'s tree when given. */
export function traitNameIn(world: TraitWorld, traitId: string, nameOf: (trait: Trait) => string, ownerId?: string): string | null {
  const owned = ownerId === WORLD_OWNER ? null : ownedTrait(world, traitId, ownerId);
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
    const trait = ownerId === WORLD_OWNER
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
  for (const { ownerId, trait } of off) next = flipBearerTrait(next, ownerId, trait, false, world);
  for (const { ownerId, trait } of back) {
    if (ownerId === WORLD_OWNER && !next.traits.some((t) => t.id === trait.id)) next = { ...next, traits: [...next.traits, trait] };
    next = flipBearerTrait(next, ownerId, trait, true, world);
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
 * The player's switch of a bearer's trait in that entity's lists. A cast entity's trait moves lists only;
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
  for (const sibling of retired) switched = flipBearerTrait(switched, owner.id, sibling, false, world);
  switched = flipBearerTrait(switched, owner.id, trait, enabled, world);
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
 * in that entity's lists. `ownerId` names the bearer whose row the player switched; without it, the
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
    ? (ownerId === WORLD_OWNER ? null : ownedTrait(world, traitId, ownerId))
    : acquired || playerHolds(world, traitId) ? null : ownedTrait(world, traitId);
  if (owned) return switchOwned(state, owned, enabled, world, nameOf);
  if (ownerId !== undefined && ownerId !== WORLD_OWNER) return null;
  const trait = acquired ?? world.traits.find((t) => t.id === traitId);
  if (!trait || (!!acquired && !state.disabledTraitIds.includes(traitId)) === enabled) return null;
  if (enabled && (refusesOn(state, world, WORLD_OWNER, traitId) || (!acquired && !trait.playerToggle))) return null;
  if (!enabled && refusesOff(state, world, WORLD_OWNER, traitId)) return null;
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
 * Player Can Toggle In-Game, so a switch-on of a trait the player lacks acquires it. Code never switches an
 * Always On trait. Code does not ignore gates: a switch-on of a locked trait retires no sibling, and the
 * settle turns it off again. A switch to the state a trait already holds does nothing: switching an off trait
 * off again would reverse its record a second time. It does take a cascade-off trait off its list, so the trait stays off.
 * A switch with an `ownerId` moves that bearer's own trait by the same rules, in its own lists.
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
    if (ownerId !== undefined && ownerId !== WORLD_OWNER) {
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
    const result = enabled && isLocked(next, world, WORLD_OWNER, traitId)
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

/** One code switch of a bearer's own trait, then a settle: the world-trait rules of
 *  {@link applyCodeTraitSwitches}, in the bearer's lists and groups. */
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
  for (const sibling of retired) switched = flipBearerTrait(switched, ownerId, sibling, false, world);
  switched = flipBearerTrait(switched, ownerId, trait, enabled, world);
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
