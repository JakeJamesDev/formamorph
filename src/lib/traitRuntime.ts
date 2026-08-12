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

import type { PlayerStat, Stat, StatChange, Trait, TraitGroup } from '@/types';
import { clamp } from './utils';
import { exclusiveSiblings, inAuthoredOrder } from './traitEffects';

/** What a trait's last switch actually moved: trait id → stat id → value delta. */
export type AppliedTraitValues = Record<string, Record<string, number>>;

/** The gameplay slice trait operations read and rewrite. */
export interface TraitRuntimeState {
  stats: PlayerStat[];
  /** The player's traits — chosen at creation or acquired in play. Switched-off ones stay listed. */
  traits: Trait[];
  disabledTraitIds: string[];
  appliedValues: AppliedTraitValues;
}

/** The authored world, for exclusive-group lookups. */
export interface TraitWorld {
  traits: Trait[];
  groups: TraitGroup[];
}

/** The traits currently in force: everything in the player's list that isn't switched off. */
export function activeTraits(traits: Trait[], disabledTraitIds: readonly string[]): Trait[] {
  const off = new Set(disabledTraitIds);
  return traits.filter((t) => !off.has(t.id));
}

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
 * delta. Values are untouched — this is bounds only.
 *
 * A trait may raise a min and another may lower that raise back, but the floor never drops below the one the
 * author wrote: the summed min contribution only counts when it is positive. Max is floored at the effective
 * min so a lowering trait can never invert the range.
 */
export function deriveEffectiveStats(stats: PlayerStat[], active: readonly Trait[]): PlayerStat[] {
  return stats.map((stat) => {
    const base = bases(stat);
    const contrib = traitContributions(stat.id, active);
    const min = base.min + Math.max(0, contrib.min);
    const max = Math.max(min, base.max + contrib.max + (stat.aiMaxDelta ?? 0));
    const regen = base.regen + contrib.regen;
    if (min === stat.min && max === stat.max && regen === (stat.regen ?? 0)) return stat;
    return { ...stat, min, max, regen };
  });
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
 * Move a trait's switch and settle the stats around it.
 *
 * The record for a trait is the movement its *last* switch produced, so every transition is the reverse of
 * the one before it and a trait can go back and forth forever without gaining or losing a point. That is
 * what folds a clamp into the reversal: a switch-off that a shrinking cap forced further down than the
 * record asked records the larger movement, and the switch back on restores all of it.
 *
 * The exception is the first switch-on, and a trait held by a save that carries no record for it. Those have
 * nothing to reverse, so the authored changes apply — for a switch-off that means negating them, which a
 * bound can swallow and ratchet, for that one trait. That switch records properly, so a save without records
 * heals itself the first time the player touches the trait.
 */
function switchTrait(state: TraitRuntimeState, trait: Trait, on: boolean): TraitRuntimeState {
  const disabledTraitIds = withDisabled(state.disabledTraitIds, on ? null : trait.id, on ? trait.id : null);
  const derived = deriveEffectiveStats(state.stats, activeTraits(state.traits, disabledTraitIds));
  const record = state.appliedValues[trait.id];
  const reversing = record !== undefined;
  const deltas = reversing
    ? negated(Object.entries(record))
    : on
      ? valueDeltas(trait.statChanges)
      : negated(valueDeltas(trait.statChanges));
  const stats = settleValues(state.stats, derived, deltas, !reversing && on);
  // Recorded even when nothing moved: an empty record is the statement "this switch moved nothing", which is
  // exactly what stops a bound-swallowed penalty from paying out on the way off. Absent means unrecorded.
  const appliedValues = { ...state.appliedValues, [trait.id]: movement(state.stats, stats) };
  return { ...state, stats, disabledTraitIds, appliedValues };
}

/**
 * First switch-on of a trait the player does not hold yet. Identical to choosing it at creation: the trait
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
 * Switch a held trait on or off. Switching one on retires its active exclusive siblings first, each reversed
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
  if (!enabled) return { state: switchTrait(state, trait, false), retired: [] };

  const siblingIds = new Set(exclusiveSiblings(trait, world.traits, world.groups));
  const retired = activeTraits(state.traits, state.disabledTraitIds).filter(
    (t) => t.id !== traitId && siblingIds.has(t.id),
  );
  let next = state;
  for (const sibling of retired) next = switchTrait(next, sibling, false);
  return { state: switchTrait(next, trait, true), retired };
}

/**
 * Every trait the player can act on, in authored order: the ones they hold, plus every toggleable trait the
 * world offers that they don't. Once a trait can be taken at will, holding it is only a checkbox state.
 */
export function listablePlayerTraits(
  held: readonly Trait[],
  authored: readonly Trait[],
  order: Map<string, number>,
): Trait[] {
  const heldIds = new Set(held.map((t) => t.id));
  const acquirable = authored.filter((t) => t.playerToggle && !heldIds.has(t.id));
  return inAuthoredOrder([...held, ...acquirable], order);
}
